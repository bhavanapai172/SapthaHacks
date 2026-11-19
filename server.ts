import 'dotenv/config';
import path from 'node:path';
import express from 'express';
import multer from 'multer';
import AdmZip from 'adm-zip';
import { createServer as createViteServer } from 'vite';
import { db } from './server/db.ts';
import {
  type AuthenticatedRequest,
  loginUser,
  registerUser,
  requireAuth,
} from './server/auth.ts';
import {
  analyzeProjectWithGemini,
  explainCodeWithGemini,
  GEMINI_MODEL,
  generateTestsWithGemini,
  isGeminiConfigured,
  MissingApiKeyError,
  runJsSandboxTest,
} from './server/geminiService.ts';
import { SAMPLE_PROJECTS } from './server/sampleProjects.ts';
import {
  calculatePriorityScore,
  detectLanguageFromPath,
  validateUploadFile,
} from './src/utils/bugLogic.ts';
import type { BugCategory, Severity } from './src/types.ts';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB max per upload item
    files: 30,
  },
});

const VALID_SEVERITIES = new Set<Severity>(['critical', 'high', 'medium', 'low']);
const VALID_CATEGORIES = new Set<BugCategory>([
  'syntax',
  'logical',
  'runtime',
  'edge_case',
  'security',
  'pattern',
]);

function normalizeSeverity(val: string): Severity {
  const lower = String(val || '').toLowerCase() as Severity;
  return VALID_SEVERITIES.has(lower) ? lower : 'medium';
}

function normalizeCategory(val: string): BugCategory {
  const lower = String(val || '').toLowerCase() as BugCategory;
  return VALID_CATEGORIES.has(lower) ? lower : 'logical';
}

// --- Public Health & Catalog ---
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    aiConfigured: isGeminiConfigured(),
    model: GEMINI_MODEL,
  });
});

app.get('/api/samples/catalog', (_req, res) => {
  res.json(
    SAMPLE_PROJECTS.map((p) => ({
      key: p.key,
      name: p.name,
      description: p.description,
      primaryLanguage: p.primaryLanguage,
      fileCount: p.files.length,
      focusAreas: p.focusAreas,
    }))
  );
});

// --- Auth Endpoints ---
app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body ?? {};
  const result = registerUser(String(name ?? ''), String(email ?? ''), String(password ?? ''));
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  res.status(201).json({ user: result.user, token: result.token });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body ?? {};
  const result = loginUser(String(email ?? ''), String(password ?? ''));
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  res.json({ user: result.user, token: result.token });
});

app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = db
    .prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?')
    .get(req.user!.userId);
  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }
  res.json({ user });
});

// --- Dashboard Aggregations (100% SQL-backed, never hardcoded) ---
app.get('/api/dashboard/stats', requireAuth, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.userId;

  const projectCountRow = db
    .prepare('SELECT COUNT(*) AS cnt FROM projects WHERE user_id = ?')
    .get(userId) as { cnt: number };

  const scanCountRow = db
    .prepare("SELECT COUNT(*) AS cnt FROM scan_history WHERE user_id = ? AND status = 'completed'")
    .get(userId) as { cnt: number };

  const bugStatsRow = db
    .prepare(`
      SELECT
        COUNT(*) AS total_bugs,
        SUM(CASE WHEN b.status = 'fixed' THEN 1 ELSE 0 END) AS fixed_bugs,
        SUM(CASE WHEN b.status = 'rejected' THEN 1 ELSE 0 END) AS rejected_bugs,
        SUM(CASE WHEN b.severity = 'critical' THEN 1 ELSE 0 END) AS critical_count,
        SUM(CASE WHEN b.severity = 'high' THEN 1 ELSE 0 END) AS high_count,
        SUM(CASE WHEN b.severity = 'medium' THEN 1 ELSE 0 END) AS medium_count,
        SUM(CASE WHEN b.severity = 'low' THEN 1 ELSE 0 END) AS low_count
      FROM detected_bugs b
      INNER JOIN projects p ON b.project_id = p.id
      WHERE p.user_id = ?
        AND b.scan_id = (
          SELECT MAX(s.id) FROM scan_history s
          WHERE s.project_id = p.id AND s.status = 'completed'
        )
    `)
    .get(userId) as Record<string, number | null>;

  const recentProjects = db
    .prepare(`
      SELECT
        p.*,
        (SELECT COUNT(*) FROM uploaded_files f WHERE f.project_id = p.id) AS file_count,
        COALESCE((SELECT s.total_bugs FROM scan_history s WHERE s.id = (
          SELECT MAX(s2.id) FROM scan_history s2 WHERE s2.project_id = p.id AND s2.status = 'completed'
        )), 0) AS total_bugs,
        (SELECT COUNT(*) FROM detected_bugs b WHERE b.project_id = p.id AND b.status = 'fixed' AND b.scan_id = (
          SELECT MAX(s3.id) FROM scan_history s3 WHERE s3.project_id = p.id AND s3.status = 'completed'
        )) AS fixed_bugs,
        (SELECT MAX(s4.scanned_at) FROM scan_history s4 WHERE s4.project_id = p.id) AS last_scanned_at
      FROM projects p
      WHERE p.user_id = ?
      ORDER BY p.updated_at DESC, p.id DESC
      LIMIT 6
    `)
    .all(userId);

  const recentScans = db
    .prepare(`
      SELECT s.*, p.name AS project_name
      FROM scan_history s
      INNER JOIN projects p ON s.project_id = p.id
      WHERE s.user_id = ?
      ORDER BY s.scanned_at DESC, s.id DESC
      LIMIT 8
    `)
    .all(userId);

  res.json({
    totalProjects: Number(projectCountRow?.cnt ?? 0),
    totalScans: Number(scanCountRow?.cnt ?? 0),
    totalBugsDetected: Number(bugStatsRow?.total_bugs ?? 0),
    bugsFixed: Number(bugStatsRow?.fixed_bugs ?? 0),
    fixesRejected: Number(bugStatsRow?.rejected_bugs ?? 0),
    severityBreakdown: {
      critical: Number(bugStatsRow?.critical_count ?? 0),
      high: Number(bugStatsRow?.high_count ?? 0),
      medium: Number(bugStatsRow?.medium_count ?? 0),
      low: Number(bugStatsRow?.low_count ?? 0),
    },
    recentProjects,
    recentScans,
    aiConfigured: isGeminiConfigured(),
  });
});

// --- Projects & Upload ---
app.get('/api/projects', requireAuth, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.userId;
  const rows = db
    .prepare(`
      SELECT
        p.*,
        (SELECT COUNT(*) FROM uploaded_files f WHERE f.project_id = p.id) AS file_count,
        COALESCE((SELECT s.total_bugs FROM scan_history s WHERE s.id = (
          SELECT MAX(s2.id) FROM scan_history s2 WHERE s2.project_id = p.id AND s2.status = 'completed'
        )), 0) AS total_bugs,
        (SELECT COUNT(*) FROM detected_bugs b WHERE b.project_id = p.id AND b.status = 'fixed' AND b.scan_id = (
          SELECT MAX(s3.id) FROM scan_history s3 WHERE s3.project_id = p.id AND s3.status = 'completed'
        )) AS fixed_bugs,
        (SELECT MAX(s4.scanned_at) FROM scan_history s4 WHERE s4.project_id = p.id) AS last_scanned_at
      FROM projects p
      WHERE p.user_id = ?
      ORDER BY p.updated_at DESC, p.id DESC
    `)
    .all(userId);
  res.json({ projects: rows });
});

app.post('/api/projects/sample', requireAuth, (req: AuthenticatedRequest, res) => {
  const { sampleKey } = req.body ?? {};
  const sample = SAMPLE_PROJECTS.find((s) => s.key === sampleKey);
  if (!sample) {
    res.status(404).json({ error: 'Sample project not found.' });
    return;
  }

  const userId = req.user!.userId;
  const projRes = db
    .prepare(`
      INSERT INTO projects (user_id, name, description, primary_language, source_type, is_sample)
      VALUES (?, ?, ?, ?, 'sample', 1)
    `)
    .run(userId, sample.name, sample.description, sample.primaryLanguage);
  const projectId = Number(projRes.lastInsertRowid);

  const insertFile = db.prepare(`
    INSERT INTO uploaded_files (project_id, file_path, language, size_bytes, original_content)
    VALUES (?, ?, ?, ?, ?)
  `);
  for (const file of sample.files) {
    insertFile.run(
      projectId,
      file.filePath,
      file.language,
      Buffer.byteLength(file.content, 'utf8'),
      file.content
    );
  }

  db.prepare(`
    INSERT INTO change_history (project_id, file_path, action, actor_email, notes)
    VALUES (?, ?, 'sample_imported', ?, ?)
  `).run(projectId, sample.files[0].filePath, req.user!.email, `Imported sample project ${sample.name}`);

  res.status(201).json({ projectId });
});

app.post(
  '/api/projects/upload',
  requireAuth,
  upload.array('files', 30),
  (req: AuthenticatedRequest, res) => {
    const projectName = String(req.body?.name ?? '').trim();
    const description = String(req.body?.description ?? '').trim();
    const uploaded = (req.files as Express.Multer.File[] | undefined) ?? [];

    if (!projectName) {
      res.status(400).json({ error: 'Project name is required.' });
      return;
    }
    if (uploaded.length === 0) {
      res.status(400).json({ error: 'Please select at least one source file or ZIP archive.' });
      return;
    }

    const extractedFiles: Array<{
      filePath: string;
      language: string;
      sizeBytes: number;
      content: string;
    }> = [];
    let hasZip = false;

    for (const item of uploaded) {
      const check = validateUploadFile(item.originalname, item.size);
      if (!check.valid) {
        res.status(400).json({ error: check.error });
        return;
      }

      if (check.isZip) {
        hasZip = true;
        try {
          const zip = new AdmZip(item.buffer);
          const entries = zip.getEntries();
          for (const entry of entries) {
            if (entry.isDirectory) continue;
            const entryPath = entry.entryName.replace(/^\/+/, '');
            if (
              entryPath.includes('node_modules/') ||
              entryPath.includes('.git/') ||
              entryPath.includes('__MACOSX/') ||
              entryPath.startsWith('__MACOSX')
            ) {
              continue;
            }
            const rawBuf = entry.getData();
            const innerCheck = validateUploadFile(entryPath, rawBuf.length);
            if (!innerCheck.valid || innerCheck.isZip) {
              continue; // safely skip non-source or nested zip assets inside archive
            }
            const textContent = rawBuf.toString('utf8');
            if (textContent.includes('\u0000')) {
              continue; // skip binary content
            }
            extractedFiles.push({
              filePath: entryPath,
              language: detectLanguageFromPath(entryPath),
              sizeBytes: rawBuf.length,
              content: textContent,
            });
            if (extractedFiles.length >= 30) break;
          }
        } catch {
          res.status(400).json({ error: `Could not extract ZIP archive "${item.originalname}".` });
          return;
        }
      } else {
        const textContent = item.buffer.toString('utf8');
        if (textContent.includes('\u0000')) {
          res.status(400).json({ error: `File "${item.originalname}" appears to be binary.` });
          return;
        }
        extractedFiles.push({
          filePath: item.originalname,
          language: detectLanguageFromPath(item.originalname),
          sizeBytes: item.size,
          content: textContent,
        });
      }
    }

    if (extractedFiles.length === 0) {
      res.status(400).json({
        error:
          'No supported source files were found. Upload Python, JS/TS, Java, C/C++, Go, Rust, SQL, or JSON files.',
      });
      return;
    }

    const langCounts = new Map<string, number>();
    for (const f of extractedFiles) {
      langCounts.set(f.language, (langCounts.get(f.language) ?? 0) + 1);
    }
    const primaryLanguage =
      [...langCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'mixed';

    const projRes = db
      .prepare(`
        INSERT INTO projects (user_id, name, description, primary_language, source_type, is_sample)
        VALUES (?, ?, ?, ?, ?, 0)
      `)
      .run(
        req.user!.userId,
        projectName,
        description || `Uploaded ${extractedFiles.length} source file(s)`,
        primaryLanguage,
        hasZip ? 'zip' : 'files'
      );

    const projectId = Number(projRes.lastInsertRowid);
    const insertFile = db.prepare(`
      INSERT INTO uploaded_files (project_id, file_path, language, size_bytes, original_content)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const file of extractedFiles) {
      insertFile.run(projectId, file.filePath, file.language, file.sizeBytes, file.content);
    }

    db.prepare(`
      INSERT INTO change_history (project_id, file_path, action, actor_email, notes)
      VALUES (?, ?, 'project_uploaded', ?, ?)
    `).run(
      projectId,
      extractedFiles[0].filePath,
      req.user!.email,
      `Uploaded ${extractedFiles.length} file(s) via ${hasZip ? 'ZIP archive' : 'source uploader'}`
    );

    res.status(201).json({ projectId, fileCount: extractedFiles.length });
  }
);

app.get('/api/projects/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const projectId = Number(req.params.id);
  const project = db
    .prepare(`
      SELECT
        p.*,
        (SELECT COUNT(*) FROM uploaded_files f WHERE f.project_id = p.id) AS file_count,
        (SELECT COALESCE(s.total_bugs, 0) FROM scan_history s WHERE s.id = (
          SELECT MAX(s2.id) FROM scan_history s2 WHERE s2.project_id = p.id AND s2.status = 'completed'
        )) AS total_bugs,
        (SELECT COUNT(*) FROM detected_bugs b WHERE b.project_id = p.id AND b.status = 'fixed' AND b.scan_id = (
          SELECT MAX(s3.id) FROM scan_history s3 WHERE s3.project_id = p.id AND s3.status = 'completed'
        )) AS fixed_bugs,
        (SELECT MAX(s4.scanned_at) FROM scan_history s4 WHERE s4.project_id = p.id) AS last_scanned_at
      FROM projects p
      WHERE p.id = ? AND p.user_id = ?
    `)
    .get(projectId, req.user!.userId);

  if (!project) {
    res.status(404).json({ error: 'Project not found.' });
    return;
  }

  const files = db
    .prepare('SELECT * FROM uploaded_files WHERE project_id = ? ORDER BY file_path ASC')
    .all(projectId);

  const scans = db
    .prepare('SELECT * FROM scan_history WHERE project_id = ? ORDER BY scanned_at DESC, id DESC')
    .all(projectId);

  const latestCompletedScan = db
    .prepare(
      "SELECT id FROM scan_history WHERE project_id = ? AND status = 'completed' ORDER BY id DESC LIMIT 1"
    )
    .get(projectId) as { id: number } | undefined;

  let bugs: Record<string, unknown>[] = [];
  if (latestCompletedScan) {
    const rawBugs = db
      .prepare(
        'SELECT * FROM detected_bugs WHERE scan_id = ? ORDER BY priority_score DESC, line_number ASC'
      )
      .all(latestCompletedScan.id);

    const getFix = db.prepare('SELECT * FROM suggested_fixes WHERE bug_id = ? LIMIT 1');
    bugs = rawBugs.map((b) => ({
      ...b,
      fix: getFix.get(Number(b.id)) ?? null,
    }));
  }

  const tests = db
    .prepare('SELECT * FROM test_results WHERE project_id = ? ORDER BY executed_at DESC, id DESC')
    .all(projectId);

  const changes = db
    .prepare('SELECT * FROM change_history WHERE project_id = ? ORDER BY created_at DESC, id DESC')
    .all(projectId);

  res.json({ project, files, scans, bugs, tests, changes });
});

app.delete('/api/projects/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const projectId = Number(req.params.id);
  const del = db
    .prepare('DELETE FROM projects WHERE id = ? AND user_id = ?')
    .run(projectId, req.user!.userId);
  if (del.changes === 0) {
    res.status(404).json({ error: 'Project not found.' });
    return;
  }
  res.json({ deleted: true });
});

// --- Intelligent AI Code Scanner ---
app.post('/api/projects/:id/scan', requireAuth, async (req: AuthenticatedRequest, res) => {
  const projectId = Number(req.params.id);
  const useRepaired = Boolean(req.body?.useRepaired);

  const project = db
    .prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?')
    .get(projectId, req.user!.userId);

  if (!project) {
    res.status(404).json({ error: 'Project not found.' });
    return;
  }

  const files = db
    .prepare('SELECT * FROM uploaded_files WHERE project_id = ? ORDER BY file_path ASC')
    .all(projectId) as Array<{
    id: number;
    file_path: string;
    language: string;
    original_content: string;
    repaired_content: string | null;
  }>;

  if (files.length === 0) {
    res.status(400).json({ error: 'Project has no uploaded files to scan.' });
    return;
  }

  try {
    const analysis = await analyzeProjectWithGemini(
      files.map((f) => ({
        filePath: f.file_path,
        language: f.language,
        content: useRepaired && f.repaired_content ? f.repaired_content : f.original_content,
      }))
    );

    const normalizedBugs = analysis.bugs.map((bug) => {
      const matchedFile =
        files.find((f) => f.file_path === bug.filePath) ??
        files.find((f) => bug.filePath.endsWith(f.file_path)) ??
        files[0];
      const severity = normalizeSeverity(bug.severity);
      const category = normalizeCategory(bug.category);
      const confidence = Math.max(1, Math.min(99, Number(bug.confidenceEstimate) || 75));
      const priorityScore = calculatePriorityScore(severity, confidence, category);

      return {
        ...bug,
        fileId: matchedFile.id,
        filePath: matchedFile.file_path,
        severity,
        category,
        confidence,
        priorityScore,
        lineNumber: Math.max(1, Number(bug.lineNumber) || 1),
        endLineNumber: Math.max(
          Math.max(1, Number(bug.lineNumber) || 1),
          Number(bug.endLineNumber) || Number(bug.lineNumber) || 1
        ),
      };
    });

    const criticalCount = normalizedBugs.filter((b) => b.severity === 'critical').length;
    const highCount = normalizedBugs.filter((b) => b.severity === 'high').length;
    const mediumCount = normalizedBugs.filter((b) => b.severity === 'medium').length;
    const lowCount = normalizedBugs.filter((b) => b.severity === 'low').length;

    const scanRes = db
      .prepare(`
        INSERT INTO scan_history (
          project_id, user_id, status, model_used, total_bugs,
          critical_count, high_count, medium_count, low_count, summary
        )
        VALUES (?, ?, 'completed', ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        projectId,
        req.user!.userId,
        GEMINI_MODEL,
        normalizedBugs.length,
        criticalCount,
        highCount,
        mediumCount,
        lowCount,
        analysis.summary
      );
    const scanId = Number(scanRes.lastInsertRowid);

    const insertBug = db.prepare(`
      INSERT INTO detected_bugs (
        scan_id, project_id, file_id, file_path, line_number, end_line_number,
        category, severity, priority_score, title, description,
        why_occurred, root_cause, potential_impact, suggested_solution,
        confidence_estimate, status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')
    `);

    const insertFix = db.prepare(`
      INSERT INTO suggested_fixes (
        bug_id, file_id, original_snippet, patched_snippet, patched_full_content,
        explanation, confidence_estimate, status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
    `);

    for (const b of normalizedBugs) {
      const bugRes = insertBug.run(
        scanId,
        projectId,
        b.fileId,
        b.filePath,
        b.lineNumber,
        b.endLineNumber,
        b.category,
        b.severity,
        b.priorityScore,
        b.title,
        b.description,
        b.whyOccurred,
        b.rootCause,
        b.potentialImpact,
        b.suggestedSolution,
        b.confidence
      );
      const bugId = Number(bugRes.lastInsertRowid);
      insertFix.run(
        bugId,
        b.fileId,
        b.originalSnippet || '',
        b.patchedSnippet || '',
        b.patchedFullContent || '',
        b.fixExplanation || b.suggestedSolution,
        b.confidence
      );
    }

    db.prepare("UPDATE projects SET updated_at = datetime('now') WHERE id = ?").run(projectId);
    db.prepare(`
      INSERT INTO change_history (project_id, file_path, action, actor_email, notes)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      projectId,
      files[0].file_path,
      useRepaired ? 'repaired_rescan_completed' : 'ai_scan_completed',
      req.user!.email,
      `Detected ${normalizedBugs.length} issue(s) using ${GEMINI_MODEL}`
    );

    res.json({
      scanId,
      totalBugs: normalizedBugs.length,
      summary: analysis.summary,
    });
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      db.prepare(`
        INSERT INTO scan_history (
          project_id, user_id, status, model_used, total_bugs, error_message
        )
        VALUES (?, ?, 'failed', ?, 0, ?)
      `).run(projectId, req.user!.userId, GEMINI_MODEL, err.message);
      res.status(503).json({
        code: 'AI_KEY_MISSING',
        error: err.message,
      });
      return;
    }

    const message = err instanceof Error ? err.message : 'AI scan failed unexpectedly.';
    db.prepare(`
      INSERT INTO scan_history (
        project_id, user_id, status, model_used, total_bugs, error_message
      )
      VALUES (?, ?, 'failed', ?, 0, ?)
    `).run(projectId, req.user!.userId, GEMINI_MODEL, message);

    res.status(500).json({ error: `AI scan error: ${message}` });
  }
});

// --- Explain My Code ---
app.post('/api/ai/explain', requireAuth, async (req: AuthenticatedRequest, res) => {
  const { fileId, selectedCode } = req.body ?? {};
  const file = db
    .prepare(`
      SELECT f.* FROM uploaded_files f
      INNER JOIN projects p ON f.project_id = p.id
      WHERE f.id = ? AND p.user_id = ?
    `)
    .get(Number(fileId), req.user!.userId) as
    | { id: number; file_path: string; language: string; original_content: string }
    | undefined;

  if (!file) {
    res.status(404).json({ error: 'File not found.' });
    return;
  }

  const snippet = String(selectedCode ?? '').trim();
  if (!snippet) {
    res.status(400).json({ error: 'Select a section of code in the editor first.' });
    return;
  }

  try {
    const explanation = await explainCodeWithGemini(
      file.file_path,
      file.language,
      snippet,
      file.original_content
    );
    res.json({ explanation });
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      res.status(503).json({ code: 'AI_KEY_MISSING', error: err.message });
      return;
    }
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to explain selected code.',
    });
  }
});

// --- Safe Repair Mode: Accept / Reject Fix ---
app.post('/api/fixes/:fixId/accept', requireAuth, (req: AuthenticatedRequest, res) => {
  const fixId = Number(req.params.fixId);
  const customPatchedContent =
    typeof req.body?.patchedContent === 'string' ? req.body.patchedContent : null;

  const row = db
    .prepare(`
      SELECT sf.*, b.project_id, b.title AS bug_title, f.file_path, f.original_content, f.repaired_content
      FROM suggested_fixes sf
      INNER JOIN detected_bugs b ON sf.bug_id = b.id
      INNER JOIN uploaded_files f ON sf.file_id = f.id
      INNER JOIN projects p ON b.project_id = p.id
      WHERE sf.id = ? AND p.user_id = ?
    `)
    .get(fixId, req.user!.userId) as
    | {
        id: number;
        bug_id: number;
        file_id: number;
        project_id: number;
        bug_title: string;
        file_path: string;
        original_snippet: string;
        patched_snippet: string;
        patched_full_content: string;
        original_content: string;
        repaired_content: string | null;
      }
    | undefined;

  if (!row) {
    res.status(404).json({ error: 'Suggested fix not found.' });
    return;
  }

  // Safe Repair Mode: Never overwrite original_content; only write to repaired_content
  let nextRepaired = customPatchedContent ?? row.patched_full_content;
  if (!nextRepaired && row.original_snippet && row.patched_snippet) {
    const base = row.repaired_content ?? row.original_content;
    nextRepaired = base.includes(row.original_snippet)
      ? base.replace(row.original_snippet, row.patched_snippet)
      : row.original_content;
  } else if (row.repaired_content && !customPatchedContent && row.original_snippet && row.patched_snippet) {
    if (row.repaired_content.includes(row.original_snippet)) {
      nextRepaired = row.repaired_content.replace(row.original_snippet, row.patched_snippet);
    }
  }

  db.prepare(
    "UPDATE suggested_fixes SET status = 'accepted', updated_at = datetime('now') WHERE id = ?"
  ).run(fixId);
  db.prepare("UPDATE detected_bugs SET status = 'fixed' WHERE id = ?").run(row.bug_id);
  db.prepare('UPDATE uploaded_files SET repaired_content = ? WHERE id = ?').run(
    nextRepaired,
    row.file_id
  );
  db.prepare("UPDATE projects SET updated_at = datetime('now') WHERE id = ?").run(row.project_id);

  db.prepare(`
    INSERT INTO change_history (project_id, bug_id, fix_id, file_path, action, actor_email, notes)
    VALUES (?, ?, ?, ?, 'fix_accepted', ?, ?)
  `).run(
    row.project_id,
    row.bug_id,
    fixId,
    row.file_path,
    req.user!.email,
    `Accepted Safe Repair patch for "${row.bug_title}" (original file preserved)`
  );

  res.json({ accepted: true, repairedContent: nextRepaired });
});

app.post('/api/fixes/:fixId/reject', requireAuth, (req: AuthenticatedRequest, res) => {
  const fixId = Number(req.params.fixId);
  const row = db
    .prepare(`
      SELECT sf.id, sf.bug_id, b.project_id, b.title AS bug_title, f.file_path
      FROM suggested_fixes sf
      INNER JOIN detected_bugs b ON sf.bug_id = b.id
      INNER JOIN uploaded_files f ON sf.file_id = f.id
      INNER JOIN projects p ON b.project_id = p.id
      WHERE sf.id = ? AND p.user_id = ?
    `)
    .get(fixId, req.user!.userId) as
    | { id: number; bug_id: number; project_id: number; bug_title: string; file_path: string }
    | undefined;

  if (!row) {
    res.status(404).json({ error: 'Suggested fix not found.' });
    return;
  }

  db.prepare(
    "UPDATE suggested_fixes SET status = 'rejected', updated_at = datetime('now') WHERE id = ?"
  ).run(fixId);
  db.prepare("UPDATE detected_bugs SET status = 'rejected' WHERE id = ?").run(row.bug_id);
  db.prepare(`
    INSERT INTO change_history (project_id, bug_id, fix_id, file_path, action, actor_email, notes)
    VALUES (?, ?, ?, ?, 'fix_rejected', ?, ?)
  `).run(
    row.project_id,
    row.bug_id,
    fixId,
    row.file_path,
    req.user!.email,
    `Rejected suggested fix for "${row.bug_title}"`
  );

  res.json({ rejected: true });
});

// --- Testing & Validation ---
app.post('/api/bugs/:bugId/run-tests', requireAuth, async (req: AuthenticatedRequest, res) => {
  const bugId = Number(req.params.bugId);
  const row = db
    .prepare(`
      SELECT
        b.*,
        f.language,
        f.original_content,
        f.repaired_content,
        sf.id AS fix_id,
        sf.patched_full_content
      FROM detected_bugs b
      INNER JOIN uploaded_files f ON b.file_id = f.id
      INNER JOIN projects p ON b.project_id = p.id
      LEFT JOIN suggested_fixes sf ON sf.bug_id = b.id
      WHERE b.id = ? AND p.user_id = ?
    `)
    .get(bugId, req.user!.userId) as
    | {
        id: number;
        project_id: number;
        file_path: string;
        language: string;
        title: string;
        description: string;
        original_content: string;
        repaired_content: string | null;
        fix_id: number | null;
        patched_full_content: string | null;
      }
    | undefined;

  if (!row) {
    res.status(404).json({ error: 'Bug record not found.' });
    return;
  }

  const candidatePatched = row.repaired_content || row.patched_full_content;
  if (!candidatePatched) {
    res.status(400).json({ error: 'No patched code is available for this bug yet.' });
    return;
  }

  try {
    const generated = await generateTestsWithGemini({
      filePath: row.file_path,
      language: row.language,
      originalContent: row.original_content,
      patchedContent: candidatePatched,
      bugTitle: row.title,
      bugDescription: row.description,
    });

    db.prepare('DELETE FROM test_results WHERE bug_id = ?').run(bugId);

    const insertTest = db.prepare(`
      INSERT INTO test_results (
        project_id, bug_id, fix_id, test_name, category, input_summary,
        expected_behavior, before_result, after_result, before_passed, after_passed, execution_mode
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const savedTests = [];
    for (const tc of generated) {
      const category =
        tc.category === 'invalid' || tc.category === 'boundary' ? tc.category : 'normal';

      if (row.language === 'javascript' && tc.jsAssertionExpression?.trim()) {
        const beforeRun = runJsSandboxTest(row.original_content, tc.jsAssertionExpression);
        const afterRun = runJsSandboxTest(candidatePatched, tc.jsAssertionExpression);

        const ins = insertTest.run(
          row.project_id,
          bugId,
          row.fix_id,
          tc.testName,
          category,
          tc.inputSummary,
          tc.expectedBehavior,
          beforeRun.output,
          afterRun.output,
          beforeRun.passed ? 1 : 0,
          afterRun.passed ? 1 : 0,
          'sandboxed_vm'
        );
        savedTests.push({
          id: Number(ins.lastInsertRowid),
          test_name: tc.testName,
          category,
          input_summary: tc.inputSummary,
          expected_behavior: tc.expectedBehavior,
          before_result: beforeRun.output,
          after_result: afterRun.output,
          before_passed: beforeRun.passed ? 1 : 0,
          after_passed: afterRun.passed ? 1 : 0,
          execution_mode: 'sandboxed_vm',
        });
      } else {
        // Non-JS languages are never executed directly on server (Requirement D & I):
        // mark transparently as static_trace_only with passed=0 so we never falsely claim execution verification.
        const ins = insertTest.run(
          row.project_id,
          bugId,
          row.fix_id,
          tc.testName,
          category,
          tc.inputSummary,
          tc.expectedBehavior,
          `Static trace (not executed on server): ${tc.predictedBeforeOutcome}`,
          `Static trace (not executed on server): ${tc.predictedAfterOutcome}`,
          0,
          0,
          'static_trace_only'
        );
        savedTests.push({
          id: Number(ins.lastInsertRowid),
          test_name: tc.testName,
          category,
          input_summary: tc.inputSummary,
          expected_behavior: tc.expectedBehavior,
          before_result: `Static trace (not executed on server): ${tc.predictedBeforeOutcome}`,
          after_result: `Static trace (not executed on server): ${tc.predictedAfterOutcome}`,
          before_passed: 0,
          after_passed: 0,
          execution_mode: 'static_trace_only',
        });
      }
    }

    db.prepare(`
      INSERT INTO change_history (project_id, bug_id, fix_id, file_path, action, actor_email, notes)
      VALUES (?, ?, ?, ?, 'validation_tests_generated', ?, ?)
    `).run(
      row.project_id,
      bugId,
      row.fix_id,
      row.file_path,
      req.user!.email,
      `Generated ${savedTests.length} test cases (${row.language === 'javascript' ? 'sandboxed VM execution' : 'static trace specification'})`
    );

    res.json({ tests: savedTests });
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      res.status(503).json({ code: 'AI_KEY_MISSING', error: err.message });
      return;
    }
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Test generation failed.',
    });
  }
});

// --- History & Downloads ---
app.get('/api/history', requireAuth, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.userId;

  const scans = db
    .prepare(`
      SELECT s.*, p.name AS project_name
      FROM scan_history s
      INNER JOIN projects p ON s.project_id = p.id
      WHERE s.user_id = ?
      ORDER BY s.scanned_at DESC, s.id DESC
    `)
    .all(userId);

  const changes = db
    .prepare(`
      SELECT c.*, p.name AS project_name
      FROM change_history c
      INNER JOIN projects p ON c.project_id = p.id
      WHERE p.user_id = ?
      ORDER BY c.created_at DESC, c.id DESC
      LIMIT 100
    `)
    .all(userId);

  res.json({ scans, changes });
});

app.get('/api/files/:fileId/download', requireAuth, (req: AuthenticatedRequest, res) => {
  const fileId = Number(req.params.fileId);
  const file = db
    .prepare(`
      SELECT f.* FROM uploaded_files f
      INNER JOIN projects p ON f.project_id = p.id
      WHERE f.id = ? AND p.user_id = ?
    `)
    .get(fileId, req.user!.userId) as
    | { file_path: string; original_content: string; repaired_content: string | null }
    | undefined;

  if (!file) {
    res.status(404).json({ error: 'File not found.' });
    return;
  }

  const filename = path.basename(file.file_path);
  const content = file.repaired_content ?? file.original_content;
  res.setHeader('Content-Disposition', `attachment; filename="repaired_${filename}"`);
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send(content);
});

app.get('/api/projects/:id/download-bundle', requireAuth, (req: AuthenticatedRequest, res) => {
  const projectId = Number(req.params.id);
  const project = db
    .prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?')
    .get(projectId, req.user!.userId) as { name: string } | undefined;

  if (!project) {
    res.status(404).json({ error: 'Project not found.' });
    return;
  }

  const files = db
    .prepare('SELECT file_path, original_content, repaired_content FROM uploaded_files WHERE project_id = ?')
    .all(projectId) as Array<{
    file_path: string;
    original_content: string;
    repaired_content: string | null;
  }>;

  const zip = new AdmZip();
  for (const f of files) {
    zip.addFile(f.file_path, Buffer.from(f.repaired_content ?? f.original_content, 'utf8'));
  }

  const safeName = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const buf = zip.toBuffer();
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}-repaired.zip"`);
  res.setHeader('Content-Type', 'application/zip');
  res.send(buf);
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AutoPatch AI server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();

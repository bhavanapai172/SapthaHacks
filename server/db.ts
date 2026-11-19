import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';
import { SAMPLE_PROJECTS } from './sampleProjects.ts';

const dbFilePath = process.env.DB_PATH || path.resolve(process.cwd(), 'data', 'autopatch.db');
fs.mkdirSync(path.dirname(dbFilePath), { recursive: true });

export const db = new DatabaseSync(dbFilePath);

db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'developer',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  primary_language TEXT NOT NULL DEFAULT 'mixed',
  source_type TEXT NOT NULL DEFAULT 'files',
  is_sample INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS uploaded_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  language TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  original_content TEXT NOT NULL,
  repaired_content TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS scan_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  status TEXT NOT NULL,
  model_used TEXT NOT NULL,
  total_bugs INTEGER NOT NULL DEFAULT 0,
  critical_count INTEGER NOT NULL DEFAULT 0,
  high_count INTEGER NOT NULL DEFAULT 0,
  medium_count INTEGER NOT NULL DEFAULT 0,
  low_count INTEGER NOT NULL DEFAULT 0,
  summary TEXT,
  error_message TEXT,
  scanned_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS detected_bugs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scan_id INTEGER NOT NULL,
  project_id INTEGER NOT NULL,
  file_id INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  line_number INTEGER NOT NULL,
  end_line_number INTEGER NOT NULL,
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  priority_score INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  why_occurred TEXT NOT NULL,
  root_cause TEXT NOT NULL,
  potential_impact TEXT NOT NULL,
  suggested_solution TEXT NOT NULL,
  confidence_estimate INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  FOREIGN KEY (scan_id) REFERENCES scan_history(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (file_id) REFERENCES uploaded_files(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS suggested_fixes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bug_id INTEGER NOT NULL,
  file_id INTEGER NOT NULL,
  original_snippet TEXT NOT NULL,
  patched_snippet TEXT NOT NULL,
  patched_full_content TEXT NOT NULL,
  explanation TEXT NOT NULL,
  confidence_estimate INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (bug_id) REFERENCES detected_bugs(id) ON DELETE CASCADE,
  FOREIGN KEY (file_id) REFERENCES uploaded_files(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS test_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  bug_id INTEGER NOT NULL,
  fix_id INTEGER,
  test_name TEXT NOT NULL,
  category TEXT NOT NULL,
  input_summary TEXT NOT NULL,
  expected_behavior TEXT NOT NULL,
  before_result TEXT NOT NULL,
  after_result TEXT NOT NULL,
  before_passed INTEGER NOT NULL DEFAULT 0,
  after_passed INTEGER NOT NULL DEFAULT 0,
  execution_mode TEXT NOT NULL,
  executed_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (bug_id) REFERENCES detected_bugs(id) ON DELETE CASCADE,
  FOREIGN KEY (fix_id) REFERENCES suggested_fixes(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS change_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  bug_id INTEGER,
  fix_id INTEGER,
  file_path TEXT NOT NULL,
  action TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
`);

export function seedSampleProjectsForUser(userId: number, userEmail: string): void {
  const insertProject = db.prepare(`
    INSERT INTO projects (user_id, name, description, primary_language, source_type, is_sample)
    VALUES (?, ?, ?, ?, 'sample', 1)
  `);
  const insertFile = db.prepare(`
    INSERT INTO uploaded_files (project_id, file_path, language, size_bytes, original_content)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertChange = db.prepare(`
    INSERT INTO change_history (project_id, file_path, action, actor_email, notes)
    VALUES (?, ?, 'project_seeded', ?, ?)
  `);

  for (const sample of SAMPLE_PROJECTS) {
    const res = insertProject.run(
      userId,
      sample.name,
      sample.description,
      sample.primaryLanguage
    );
    const projectId = Number(res.lastInsertRowid);
    for (const file of sample.files) {
      insertFile.run(
        projectId,
        file.filePath,
        file.language,
        Buffer.byteLength(file.content, 'utf8'),
        file.content
      );
    }
    insertChange.run(
      projectId,
      sample.files[0]?.filePath ?? 'root',
      userEmail,
      `Loaded demonstration project "${sample.name}" (${sample.files.length} files)`
    );
  }
}

export function ensureDemoAccount(): void {
  const demoEmail = 'dev@autopatch.ai';
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(demoEmail);
  if (!existing) {
    const hash = bcrypt.hashSync('AutoPatch2026!', 10);
    const res = db
      .prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
      .run('Demo Developer', demoEmail, hash, 'developer');
    const userId = Number(res.lastInsertRowid);
    seedSampleProjectsForUser(userId, demoEmail);
  }
}

ensureDemoAccount();

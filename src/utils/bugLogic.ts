import { diffLines } from 'diff';
import type { BugCategory, DetectedBug, Severity } from '../types';

export const ALLOWED_SOURCE_EXTENSIONS = new Set([
  '.py',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.java',
  '.c',
  '.cpp',
  '.cc',
  '.h',
  '.hpp',
  '.go',
  '.rs',
  '.rb',
  '.php',
  '.cs',
  '.sql',
  '.json',
]);

export const MAX_SINGLE_FILE_BYTES = 2 * 1024 * 1024; // 2 MB per source file
export const MAX_ZIP_BYTES = 10 * 1024 * 1024; // 10 MB per ZIP archive

export function getFileExtension(filename: string): string {
  const clean = filename.trim().toLowerCase();
  const lastDot = clean.lastIndexOf('.');
  if (lastDot <= 0) return '';
  return clean.slice(lastDot);
}

export function validateUploadFile(
  filename: string,
  sizeBytes: number
): { valid: boolean; isZip: boolean; error?: string } {
  if (!filename || filename.trim().length === 0) {
    return { valid: false, isZip: false, error: 'Filename cannot be empty.' };
  }
  if (sizeBytes <= 0) {
    return { valid: false, isZip: false, error: `File "${filename}" is empty (0 bytes).` };
  }

  const ext = getFileExtension(filename);
  if (ext === '.zip') {
    if (sizeBytes > MAX_ZIP_BYTES) {
      return {
        valid: false,
        isZip: true,
        error: `ZIP archive "${filename}" exceeds the 10 MB upload limit.`,
      };
    }
    return { valid: true, isZip: true };
  }

  if (!ALLOWED_SOURCE_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      isZip: false,
      error: `Unsupported file type "${ext || 'unknown'}" for "${filename}". Supported formats: Python, JS/TS, Java, C/C++, Go, Rust, SQL, JSON, or ZIP.`,
    };
  }

  if (sizeBytes > MAX_SINGLE_FILE_BYTES) {
    return {
      valid: false,
      isZip: false,
      error: `Source file "${filename}" exceeds the 2 MB single-file limit.`,
    };
  }

  return { valid: true, isZip: false };
}

export function detectLanguageFromPath(filePath: string): string {
  const ext = getFileExtension(filePath);
  switch (ext) {
    case '.py':
      return 'python';
    case '.js':
    case '.jsx':
    case '.mjs':
    case '.cjs':
      return 'javascript';
    case '.ts':
    case '.tsx':
      return 'typescript';
    case '.java':
      return 'java';
    case '.c':
    case '.h':
      return 'c';
    case '.cpp':
    case '.cc':
    case '.hpp':
      return 'cpp';
    case '.go':
      return 'go';
    case '.rs':
      return 'rust';
    case '.rb':
      return 'ruby';
    case '.php':
      return 'php';
    case '.cs':
      return 'csharp';
    case '.sql':
      return 'sql';
    case '.json':
      return 'json';
    default:
      return 'plaintext';
  }
}

const SEVERITY_WEIGHT: Record<Severity, number> = {
  critical: 100,
  high: 75,
  medium: 45,
  low: 20,
};

const CATEGORY_BONUS: Record<BugCategory, number> = {
  security: 18,
  runtime: 14,
  logical: 10,
  edge_case: 8,
  syntax: 12,
  pattern: 4,
};

export function calculatePriorityScore(
  severity: Severity,
  confidenceEstimate: number,
  category: BugCategory
): number {
  const base = SEVERITY_WEIGHT[severity] ?? 20;
  const cat = CATEGORY_BONUS[category] ?? 0;
  const clampedConfidence = Math.max(0, Math.min(100, confidenceEstimate));
  const confidenceFactor = Math.round(clampedConfidence * 0.15);
  return Math.min(130, base + cat + confidenceFactor);
}

export function prioritizeBugs<T extends Pick<DetectedBug, 'severity' | 'priority_score' | 'confidence_estimate' | 'line_number'>>(
  bugs: T[]
): T[] {
  return [...bugs].sort((a, b) => {
    if (b.priority_score !== a.priority_score) {
      return b.priority_score - a.priority_score;
    }
    const sevDiff = (SEVERITY_WEIGHT[b.severity] ?? 0) - (SEVERITY_WEIGHT[a.severity] ?? 0);
    if (sevDiff !== 0) return sevDiff;
    if (b.confidence_estimate !== a.confidence_estimate) {
      return b.confidence_estimate - a.confidence_estimate;
    }
    return a.line_number - b.line_number;
  });
}

export interface LineDiffStats {
  addedLines: number;
  removedLines: number;
  unchangedLines: number;
  hasChanges: boolean;
}

export function computeLineDiffStats(original: string, patched: string): LineDiffStats {
  const parts = diffLines(original, patched);
  let addedLines = 0;
  let removedLines = 0;
  let unchangedLines = 0;

  for (const part of parts) {
    const lineCount = part.count ?? part.value.split('\n').filter((l, idx, arr) => idx < arr.length - 1 || l.length > 0).length;
    if (part.added) {
      addedLines += lineCount;
    } else if (part.removed) {
      removedLines += lineCount;
    } else {
      unchangedLines += lineCount;
    }
  }

  return {
    addedLines,
    removedLines,
    unchangedLines,
    hasChanges: addedLines > 0 || removedLines > 0,
  };
}

export interface BeforeAfterMetrics {
  beforeCount: number;
  afterRemainingCount: number;
  fixedCount: number;
  rejectedCount: number;
  pendingCount: number;
  reductionPercent: number;
}

export function computeBeforeAfterMetrics(
  bugs: Array<Pick<DetectedBug, 'status'>>
): BeforeAfterMetrics {
  const beforeCount = bugs.length;
  const fixedCount = bugs.filter((b) => b.status === 'fixed').length;
  const rejectedCount = bugs.filter((b) => b.status === 'rejected').length;
  const afterRemainingCount = bugs.filter((b) => b.status !== 'fixed').length;
  const pendingCount = bugs.filter((b) => b.status === 'open').length;
  const reductionPercent =
    beforeCount > 0 ? Math.round((fixedCount / beforeCount) * 100) : 0;

  return {
    beforeCount,
    afterRemainingCount,
    fixedCount,
    rejectedCount,
    pendingCount,
    reductionPercent,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

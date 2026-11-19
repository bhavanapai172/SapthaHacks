import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculatePriorityScore,
  computeBeforeAfterMetrics,
  computeLineDiffStats,
  detectLanguageFromPath,
  formatBytes,
  prioritizeBugs,
  validateUploadFile,
} from './bugLogic';

test('validateUploadFile accepts supported source files and valid zips', () => {
  assert.deepEqual(validateUploadFile('ledger.py', 1024), { valid: true, isZip: false });
  assert.deepEqual(validateUploadFile('authMiddleware.ts', 4096), { valid: true, isZip: false });
  assert.deepEqual(validateUploadFile('bundle.zip', 500_000), { valid: true, isZip: true });
});

test('validateUploadFile rejects empty, oversized, and unsupported executable files', () => {
  const emptyRes = validateUploadFile('main.py', 0);
  assert.equal(emptyRes.valid, false);

  const exeRes = validateUploadFile('payload.exe', 1200);
  assert.equal(exeRes.valid, false);
  assert.match(exeRes.error ?? '', /Unsupported file type/);

  const hugeZip = validateUploadFile('archive.zip', 15 * 1024 * 1024);
  assert.equal(hugeZip.valid, false);
  assert.match(hugeZip.error ?? '', /10 MB/);
});

test('detectLanguageFromPath maps extensions to Monaco language identifiers', () => {
  assert.equal(detectLanguageFromPath('src/app.py'), 'python');
  assert.equal(detectLanguageFromPath('src/index.tsx'), 'typescript');
  assert.equal(detectLanguageFromPath('include/ring.hpp'), 'cpp');
  assert.equal(detectLanguageFromPath('Main.java'), 'java');
  assert.equal(detectLanguageFromPath('README.unknown'), 'plaintext');
});

test('calculatePriorityScore and prioritizeBugs rank critical security issues above low patterns', () => {
  const criticalSec = calculatePriorityScore('critical', 95, 'security');
  const highRuntime = calculatePriorityScore('high', 90, 'runtime');
  const lowPattern = calculatePriorityScore('low', 80, 'pattern');

  assert.ok(criticalSec > highRuntime);
  assert.ok(highRuntime > lowPattern);

  const ranked = prioritizeBugs([
    { severity: 'low', priority_score: lowPattern, confidence_estimate: 80, line_number: 5 },
    { severity: 'critical', priority_score: criticalSec, confidence_estimate: 95, line_number: 22 },
    { severity: 'high', priority_score: highRuntime, confidence_estimate: 90, line_number: 10 },
  ]);

  assert.equal(ranked[0].severity, 'critical');
  assert.equal(ranked[1].severity, 'high');
  assert.equal(ranked[2].severity, 'low');
});

test('computeLineDiffStats accurately counts added and removed lines', () => {
  const original = 'function div(a, b) {\n  return a / b;\n}\n';
  const patched = 'function div(a, b) {\n  if (b === 0) throw new Error("zero");\n  return a / b;\n}\n';
  const stats = computeLineDiffStats(original, patched);

  assert.equal(stats.hasChanges, true);
  assert.equal(stats.addedLines, 1);
  assert.equal(stats.removedLines, 0);
  assert.equal(stats.unchangedLines, 3);
});

test('computeBeforeAfterMetrics calculates remaining issues and percentage reduction', () => {
  const metrics = computeBeforeAfterMetrics([
    { status: 'fixed' },
    { status: 'fixed' },
    { status: 'open' },
    { status: 'rejected' },
  ]);

  assert.equal(metrics.beforeCount, 4);
  assert.equal(metrics.fixedCount, 2);
  assert.equal(metrics.rejectedCount, 1);
  assert.equal(metrics.pendingCount, 1);
  assert.equal(metrics.afterRemainingCount, 2);
  assert.equal(metrics.reductionPercent, 50);
});

test('formatBytes formats bytes, KB, and MB cleanly', () => {
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(2048), '2.0 KB');
  assert.equal(formatBytes(2 * 1024 * 1024), '2.00 MB');
});

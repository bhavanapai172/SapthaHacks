import { jsPDF } from 'jspdf';
import type { ProjectDetail } from '../types';
import { computeBeforeAfterMetrics } from './bugLogic';

export function exportProjectPdfReport(detail: ProjectDetail): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 44;
  const maxWidth = pageWidth - margin * 2;
  let y = 52;

  const ensureSpace = (needed: number) => {
    if (y + needed > doc.internal.pageSize.getHeight() - 50) {
      doc.addPage();
      y = 50;
    }
  };

  const writeWrapped = (
    text: string,
    fontSize: number,
    color: [number, number, number] = [30, 41, 59],
    bold = false
  ) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(fontSize);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(text, maxWidth) as string[];
    for (const line of lines) {
      ensureSpace(fontSize * 1.4);
      doc.text(line, margin, y);
      y += fontSize * 1.38;
    }
  };

  // Header Banner
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 86, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text('AutoPatch AI — Bug Analysis & Verification Report', margin, 38);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Project: ${detail.project.name}   |   Language: ${detail.project.primary_language}   |   Generated: ${new Date().toLocaleString()}`,
    margin,
    60
  );

  y = 112;
  const metrics = computeBeforeAfterMetrics(detail.bugs);

  writeWrapped('01. Executive Summary', 13, [15, 23, 42], true);
  y += 4;
  writeWrapped(
    `Files Analyzed: ${detail.files.length}  |  Total Bugs Detected: ${metrics.beforeCount}  |  Fixed (Safe Repair): ${metrics.fixedCount}  |  Remaining Open/Rejected: ${metrics.afterRemainingCount}  |  Issue Reduction: ${metrics.reductionPercent}%`,
    10,
    [51, 65, 85]
  );

  const latestScan = detail.scans[0];
  if (latestScan?.summary) {
    y += 4;
    writeWrapped(`Latest Scan Summary (${latestScan.scanned_at}): ${latestScan.summary}`, 10, [
      71,
      85,
      105,
    ]);
  }

  y += 12;
  writeWrapped('02. Detected Bugs & Root Cause Analysis', 13, [15, 23, 42], true);
  y += 4;

  if (detail.bugs.length === 0) {
    writeWrapped('No bugs recorded for the latest scan.', 10, [100, 116, 139]);
  } else {
    detail.bugs.forEach((bug, idx) => {
      ensureSpace(95);
      writeWrapped(
        `${idx + 1}. [${bug.severity.toUpperCase()}] ${bug.title} (${bug.file_path}:${bug.line_number}) — Status: ${bug.status.toUpperCase()}`,
        11,
        [15, 23, 42],
        true
      );
      writeWrapped(`Description: ${bug.description}`, 9.5, [51, 65, 85]);
      writeWrapped(`Why It Occurred: ${bug.why_occurred}`, 9.5, [51, 65, 85]);
      writeWrapped(`Root Cause: ${bug.root_cause}`, 9.5, [51, 65, 85]);
      writeWrapped(`Potential Impact: ${bug.potential_impact}`, 9.5, [51, 65, 85]);
      writeWrapped(
        `Suggested Solution (AI Confidence Estimate: ${bug.confidence_estimate}% — estimate, not proof): ${bug.suggested_solution}`,
        9.5,
        [30, 64, 175]
      );
      y += 8;
    });
  }

  if (detail.tests.length > 0) {
    y += 10;
    writeWrapped('03. Validation Test Results', 13, [15, 23, 42], true);
    y += 4;
    detail.tests.forEach((t, idx) => {
      ensureSpace(65);
      const modeLabel =
        t.execution_mode === 'sandboxed_vm'
          ? `Executed (Before: ${t.before_passed ? 'PASS' : 'FAIL'}, After: ${t.after_passed ? 'PASS' : 'FAIL'})`
          : 'Static Trace Only (Not Executed on Server)';
      writeWrapped(`${idx + 1}. ${t.test_name} [${t.category}] — ${modeLabel}`, 10, [15, 23, 42], true);
      writeWrapped(`Input: ${t.input_summary} | Expected: ${t.expected_behavior}`, 9, [71, 85, 105]);
      writeWrapped(`Before: ${t.before_result}`, 9, [153, 27, 27]);
      writeWrapped(`After: ${t.after_result}`, 9, [22, 101, 52]);
      y += 6;
    });
  }

  const safeName = detail.project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  doc.save(`${safeName}-autopatch-report.pdf`);
}

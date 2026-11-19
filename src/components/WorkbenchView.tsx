import { useEffect, useMemo, useRef, useState } from 'react';
import Editor, { DiffEditor } from '@monaco-editor/react';
import type * as MonacoNamespace from 'monaco-editor';
import {
  AlertTriangle,
  Check,
  Download,
  FileCode2,
  FileDown,
  FlaskConical,
  Loader2,
  RefreshCw,
  ScanSearch,
  Sparkles,
  X,
} from 'lucide-react';
import type {
  CodeExplanation,
  DetectedBug,
  ProjectDetail,
  ProjectSummary,
  Severity,
} from '../types';
import { ApiError, api } from '../utils/api';
import {
  computeBeforeAfterMetrics,
  computeLineDiffStats,
  formatBytes,
  prioritizeBugs,
} from '../utils/bugLogic';
import { ensureMonacoConfigured } from '../utils/monacoSetup';
import { exportProjectPdfReport } from '../utils/pdfReport';

interface WorkbenchViewProps {
  projectId: number | null;
  projects: ProjectSummary[];
  onSelectProject: (id: number) => void;
  onNavigateUpload: () => void;
  onDataMutated: () => Promise<void>;
}

type WorkbenchMode = 'editor' | 'diff' | 'tests';

const SEVERITY_TEXT: Record<Severity, string> = {
  critical: 'text-red-400',
  high: 'text-amber-400',
  medium: 'text-blue-400',
  low: 'text-purple-400',
};

export function WorkbenchView({
  projectId,
  projects,
  onSelectProject,
  onNavigateUpload,
  onDataMutated,
}: WorkbenchViewProps) {
  ensureMonacoConfigured();

  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [testing, setTesting] = useState(false);
  const [explaining, setExplaining] = useState(false);
  const [mutatingFixId, setMutatingFixId] = useState<number | null>(null);

  const [selectedFileId, setSelectedFileId] = useState<number | null>(null);
  const [selectedBugId, setSelectedBugId] = useState<number | null>(null);
  const [mode, setMode] = useState<WorkbenchMode>('editor');
  const [viewRepairedInEditor, setViewRepairedInEditor] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<CodeExplanation | null>(null);
  const [selectedSnippetLabel, setSelectedSnippetLabel] = useState<string>('');

  const editorRef = useRef<MonacoNamespace.editor.IStandaloneCodeEditor | null>(null);

  const loadDetail = async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getProjectDetail(id);
      setDetail(data);
      if (data.files.length > 0) {
        setSelectedFileId((prev) =>
          prev && data.files.some((f) => f.id === prev) ? prev : data.files[0].id
        );
      } else {
        setSelectedFileId(null);
      }
      const ordered = prioritizeBugs(data.bugs);
      if (ordered.length > 0) {
        const nextBug = ordered.find((b) => b.id === selectedBugId) ?? ordered[0];
        setSelectedBugId(nextBug.id);
        setSelectedFileId(nextBug.file_id);
      } else {
        setSelectedBugId(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      setExplanation(null);
      setViewRepairedInEditor(false);
      loadDetail(projectId);
    } else {
      setDetail(null);
    }
  }, [projectId]);

  const rankedBugs = useMemo(() => {
    return detail ? prioritizeBugs(detail.bugs) : [];
  }, [detail]);

  const selectedBug: DetectedBug | null = useMemo(() => {
    return rankedBugs.find((b) => b.id === selectedBugId) ?? rankedBugs[0] ?? null;
  }, [rankedBugs, selectedBugId]);

  const activeFile = useMemo(() => {
    if (!detail) return null;
    return detail.files.find((f) => f.id === selectedFileId) ?? detail.files[0] ?? null;
  }, [detail, selectedFileId]);

  const beforeAfter = useMemo(() => {
    return computeBeforeAfterMetrics(rankedBugs);
  }, [rankedBugs]);

  const activeFileRepairedDraft = useMemo(() => {
    if (!activeFile) return '';
    if (selectedBug && selectedBug.file_id === activeFile.id && selectedBug.fix?.patched_full_content) {
      return activeFile.repaired_content || selectedBug.fix.patched_full_content;
    }
    return activeFile.repaired_content || activeFile.original_content;
  }, [activeFile, selectedBug]);

  const diffStats = useMemo(() => {
    if (!activeFile) return null;
    return computeLineDiffStats(activeFile.original_content, activeFileRepairedDraft);
  }, [activeFile, activeFileRepairedDraft]);

  const bugTests = useMemo(() => {
    if (!detail || !selectedBug) return [];
    return detail.tests.filter((t) => t.bug_id === selectedBug.id);
  }, [detail, selectedBug]);

  const handleSelectBug = (bug: DetectedBug) => {
    setSelectedBugId(bug.id);
    setSelectedFileId(bug.file_id);
    if (mode === 'editor' && editorRef.current) {
      setTimeout(() => {
        editorRef.current?.revealLineInCenter(bug.line_number);
        editorRef.current?.setPosition({ lineNumber: bug.line_number, column: 1 });
      }, 60);
    }
  };

  const handleRunScan = async (useRepaired = false) => {
    if (!detail) return;
    setScanning(true);
    setError(null);
    try {
      await api.scanProject(detail.project.id, useRepaired);
      await loadDetail(detail.project.id);
      await onDataMutated();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'AI_KEY_MISSING') {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Scan failed.');
      }
    } finally {
      setScanning(false);
    }
  };

  const handleExplainSelected = async () => {
    if (!activeFile) return;
    let snippet = '';
    if (editorRef.current) {
      const sel = editorRef.current.getSelection();
      const model = editorRef.current.getModel();
      if (sel && model && !sel.isEmpty()) {
        snippet = model.getValueInRange(sel);
      }
    }
    if (!snippet.trim()) {
      // Fallback: if user hasn't dragged a selection yet, explain the active bug snippet or top 25 lines
      if (selectedBug?.fix?.original_snippet) {
        snippet = selectedBug.fix.original_snippet;
        setSelectedSnippetLabel(`Bug #${selectedBug.line_number} snippet`);
      } else {
        snippet = activeFile.original_content.split('\n').slice(0, 25).join('\n');
        setSelectedSnippetLabel(`${activeFile.file_path} (lines 1–25)`);
      }
    } else {
      setSelectedSnippetLabel(`Selected lines in ${activeFile.file_path}`);
    }

    setExplaining(true);
    setError(null);
    try {
      const res = await api.explainCode(activeFile.id, snippet);
      setExplanation(res.explanation);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not explain selected code.');
    } finally {
      setExplaining(false);
    }
  };

  const handleAcceptFix = async (fixId: number) => {
    if (!detail) return;
    setMutatingFixId(fixId);
    setError(null);
    try {
      await api.acceptFix(fixId);
      await loadDetail(detail.project.id);
      await onDataMutated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not apply fix.');
    } finally {
      setMutatingFixId(null);
    }
  };

  const handleRejectFix = async (fixId: number) => {
    if (!detail) return;
    setMutatingFixId(fixId);
    setError(null);
    try {
      await api.rejectFix(fixId);
      await loadDetail(detail.project.id);
      await onDataMutated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reject fix.');
    } finally {
      setMutatingFixId(null);
    }
  };

  const handleRunTests = async () => {
    if (!detail || !selectedBug) return;
    setTesting(true);
    setError(null);
    try {
      await api.runBugTests(selectedBug.id);
      await loadDetail(detail.project.id);
      await onDataMutated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test generation failed.');
    } finally {
      setTesting(false);
    }
  };

  if (!projectId) {
    return (
      <div className="mx-auto max-w-4xl rounded-xl border border-slate-800 bg-[#0D1322] p-8">
        <h2 className="font-display text-lg font-semibold text-white">
          Select a Project to Inspect
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Choose one of your uploaded or demonstration projects below to open the Monaco Code
          Workbench.
        </p>

        {projects.length === 0 ? (
          <button
            type="button"
            onClick={onNavigateUpload}
            className="mt-5 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-500"
          >
            Upload or Load Sample Project
          </button>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {projects.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelectProject(p.id)}
                className="flex flex-col items-start rounded-xl border border-slate-800 bg-[#070B14] p-4 text-left transition-colors hover:border-blue-500/60"
              >
                <span className="font-display text-sm font-semibold text-white">{p.name}</span>
                <span className="mt-1 text-xs text-slate-400">
                  {p.primary_language} · {p.file_count} files
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (loading && !detail) {
    return (
      <div className="flex h-96 items-center justify-center rounded-xl border border-slate-800 bg-[#0D1322]">
        <div className="flex items-center gap-3 text-sm text-slate-300">
          <Loader2 className="h-5 w-5 animate-spin text-blue-400" aria-hidden="true" />
          <span>Loading project workspace...</span>
        </div>
      </div>
    );
  }

  if (!detail) return null;

  const hasAnyRepairedFile = detail.files.some((f) => Boolean(f.repaired_content));

  return (
    <div className="space-y-4">
      {/* Top Action Bar */}
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-800 bg-[#0D1322] p-4 xl:flex-row xl:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-display text-lg font-bold text-white">{detail.project.name}</h2>
            <span className="text-xs text-slate-400">
              {detail.project.primary_language} · {detail.files.length} files · Safe Repair Mode
            </span>
          </div>
          {rankedBugs.length > 0 && (
            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-slate-300 tabular-nums">
              <span>
                Initial Issues: <strong className="text-white">{beforeAfter.beforeCount}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Resolved:{' '}
                <strong className="text-emerald-400">{beforeAfter.fixedCount}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Remaining:{' '}
                <strong className="text-amber-400">{beforeAfter.afterRemainingCount}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Reduction:{' '}
                <strong className="text-blue-400">{beforeAfter.reductionPercent}%</strong>
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={scanning}
            onClick={() => handleRunScan(false)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-60 whitespace-nowrap"
          >
            {scanning ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <ScanSearch className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>{scanning ? 'Scanning Code...' : 'Run AI Scan'}</span>
          </button>

          {hasAnyRepairedFile && (
            <button
              type="button"
              disabled={scanning}
              onClick={() => handleRunScan(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-purple-500/40 bg-purple-600/15 px-3.5 py-2 text-xs font-semibold text-purple-200 transition-colors hover:bg-purple-600/30 disabled:opacity-60 whitespace-nowrap"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Re-Scan Repaired</span>
            </button>
          )}

          <button
            type="button"
            disabled={explaining || !activeFile}
            onClick={handleExplainSelected}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-[#070B14] px-3.5 py-2 text-xs font-semibold text-slate-200 transition-colors hover:border-blue-500/60 hover:text-white disabled:opacity-60 whitespace-nowrap"
          >
            {explaining ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 text-purple-400" aria-hidden="true" />
            )}
            <span>Explain My Code</span>
          </button>

          <button
            type="button"
            onClick={() => api.downloadProjectBundle(detail.project.id, detail.project.name)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#070B14] px-3 py-2 text-xs font-medium text-slate-200 hover:border-slate-500 hover:text-white whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Download ZIP</span>
          </button>

          <button
            type="button"
            onClick={() => exportProjectPdfReport(detail)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#070B14] px-3 py-2 text-xs font-medium text-slate-200 hover:border-slate-500 hover:text-white whitespace-nowrap"
          >
            <FileDown className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-500/40 bg-red-950/35 p-4 text-xs text-red-200"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden="true" />
          <div className="flex-1">{error}</div>
          <button
            type="button"
            aria-label="Dismiss error"
            onClick={() => setError(null)}
            className="text-red-300 hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Explain My Code Panel */}
      {explanation && (
        <section
          aria-label="Code Explanation"
          className="rounded-xl border border-purple-500/40 bg-[#0D1322] p-5"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-display text-sm font-semibold text-white">
                Explain My Code · <span className="font-mono text-purple-300">{selectedSnippetLabel}</span>
              </h3>
              <p className="mt-1.5 text-sm text-slate-200">{explanation.summary}</p>
            </div>
            <button
              type="button"
              aria-label="Close code explanation"
              onClick={() => setExplanation(null)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <h4 className="text-xs font-semibold text-blue-400">Step-by-Step Walkthrough</h4>
              <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-xs text-slate-300">
                {explanation.stepByStep.map((s, idx) => (
                  <li key={idx}>{s}</li>
                ))}
              </ol>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-amber-400">Potential Pitfalls</h4>
              <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs text-slate-300">
                {explanation.potentialPitfalls.map((p, idx) => (
                  <li key={idx}>{p}</li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-slate-400">
                <strong className="text-slate-200">Complexity:</strong> {explanation.complexityNote}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Main 3-Pane Workbench Grid */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[220px_minmax(0,1fr)_360px]">
        {/* Left File Tree */}
        <aside className="rounded-xl border border-slate-800 bg-[#0D1322] p-3">
          <div className="px-2 pb-2 text-xs font-semibold text-slate-400">Project Files</div>
          <ul className="space-y-1">
            {detail.files.map((file) => {
              const active = activeFile?.id === file.id;
              const fileBugCount = rankedBugs.filter(
                (b) => b.file_id === file.id && b.status === 'open'
              ).length;
              return (
                <li key={file.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedFileId(file.id)}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
                      active
                        ? 'bg-blue-600/15 text-blue-300 border border-blue-500/30'
                        : 'text-slate-300 hover:bg-slate-800/60 border border-transparent'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <FileCode2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate font-mono">{file.file_path}</span>
                    </div>
                    <span className="shrink-0 font-mono text-[11px] tabular-nums text-slate-400">
                      {file.repaired_content ? 'patched' : fileBugCount > 0 ? fileBugCount : ''}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {activeFile && (
            <div className="mt-4 border-t border-slate-800 px-2 pt-3 text-[11px] text-slate-400">
              <div>Size: {formatBytes(activeFile.size_bytes)}</div>
              <div className="mt-1">Language: {activeFile.language}</div>
              <button
                type="button"
                onClick={() => api.downloadFile(activeFile.id, activeFile.file_path)}
                className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-slate-700 bg-[#070B14] px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:border-blue-500/60 hover:text-white"
              >
                <Download className="h-3 w-3" aria-hidden="true" />
                <span>Download File</span>
              </button>
            </div>
          )}
        </aside>

        {/* Center Monaco Editor / Diff / Validation Pane */}
        <section className="flex min-w-0 flex-col rounded-xl border border-slate-800 bg-[#0D1322]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-2.5">
            <div role="tablist" aria-label="Workbench view modes" className="flex items-center gap-1 rounded-lg bg-[#070B14] p-1 border border-slate-800">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'editor'}
                onClick={() => setMode('editor')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  mode === 'editor'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Source Editor
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'diff'}
                onClick={() => setMode('diff')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  mode === 'diff'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Side-by-Side Diff
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'tests'}
                onClick={() => setMode('tests')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  mode === 'tests'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Testing & Validation
              </button>
            </div>

            {mode === 'editor' && activeFile?.repaired_content && (
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setViewRepairedInEditor(false)}
                  className={`rounded px-2.5 py-1 font-medium ${
                    !viewRepairedInEditor
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Original
                </button>
                <button
                  type="button"
                  onClick={() => setViewRepairedInEditor(true)}
                  className={`rounded px-2.5 py-1 font-medium ${
                    viewRepairedInEditor
                      ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Repaired Draft
                </button>
              </div>
            )}

            {mode === 'diff' && diffStats && (
              <div className="flex items-center gap-3 font-mono text-xs tabular-nums">
                <span className="text-emerald-400">+{diffStats.addedLines} added</span>
                <span className="text-red-400">-{diffStats.removedLines} removed</span>
              </div>
            )}
          </div>

          {/* Center Content Body */}
          {mode === 'editor' && activeFile && (
            <div className="h-[520px] w-full overflow-hidden rounded-b-xl">
              <Editor
                height="520px"
                language={activeFile.language}
                value={
                  viewRepairedInEditor && activeFile.repaired_content
                    ? activeFile.repaired_content
                    : activeFile.original_content
                }
                theme="autopatch-obsidian"
                onMount={(editor) => {
                  editorRef.current = editor;
                }}
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  fontSize: 13,
                  fontFamily: 'JetBrains Mono, monospace',
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  padding: { top: 14, bottom: 14 },
                  wordWrap: 'on',
                }}
              />
            </div>
          )}

          {mode === 'diff' && activeFile && (
            <div className="flex flex-col">
              <div className="grid grid-cols-2 border-b border-slate-800 bg-[#070B14] px-4 py-2 text-xs text-slate-400">
                <div>LEFT: Original Code ({activeFile.file_path})</div>
                <div>RIGHT: AI-Corrected Code (Safe Repair Draft)</div>
              </div>
              <div className="h-[440px] w-full overflow-hidden">
                <DiffEditor
                  height="440px"
                  language={activeFile.language}
                  original={activeFile.original_content}
                  modified={activeFileRepairedDraft}
                  keepCurrentOriginalModel
                  keepCurrentModifiedModel
                  theme="autopatch-obsidian"
                  options={{
                    readOnly: true,
                    renderSideBySide: true,
                    minimap: { enabled: false },
                    fontSize: 12.5,
                    fontFamily: 'JetBrains Mono, monospace',
                    scrollBeyondLastLine: false,
                  }}
                />
              </div>

              {selectedBug?.fix && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 bg-[#070B14] px-4 py-3">
                  <div className="text-xs text-slate-300">
                    <span className="font-semibold text-white">Selected Fix:</span>{' '}
                    {selectedBug.title}{' '}
                    <span className="text-slate-400">
                      (Status: {selectedBug.fix.status.toUpperCase()})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={
                        mutatingFixId === selectedBug.fix.id ||
                        selectedBug.fix.status === 'accepted'
                      }
                      onClick={() => handleAcceptFix(selectedBug.fix!.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>
                        {selectedBug.fix.status === 'accepted' ? 'Fix Accepted' : 'Accept Fix'}
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={
                        mutatingFixId === selectedBug.fix.id ||
                        selectedBug.fix.status === 'rejected'
                      }
                      onClick={() => handleRejectFix(selectedBug.fix!.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-950/30 px-3.5 py-1.5 text-xs font-semibold text-red-200 hover:bg-red-900/40 disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Reject Fix</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {mode === 'tests' && (
            <div className="flex min-h-[520px] flex-col p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <h3 className="font-display text-sm font-semibold text-white">
                    Before & After Validation Suite
                  </h3>
                  <p className="mt-1 text-xs text-slate-400">
                    Generates normal, invalid, and boundary test cases. JavaScript tests execute
                    inside an isolated VM sandbox; compiled/Python files show transparent dry-run
                    traces without host execution.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={testing || !selectedBug}
                  onClick={handleRunTests}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50 whitespace-nowrap"
                >
                  {testing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  <span>{testing ? 'Generating & Running...' : 'Generate & Run Tests'}</span>
                </button>
              </div>

              {!selectedBug ? (
                <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
                  Run an AI scan first to select a bug and generate validation tests.
                </div>
              ) : bugTests.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center text-center">
                  <FlaskConical className="h-9 w-9 text-slate-500" aria-hidden="true" />
                  <p className="mt-3 text-sm font-medium text-slate-300">
                    No validation tests run for "{selectedBug.title}" yet
                  </p>
                  <p className="mt-1 max-w-md text-xs text-slate-400">
                    Click "Generate & Run Tests" above to compare original vs. patched behavior
                    across normal, invalid, and boundary inputs.
                  </p>
                </div>
              ) : (
                <div className="mt-4 space-y-3 overflow-y-auto">
                  {bugTests.map((t) => {
                    const isExecuted = t.execution_mode === 'sandboxed_vm';
                    return (
                      <div
                        key={t.id}
                        className="rounded-lg border border-slate-800 bg-[#070B14] p-3.5 text-xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-semibold text-white">
                            {t.test_name}{' '}
                            <span className="ml-1.5 font-normal capitalize text-slate-400">
                              · {t.category}
                            </span>
                          </div>
                          <span
                            className={`font-mono text-[11px] ${
                              isExecuted
                                ? t.after_passed
                                  ? 'text-emerald-400'
                                  : 'text-red-400'
                                : 'text-amber-300'
                            }`}
                          >
                            {isExecuted
                              ? t.after_passed
                                ? 'Verified in VM Sandbox'
                                : 'Sandbox Assertion Failed'
                              : 'Static Trace (Not Executed on Server)'}
                          </span>
                        </div>
                        <div className="mt-1.5 text-slate-400">
                          Input: <span className="font-mono text-slate-300">{t.input_summary}</span>
                        </div>
                        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <div className="rounded border border-slate-800 bg-[#0D1322] p-2">
                            <div className="font-semibold text-slate-300">
                              Before Fix{' '}
                              {isExecuted && (
                                <span
                                  className={t.before_passed ? 'text-emerald-400' : 'text-red-400'}
                                >
                                  ({t.before_passed ? 'PASS' : 'FAIL'})
                                </span>
                              )}
                            </div>
                            <div className="mt-1 text-slate-400">{t.before_result}</div>
                          </div>
                          <div className="rounded border border-slate-800 bg-[#0D1322] p-2">
                            <div className="font-semibold text-slate-300">
                              After Fix{' '}
                              {isExecuted && (
                                <span
                                  className={t.after_passed ? 'text-emerald-400' : 'text-red-400'}
                                >
                                  ({t.after_passed ? 'PASS' : 'FAIL'})
                                </span>
                              )}
                            </div>
                            <div className="mt-1 text-slate-400">{t.after_result}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Right Panel: Prioritized Bugs & Root Cause Analysis */}
        <aside className="flex flex-col gap-4">
          <div className="rounded-xl border border-slate-800 bg-[#0D1322] p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold text-white">
                Prioritized Bug List ({rankedBugs.length})
              </h3>
              <span className="text-[11px] text-slate-400">Ranked by severity & impact</span>
            </div>

            {rankedBugs.length === 0 ? (
              <div className="mt-4 rounded-lg border border-dashed border-slate-800 bg-[#070B14] p-5 text-center text-xs text-slate-400">
                No scan findings yet. Click <strong className="text-white">Run AI Scan</strong> to
                analyze this project with Gemini.
              </div>
            ) : (
              <ul className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
                {rankedBugs.map((bug) => {
                  const active = selectedBug?.id === bug.id;
                  return (
                    <li key={bug.id}>
                      <button
                        type="button"
                        onClick={() => handleSelectBug(bug)}
                        className={`w-full rounded-lg border p-3 text-left transition-colors ${
                          active
                            ? 'border-blue-500/60 bg-blue-600/10'
                            : 'border-slate-800 bg-[#070B14] hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <span className={`font-semibold uppercase ${SEVERITY_TEXT[bug.severity]}`}>
                            {bug.severity} · {bug.category.replace('_', ' ')}
                          </span>
                          <span className="font-mono text-slate-400 tabular-nums">
                            Score {bug.priority_score}
                          </span>
                        </div>
                        <div className="mt-1 text-xs font-semibold text-white">{bug.title}</div>
                        <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                          <span className="truncate font-mono">
                            {bug.file_path}:{bug.line_number}
                          </span>
                          <span
                            className={
                              bug.status === 'fixed'
                                ? 'text-emerald-400'
                                : bug.status === 'rejected'
                                  ? 'text-red-400'
                                  : 'text-slate-400'
                            }
                          >
                            {bug.status}
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Root Cause Analysis Detail */}
          {selectedBug && (
            <div className="rounded-xl border border-slate-800 bg-[#0D1322] p-4 text-xs">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className={`font-semibold uppercase ${SEVERITY_TEXT[selectedBug.severity]}`}>
                    {selectedBug.severity}
                  </span>
                  <span className="mx-1.5 text-slate-500">·</span>
                  <span className="font-mono text-slate-400">
                    {selectedBug.file_path}:{selectedBug.line_number}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFileId(selectedBug.file_id);
                    setMode('diff');
                  }}
                  className="text-xs font-semibold text-blue-400 hover:text-blue-300 whitespace-nowrap"
                >
                  Compare Fix →
                </button>
              </div>

              <h3 className="mt-2 font-display text-base font-semibold text-white">
                {selectedBug.title}
              </h3>
              <p className="mt-1.5 leading-relaxed text-slate-300">{selectedBug.description}</p>

              <div className="mt-4 space-y-3 border-t border-slate-800 pt-3">
                <div>
                  <div className="font-semibold text-slate-200">Why It Occurred</div>
                  <p className="mt-0.5 leading-relaxed text-slate-400">
                    {selectedBug.why_occurred}
                  </p>
                </div>
                <div>
                  <div className="font-semibold text-slate-200">Root Cause</div>
                  <p className="mt-0.5 leading-relaxed text-slate-400">{selectedBug.root_cause}</p>
                </div>
                <div>
                  <div className="font-semibold text-slate-200">Potential Impact</div>
                  <p className="mt-0.5 leading-relaxed text-slate-400">
                    {selectedBug.potential_impact}
                  </p>
                </div>
                <div>
                  <div className="font-semibold text-blue-400">Suggested Solution</div>
                  <p className="mt-0.5 leading-relaxed text-slate-300">
                    {selectedBug.suggested_solution}
                  </p>
                </div>
              </div>

              {/* Fix Confidence Indicator */}
              <div className="mt-4 rounded-lg border border-slate-800 bg-[#070B14] p-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">Fix Confidence Estimate</span>
                  <span className="font-mono font-semibold text-blue-400 tabular-nums">
                    {selectedBug.confidence_estimate}%
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-blue-500"
                    style={{ width: `${selectedBug.confidence_estimate}%` }}
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-slate-400">
                  AI confidence estimate only — not proof of correctness. Review diff and run
                  validation tests before deploying.
                </p>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

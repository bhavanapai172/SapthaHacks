import { useEffect, useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import type { ChangeHistoryEntry, ProjectSummary, ScanRecord } from '../types';
import { api } from '../utils/api';
import { exportProjectPdfReport } from '../utils/pdfReport';

interface HistoryReportsViewProps {
  projects: ProjectSummary[];
  onOpenProject: (projectId: number) => void;
}

export function HistoryReportsView({
  projects,
  onOpenProject,
}: HistoryReportsViewProps) {
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [changes, setChanges] = useState<ChangeHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportingId, setExportingId] = useState<number | null>(null);
  const [filterProjectId, setFilterProjectId] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const res = await api.getHistory();
        if (!active) return;
        setScans(res.scans);
        setChanges(res.changes);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Failed to load history.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleExportPdf = async (projectId: number) => {
    setExportingId(projectId);
    setError(null);
    try {
      const detail = await api.getProjectDetail(projectId);
      exportProjectPdfReport(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not export PDF report.');
    } finally {
      setExportingId(null);
    }
  };

  const filteredScans =
    filterProjectId === 'all'
      ? scans
      : scans.filter((s) => String(s.project_id) === filterProjectId);

  const filteredChanges =
    filterProjectId === 'all'
      ? changes
      : changes.filter((c) => String(c.project_id) === filterProjectId);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-slate-800 bg-[#0D1322]">
        <Loader2 className="h-5 w-5 animate-spin text-blue-400" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-800 bg-[#0D1322] p-5 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-display text-lg font-semibold text-white">
            Scan History, Audit Log & PDF Reports
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Track every AI scan, accepted repair, rejected suggestion, and validation run.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label htmlFor="history-project-filter" className="text-xs text-slate-400">
            Filter Project:
          </label>
          <select
            id="history-project-filter"
            value={filterProjectId}
            onChange={(e) => setFilterProjectId(e.target.value)}
            className="rounded-lg border border-slate-700 bg-[#070B14] px-3 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none"
          >
            <option value="all">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-500/40 bg-red-950/35 p-4 text-xs text-red-200"
        >
          {error}
        </div>
      )}

      {/* Exportable Project Reports */}
      <section className="rounded-xl border border-slate-800 bg-[#0D1322] p-6">
        <h3 className="font-display text-base font-semibold text-white">
          Downloadable Bug & Verification Reports (PDF)
        </h3>
        {projects.length === 0 ? (
          <p className="mt-3 text-xs text-slate-400">No projects available to export yet.</p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-[#070B14] p-3.5"
              >
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => onOpenProject(p.id)}
                    className="truncate text-left font-display text-sm font-semibold text-white hover:text-blue-400"
                  >
                    {p.name}
                  </button>
                  <div className="mt-0.5 text-[11px] text-slate-400 tabular-nums">
                    {p.total_bugs ?? 0} bugs · {p.fixed_bugs ?? 0} fixed
                  </div>
                </div>
                <button
                  type="button"
                  disabled={exportingId === p.id}
                  onClick={() => handleExportPdf(p.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#0D1322] px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-blue-500/60 hover:text-white whitespace-nowrap shrink-0"
                >
                  {exportingId === p.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <FileDown className="h-3.5 w-3.5 text-blue-400" aria-hidden="true" />
                  )}
                  <span>PDF</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Scan History Table */}
      <section className="rounded-xl border border-slate-800 bg-[#0D1322] p-6">
        <h3 className="font-display text-base font-semibold text-white">Scan Execution Log</h3>
        {filteredScans.length === 0 ? (
          <p className="mt-3 text-xs text-slate-400">No scans recorded for this selection.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="pb-2.5 pr-4 font-medium">Project</th>
                  <th className="pb-2.5 pr-4 font-medium">Status</th>
                  <th className="pb-2.5 pr-4 font-medium text-right">Critical</th>
                  <th className="pb-2.5 pr-4 font-medium text-right">High</th>
                  <th className="pb-2.5 pr-4 font-medium text-right">Medium</th>
                  <th className="pb-2.5 pr-4 font-medium text-right">Low</th>
                  <th className="pb-2.5 pr-4 font-medium">Summary / Error</th>
                  <th className="pb-2.5 font-medium">Scanned At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-slate-300">
                {filteredScans.map((s) => (
                  <tr key={s.id}>
                    <td className="py-3 pr-4 font-medium text-white">
                      <button
                        type="button"
                        onClick={() => onOpenProject(s.project_id)}
                        className="hover:text-blue-400"
                      >
                        {s.project_name || `Project #${s.project_id}`}
                      </button>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={s.status === 'completed' ? 'text-emerald-400' : 'text-red-400'}>
                        {s.status}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums text-red-400">
                      {s.critical_count}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums text-amber-400">
                      {s.high_count}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums text-blue-400">
                      {s.medium_count}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums text-purple-400">
                      {s.low_count}
                    </td>
                    <td className="max-w-xs truncate py-3 pr-4 text-slate-400">
                      {s.error_message || s.summary || '—'}
                    </td>
                    <td className="py-3 font-mono tabular-nums text-slate-400">{s.scanned_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Change History Audit Log */}
      <section className="rounded-xl border border-slate-800 bg-[#0D1322] p-6">
        <h3 className="font-display text-base font-semibold text-white">
          Change & Repair Audit Trail
        </h3>
        {filteredChanges.length === 0 ? (
          <p className="mt-3 text-xs text-slate-400">No changes logged yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="pb-2.5 pr-4 font-medium">Action</th>
                  <th className="pb-2.5 pr-4 font-medium">Project</th>
                  <th className="pb-2.5 pr-4 font-medium">File</th>
                  <th className="pb-2.5 pr-4 font-medium">Notes</th>
                  <th className="pb-2.5 font-medium">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-slate-300">
                {filteredChanges.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2.5 pr-4 font-mono text-blue-300">{c.action}</td>
                    <td className="py-2.5 pr-4 font-medium text-white">
                      {c.project_name || `Project #${c.project_id}`}
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-slate-400">{c.file_path}</td>
                    <td className="py-2.5 pr-4 text-slate-300">{c.notes}</td>
                    <td className="py-2.5 font-mono tabular-nums text-slate-400">{c.created_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

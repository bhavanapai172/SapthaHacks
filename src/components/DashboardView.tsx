import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FolderCode,
  FolderUp,
  Play,
  ShieldAlert,
} from 'lucide-react';
import type { DashboardStats } from '../types';

interface DashboardViewProps {
  stats: DashboardStats | null;
  loading: boolean;
  error: string | null;
  onOpenProject: (projectId: number) => void;
  onNavigateUpload: () => void;
  onRetry: () => void;
}

export function DashboardView({
  stats,
  loading,
  error,
  onOpenProject,
  onNavigateUpload,
  onRetry,
}: DashboardViewProps) {
  if (loading && !stats) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="h-28 animate-pulse rounded-xl border border-slate-800 bg-[#0D1322]"
            />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-xl border border-slate-800 bg-[#0D1322]" />
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="rounded-xl border border-red-500/40 bg-red-950/30 p-6 text-sm text-red-200">
        <p className="font-semibold">Unable to load dashboard metrics</p>
        <p className="mt-1 text-red-300">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-500"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!stats) return null;

  const { severityBreakdown } = stats;
  const totalSeverityCount =
    severityBreakdown.critical +
    severityBreakdown.high +
    severityBreakdown.medium +
    severityBreakdown.low;

  const severityRows = [
    {
      label: 'Critical',
      count: severityBreakdown.critical,
      barColor: 'bg-red-500',
      textColor: 'text-red-400',
    },
    {
      label: 'High',
      count: severityBreakdown.high,
      barColor: 'bg-amber-500',
      textColor: 'text-amber-400',
    },
    {
      label: 'Medium',
      count: severityBreakdown.medium,
      barColor: 'bg-blue-500',
      textColor: 'text-blue-400',
    },
    {
      label: 'Low',
      count: severityBreakdown.low,
      barColor: 'bg-purple-500',
      textColor: 'text-purple-400',
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {!stats.aiConfigured && (
        <div
          role="status"
          className="flex flex-col justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-950/25 p-4 text-sm text-amber-100 sm:flex-row sm:items-center"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" aria-hidden="true" />
            <div>
              <span className="font-semibold">Gemini API key not configured:</span> Live AI scans,
              code explanations, and test generation require{' '}
              <code className="font-mono text-amber-300">GEMINI_API_KEY</code> in the server
              environment (Settings &gt; Secrets). Uploading and browsing source projects still
              works normally.
            </div>
          </div>
        </div>
      )}

      {/* Top KPI Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-[#0D1322] p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400">
            <span>Total Projects</span>
            <FolderCode className="h-4 w-4 text-blue-400" aria-hidden="true" />
          </div>
          <div className="mt-3 font-display text-3xl font-bold text-white tabular-nums">
            {stats.totalProjects}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            <span className="tabular-nums">{stats.totalScans}</span> completed scans
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0D1322] p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400">
            <span>Total Bugs Detected</span>
            <ShieldAlert className="h-4 w-4 text-purple-400" aria-hidden="true" />
          </div>
          <div className="mt-3 font-display text-3xl font-bold text-white tabular-nums">
            {stats.totalBugsDetected}
          </div>
          <div className="mt-1 text-xs text-slate-400">Across latest project scans</div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0D1322] p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400">
            <span>Bugs Successfully Fixed</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden="true" />
          </div>
          <div className="mt-3 font-display text-3xl font-bold text-white tabular-nums">
            {stats.bugsFixed}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            <span className="tabular-nums">{stats.fixesRejected}</span> suggestions rejected
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-slate-800 bg-[#0D1322] p-5">
          <div>
            <div className="text-xs font-medium text-slate-400">Quick Action</div>
            <div className="mt-1.5 text-sm font-medium text-slate-200">
              Analyze new source files or ZIP archive
            </div>
          </div>
          <button
            type="button"
            onClick={onNavigateUpload}
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-500 whitespace-nowrap"
          >
            <FolderUp className="h-4 w-4" aria-hidden="true" />
            <span>Upload New Project</span>
          </button>
        </div>
      </div>

      {/* Severity Chart + Recent Projects */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="rounded-xl border border-slate-800 bg-[#0D1322] p-6 lg:col-span-5">
          <h2 className="font-display text-base font-semibold text-white">
            Severity Distribution
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Breakdown of issues from the latest completed scan per project
          </p>

          {totalSeverityCount === 0 ? (
            <div className="mt-8 rounded-lg border border-dashed border-slate-800 bg-[#070B14] p-6 text-center">
              <p className="text-sm font-medium text-slate-300">No scan results recorded yet</p>
              <p className="mt-1 text-xs text-slate-400">
                Open any project in the Code Workbench and run an AI scan to populate severity
                metrics.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-5">
              {/* Proportional Stacked Bar */}
              <div
                aria-label="Severity proportion bar"
                className="flex h-3 w-full overflow-hidden rounded-full bg-[#070B14]"
              >
                {severityRows.map((row) => {
                  const pct = (row.count / totalSeverityCount) * 100;
                  if (pct <= 0) return null;
                  return (
                    <div
                      key={row.label}
                      style={{ width: `${pct}%` }}
                      className={`${row.barColor} transition-all`}
                      title={`${row.label}: ${row.count}`}
                    />
                  );
                })}
              </div>

              <div className="space-y-3">
                {severityRows.map((row) => {
                  const pct =
                    totalSeverityCount > 0
                      ? Math.round((row.count / totalSeverityCount) * 100)
                      : 0;
                  return (
                    <div key={row.label} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className={`font-semibold ${row.textColor}`}>{row.label}</span>
                        <span className="font-mono text-slate-300 tabular-nums">
                          {row.count} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-[#070B14]">
                        <div
                          className={`h-full rounded-full ${row.barColor}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* Recent Projects */}
        <section className="rounded-xl border border-slate-800 bg-[#0D1322] p-6 lg:col-span-7">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-semibold text-white">Recent Projects</h2>
              <p className="mt-1 text-xs text-slate-400">
                Select a project to inspect code, scan for bugs, or verify fixes
              </p>
            </div>
            <button
              type="button"
              onClick={onNavigateUpload}
              className="text-xs font-medium text-blue-400 hover:text-blue-300 whitespace-nowrap"
            >
              Manage all
            </button>
          </div>

          {stats.recentProjects.length === 0 ? (
            <div className="mt-8 rounded-lg border border-dashed border-slate-800 bg-[#070B14] p-6 text-center">
              <p className="text-sm font-medium text-slate-300">No projects yet</p>
              <button
                type="button"
                onClick={onNavigateUpload}
                className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500"
              >
                Upload First Project
              </button>
            </div>
          ) : (
            <div className="mt-4 divide-y divide-slate-800/80">
              {stats.recentProjects.map((proj) => (
                <div
                  key={proj.id}
                  className="flex flex-col justify-between gap-3 py-3.5 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-display text-sm font-semibold text-white">
                        {proj.name}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span className="capitalize">{proj.primary_language}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{proj.file_count} files</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">
                        {proj.last_scanned_at
                          ? `${proj.total_bugs} bugs (${proj.fixed_bugs} fixed)`
                          : 'Not scanned yet'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenProject(proj.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#070B14] px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:border-blue-500/60 hover:text-white whitespace-nowrap shrink-0"
                  >
                    <Play className="h-3.5 w-3.5 text-blue-400" aria-hidden="true" />
                    <span>Open Workbench</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Recent Scan History Table */}
      <section className="rounded-xl border border-slate-800 bg-[#0D1322] p-6">
        <h2 className="font-display text-base font-semibold text-white">Recent Scan History</h2>
        {stats.recentScans.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">
            No scans have been executed yet. Open a sample or uploaded project and click{' '}
            <span className="text-slate-200 font-medium">Run AI Scan</span>.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="pb-2.5 pr-4 font-medium">Project</th>
                  <th className="pb-2.5 pr-4 font-medium">Status</th>
                  <th className="pb-2.5 pr-4 font-medium">Model</th>
                  <th className="pb-2.5 pr-4 font-medium text-right">Bugs Found</th>
                  <th className="pb-2.5 pr-4 font-medium">Timestamp</th>
                  <th className="pb-2.5 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-slate-300">
                {stats.recentScans.map((scan) => (
                  <tr key={scan.id} className="hover:bg-slate-800/30">
                    <td className="py-3 pr-4 font-medium text-white">
                      {scan.project_name || `Project #${scan.project_id}`}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={
                          scan.status === 'completed' ? 'text-emerald-400' : 'text-red-400'
                        }
                      >
                        {scan.status === 'completed' ? 'Completed' : 'Failed'}
                      </span>
                    </td>
                    <td className="py-3 pr-4 font-mono text-slate-400">{scan.model_used}</td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums">
                      {scan.total_bugs}
                    </td>
                    <td className="py-3 pr-4 font-mono text-slate-400 tabular-nums">
                      {scan.scanned_at}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        onClick={() => onOpenProject(scan.project_id)}
                        className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300"
                      >
                        <span>Inspect</span>
                        <ArrowRight className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </td>
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

import { useState, type ChangeEvent, type DragEvent, type FormEvent } from 'react';
import {
  FileCode2,
  FolderArchive,
  Loader2,
  Play,
  Plus,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import type { ProjectSummary, SampleProjectCatalogItem } from '../types';
import { api } from '../utils/api';
import { formatBytes, validateUploadFile } from '../utils/bugLogic';

interface UploadViewProps {
  projects: ProjectSummary[];
  samples: SampleProjectCatalogItem[];
  onProjectReady: (projectId: number) => void;
  onRefreshProjects: () => Promise<void>;
}

export function UploadView({
  projects,
  samples,
  onProjectReady,
  onRefreshProjects,
}: UploadViewProps) {
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [importingSampleKey, setImportingSampleKey] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addValidatedFiles = (fileList: FileList | File[]) => {
    setError(null);
    const incoming = Array.from(fileList);
    const validOnes: File[] = [];

    for (const file of incoming) {
      const check = validateUploadFile(file.name, file.size);
      if (!check.valid) {
        setError(check.error || 'Unsupported file.');
        return;
      }
      validOnes.push(file);
    }

    setSelectedFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.name));
      const merged = [...prev];
      for (const f of validOnes) {
        if (!existingNames.has(f.name)) {
          merged.push(f);
        }
      }
      return merged;
    });

    if (!projectName.trim() && validOnes.length > 0) {
      const base = validOnes[0].name.replace(/\.[^.]+$/, '');
      setProjectName(base);
    }
  };

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addValidatedFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addValidatedFiles(e.dataTransfer.files);
    }
  };

  const handleUploadSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!projectName.trim()) {
      setError('Please enter a project name.');
      return;
    }
    if (selectedFiles.length === 0) {
      setError('Please select at least one source file or ZIP archive.');
      return;
    }

    setUploading(true);
    try {
      const res = await api.uploadProject(
        projectName.trim(),
        description.trim(),
        selectedFiles
      );
      setProjectName('');
      setDescription('');
      setSelectedFiles([]);
      await onRefreshProjects();
      onProjectReady(res.projectId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleImportSample = async (sampleKey: string) => {
    setError(null);
    setImportingSampleKey(sampleKey);
    try {
      const res = await api.importSampleProject(sampleKey);
      await onRefreshProjects();
      onProjectReady(res.projectId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sample project.');
    } finally {
      setImportingSampleKey(null);
    }
  };

  const handleDeleteProject = async (projectId: number) => {
    setDeletingId(projectId);
    try {
      await api.deleteProject(projectId);
      await onRefreshProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete project.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Upload Form */}
        <section className="rounded-xl border border-slate-800 bg-[#0D1322] p-6 lg:col-span-7">
          <h2 className="font-display text-lg font-semibold text-white">
            Upload Source Code or ZIP Archive
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Supports Python, JavaScript, TypeScript, Java, C, C++, Go, Rust, SQL, JSON, and
            project ZIP bundles (up to 10 MB). Uploaded code is never executed directly on the host.
          </p>

          <form onSubmit={handleUploadSubmit} noValidate className="mt-5 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="proj-name" className="block text-xs font-medium text-slate-300">
                  Project Name
                </label>
                <input
                  id="proj-name"
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g. Payment Gateway Service"
                  className="mt-1.5 w-full rounded-lg border border-slate-700 bg-[#070B14] px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="proj-desc" className="block text-xs font-medium text-slate-300">
                  Short Description (optional)
                </label>
                <input
                  id="proj-desc"
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional summary of module scope"
                  className="mt-1.5 w-full rounded-lg border border-slate-700 bg-[#070B14] px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                isDragging
                  ? 'border-blue-500 bg-blue-950/20'
                  : 'border-slate-700 bg-[#070B14] hover:border-slate-600'
              }`}
            >
              <UploadCloud className="mx-auto h-8 w-8 text-blue-400" aria-hidden="true" />
              <p className="mt-2 text-sm font-medium text-slate-200">
                Drag and drop source files or a .zip project bundle
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Max 2 MB per source file · Max 10 MB per ZIP archive
              </p>
              <label
                htmlFor="source-file-input"
                className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 bg-[#0D1322] px-4 py-2 text-xs font-semibold text-slate-200 hover:border-blue-500/60 hover:text-white"
              >
                <span>Browse Files</span>
                <input
                  id="source-file-input"
                  type="file"
                  multiple
                  accept=".py,.js,.jsx,.mjs,.cjs,.ts,.tsx,.java,.c,.cpp,.cc,.h,.hpp,.go,.rs,.rb,.php,.cs,.sql,.json,.zip"
                  onChange={handleFileInput}
                  className="sr-only"
                />
              </label>
            </div>

            {selectedFiles.length > 0 && (
              <div className="rounded-lg border border-slate-800 bg-[#070B14] p-3">
                <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-400">
                  <span>Queued Files ({selectedFiles.length})</span>
                  <button
                    type="button"
                    onClick={() => setSelectedFiles([])}
                    className="text-slate-400 hover:text-white"
                  >
                    Clear all
                  </button>
                </div>
                <ul className="max-h-40 divide-y divide-slate-800/70 overflow-y-auto text-xs">
                  {selectedFiles.map((file) => (
                    <li
                      key={file.name}
                      className="flex items-center justify-between gap-3 py-2 text-slate-300"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        {file.name.endsWith('.zip') ? (
                          <FolderArchive
                            className="h-4 w-4 shrink-0 text-purple-400"
                            aria-hidden="true"
                          />
                        ) : (
                          <FileCode2
                            className="h-4 w-4 shrink-0 text-blue-400"
                            aria-hidden="true"
                          />
                        )}
                        <span className="truncate font-mono">{file.name}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-mono text-slate-400 tabular-nums">
                          {formatBytes(file.size)}
                        </span>
                        <button
                          type="button"
                          aria-label={`Remove ${file.name}`}
                          onClick={() =>
                            setSelectedFiles((prev) => prev.filter((f) => f.name !== file.name))
                          }
                          className="text-slate-400 hover:text-red-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="rounded-lg border border-red-500/40 bg-red-950/40 px-4 py-2.5 text-xs text-red-200"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-60"
            >
              {uploading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              <span>{uploading ? 'Uploading & Indexing...' : 'Create Project & Open Workbench'}</span>
            </button>
          </form>
        </section>

        {/* Sample Demonstration Projects */}
        <section className="rounded-xl border border-slate-800 bg-[#0D1322] p-6 lg:col-span-5">
          <h2 className="font-display text-lg font-semibold text-white">
            Sample Demonstration Projects
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            First-time exploration projects containing real multi-file bugs across JavaScript,
            Python, and C++.
          </p>

          <div className="mt-5 space-y-3">
            {samples.map((sample) => (
              <div
                key={sample.key}
                className="rounded-xl border border-slate-800 bg-[#070B14] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-sm font-semibold text-white">{sample.name}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span className="capitalize">{sample.primaryLanguage}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{sample.fileCount} files</span>
                      <span aria-hidden="true">·</span>
                      <span>{sample.focusAreas.join(', ')}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={importingSampleKey === sample.key}
                    onClick={() => handleImportSample(sample.key)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/40 bg-blue-600/15 px-3 py-1.5 text-xs font-semibold text-blue-300 transition-colors hover:bg-blue-600 hover:text-white whitespace-nowrap shrink-0 disabled:opacity-60"
                  >
                    {importingSampleKey === sample.key ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    <span>Load Sample</span>
                  </button>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">{sample.description}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Existing Projects List */}
      <section className="rounded-xl border border-slate-800 bg-[#0D1322] p-6">
        <h2 className="font-display text-lg font-semibold text-white">Your Projects</h2>
        <p className="mt-1 text-xs text-slate-400">
          Select any project to launch the Monaco Code Workbench and run AI analysis
        </p>

        {projects.length === 0 ? (
          <div className="mt-6 rounded-lg border border-dashed border-slate-800 bg-[#070B14] p-8 text-center text-sm text-slate-400">
            No projects in your workspace yet. Upload files above or load a sample project.
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((proj) => (
              <div
                key={proj.id}
                className="flex flex-col justify-between rounded-xl border border-slate-800 bg-[#070B14] p-5"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display text-base font-semibold text-white">{proj.name}</h3>
                    <button
                      type="button"
                      aria-label={`Delete project ${proj.name}`}
                      disabled={deletingId === proj.id}
                      onClick={() => handleDeleteProject(proj.id)}
                      className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-xs text-slate-400">
                    {proj.description || 'Uploaded source project'}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span className="capitalize">{proj.primary_language}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{proj.file_count} files</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">
                      {proj.last_scanned_at
                        ? `${proj.total_bugs} bugs (${proj.fixed_bugs} fixed)`
                        : 'Ready to scan'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onProjectReady(proj.id)}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-[#0D1322] px-4 py-2 text-xs font-semibold text-white transition-colors hover:border-blue-500/60 hover:bg-blue-600/15"
                >
                  <Play className="h-3.5 w-3.5 text-blue-400" aria-hidden="true" />
                  <span>Open in Workbench</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

import type {
  CodeExplanation,
  DashboardStats,
  ProjectDetail,
  ProjectSummary,
  SampleProjectCatalogItem,
  TestResult,
  User,
} from '../types';

const TOKEN_STORAGE_KEY = 'autopatch_auth_token';

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // ignore storage failures
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(init.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(path, { ...init, headers });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    code?: string;
  };

  if (!res.ok) {
    throw new ApiError(
      data.error || `Request failed (${res.status})`,
      res.status,
      data.code
    );
  }

  return data as T;
}

export const api = {
  health: () =>
    request<{ ok: boolean; aiConfigured: boolean; model: string }>('/api/health'),

  getSampleCatalog: () => request<SampleProjectCatalogItem[]>('/api/samples/catalog'),

  register: (name: string, email: string, password: string) =>
    request<{ user: User; token: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    }),

  login: (email: string, password: string) =>
    request<{ user: User; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  me: () => request<{ user: User }>('/api/auth/me'),

  getDashboardStats: () => request<DashboardStats>('/api/dashboard/stats'),

  getProjects: () => request<{ projects: ProjectSummary[] }>('/api/projects'),

  importSampleProject: (sampleKey: string) =>
    request<{ projectId: number }>('/api/projects/sample', {
      method: 'POST',
      body: JSON.stringify({ sampleKey }),
    }),

  uploadProject: (name: string, description: string, files: File[]) => {
    const form = new FormData();
    form.append('name', name);
    form.append('description', description);
    for (const file of files) {
      form.append('files', file);
    }
    return request<{ projectId: number; fileCount: number }>('/api/projects/upload', {
      method: 'POST',
      body: form,
    });
  },

  getProjectDetail: (projectId: number) =>
    request<ProjectDetail>(`/api/projects/${projectId}`),

  deleteProject: (projectId: number) =>
    request<{ deleted: boolean }>(`/api/projects/${projectId}`, { method: 'DELETE' }),

  scanProject: (projectId: number, useRepaired = false) =>
    request<{ scanId: number; totalBugs: number; summary: string }>(
      `/api/projects/${projectId}/scan`,
      {
        method: 'POST',
        body: JSON.stringify({ useRepaired }),
      }
    ),

  explainCode: (fileId: number, selectedCode: string) =>
    request<{ explanation: CodeExplanation }>('/api/ai/explain', {
      method: 'POST',
      body: JSON.stringify({ fileId, selectedCode }),
    }),

  acceptFix: (fixId: number, patchedContent?: string) =>
    request<{ accepted: boolean; repairedContent: string }>(
      `/api/fixes/${fixId}/accept`,
      {
        method: 'POST',
        body: JSON.stringify(patchedContent ? { patchedContent } : {}),
      }
    ),

  rejectFix: (fixId: number) =>
    request<{ rejected: boolean }>(`/api/fixes/${fixId}/reject`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  runBugTests: (bugId: number) =>
    request<{ tests: TestResult[] }>(`/api/bugs/${bugId}/run-tests`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  getHistory: () =>
    request<{
      scans: Array<import('../types').ScanRecord>;
      changes: Array<import('../types').ChangeHistoryEntry>;
    }>('/api/history'),

  downloadFile: async (fileId: number, filename: string) => {
    const token = getStoredToken();
    const res = await fetch(`/api/files/${fileId}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Download failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `repaired_${filename.split('/').pop() || 'code.txt'}`;
    a.click();
    URL.revokeObjectURL(url);
  },

  downloadProjectBundle: async (projectId: number, projectName: string) => {
    const token = getStoredToken();
    const res = await fetch(`/api/projects/${projectId}/download-bundle`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Bundle download failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-repaired.zip`;
    a.click();
    URL.revokeObjectURL(url);
  },
};

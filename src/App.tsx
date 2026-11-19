/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import { AppShell, type WorkspaceTab } from './components/AppShell';
import { AuthModal } from './components/AuthModal';
import { DashboardView } from './components/DashboardView';
import { HistoryReportsView } from './components/HistoryReportsView';
import { LandingPage } from './components/LandingPage';
import { UploadView } from './components/UploadView';
import { WorkbenchView } from './components/WorkbenchView';
import type {
  DashboardStats,
  ProjectSummary,
  SampleProjectCatalogItem,
  User,
} from './types';
import { api, getStoredToken, setStoredToken } from './utils/api';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [showWorkspace, setShowWorkspace] = useState(false);

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('dashboard');
  const [activeProjectId, setActiveProjectId] = useState<number | null>(null);

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [samples, setSamples] = useState<SampleProjectCatalogItem[]>([]);

  const loadWorkspaceData = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const [dash, projList, sampleList] = await Promise.all([
        api.getDashboardStats(),
        api.getProjects(),
        api.getSampleCatalog(),
      ]);
      setStats(dash);
      setProjects(projList.projects);
      setSamples(sampleList);
      setActiveProjectId((prev) => {
        if (prev && projList.projects.some((p) => p.id === prev)) return prev;
        return projList.projects[0]?.id ?? null;
      });
    } catch (err) {
      setStatsError(err instanceof Error ? err.message : 'Failed to load workspace data.');
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const token = getStoredToken();
    if (!token) {
      setAuthChecked(true);
      return;
    }
    api
      .me()
      .then((res) => {
        if (!mounted) return;
        setUser(res.user);
        setShowWorkspace(true);
        loadWorkspaceData();
      })
      .catch(() => {
        setStoredToken(null);
      })
      .finally(() => {
        if (mounted) setAuthChecked(true);
      });
    return () => {
      mounted = false;
    };
  }, [loadWorkspaceData]);

  const handleAuthenticated = (authenticatedUser: User) => {
    setUser(authenticatedUser);
    setAuthModalOpen(false);
    setShowWorkspace(true);
    setActiveTab('dashboard');
    loadWorkspaceData();
  };

  const handleLogout = () => {
    setStoredToken(null);
    setUser(null);
    setShowWorkspace(false);
    setStats(null);
    setProjects([]);
    setActiveProjectId(null);
  };

  const handleOpenProjectInWorkbench = (projectId: number) => {
    setActiveProjectId(projectId);
    setActiveTab('workbench');
    setShowWorkspace(true);
  };

  const activeProjectName = projects.find((p) => p.id === activeProjectId)?.name;

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070B14] text-sm text-slate-400">
        Initializing AutoPatch AI...
      </div>
    );
  }

  return (
    <>
      {!showWorkspace || !user ? (
        <LandingPage
          isAuthenticated={Boolean(user)}
          onGetStarted={() => {
            if (user) {
              setShowWorkspace(true);
              loadWorkspaceData();
            } else {
              setAuthModalOpen(true);
            }
          }}
          onOpenAuth={() => setAuthModalOpen(true)}
        />
      ) : (
        <AppShell
          user={user}
          activeTab={activeTab}
          activeProjectName={activeProjectName}
          onSelectTab={(tab) => setActiveTab(tab)}
          onBackToLanding={() => setShowWorkspace(false)}
          onLogout={handleLogout}
        >
          {activeTab === 'dashboard' && (
            <DashboardView
              stats={stats}
              loading={statsLoading}
              error={statsError}
              onOpenProject={handleOpenProjectInWorkbench}
              onNavigateUpload={() => setActiveTab('upload')}
              onRetry={loadWorkspaceData}
            />
          )}

          {activeTab === 'upload' && (
            <UploadView
              projects={projects}
              samples={samples}
              onProjectReady={handleOpenProjectInWorkbench}
              onRefreshProjects={loadWorkspaceData}
            />
          )}

          {activeTab === 'workbench' && (
            <WorkbenchView
              projectId={activeProjectId}
              projects={projects}
              onSelectProject={(id) => setActiveProjectId(id)}
              onNavigateUpload={() => setActiveTab('upload')}
              onDataMutated={loadWorkspaceData}
            />
          )}

          {activeTab === 'history' && (
            <HistoryReportsView
              projects={projects}
              onOpenProject={handleOpenProjectInWorkbench}
            />
          )}
        </AppShell>
      )}

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onAuthenticated={handleAuthenticated}
      />
    </>
  );
}

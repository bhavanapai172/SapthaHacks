import { useState, type ReactNode } from 'react';
import {
  Code2,
  FolderUp,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import type { User } from '../types';

export type WorkspaceTab = 'dashboard' | 'upload' | 'workbench' | 'history';

interface AppShellProps {
  user: User;
  activeTab: WorkspaceTab;
  activeProjectName?: string;
  onSelectTab: (tab: WorkspaceTab) => void;
  onBackToLanding: () => void;
  onLogout: () => void;
  children: ReactNode;
}

export function AppShell({
  user,
  activeTab,
  activeProjectName,
  onSelectTab,
  onBackToLanding,
  onLogout,
  children,
}: AppShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: Array<{ id: WorkspaceTab; label: string; icon: typeof LayoutDashboard }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'upload', label: 'Projects & Upload', icon: FolderUp },
    { id: 'workbench', label: 'Code Workbench', icon: Code2 },
    { id: 'history', label: 'History & Reports', icon: History },
  ];

  const handleNavClick = (tab: WorkspaceTab) => {
    onSelectTab(tab);
    setMobileMenuOpen(false);
  };

  const tabTitles: Record<WorkspaceTab, string> = {
    dashboard: 'Overview Dashboard',
    upload: 'Projects & Upload',
    workbench: activeProjectName ? `Workbench / ${activeProjectName}` : 'Code Workbench',
    history: 'Bug History & Reports',
  };

  return (
    <div className="flex min-h-screen bg-[#070B14] text-slate-100">
      {/* Desktop Sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-800/80 bg-[#0A101D] lg:flex">
        <div className="flex h-16 items-center border-b border-slate-800/80 px-5">
          <button
            type="button"
            onClick={onBackToLanding}
            className="font-display text-lg font-bold tracking-tight text-white hover:text-blue-400 transition-colors text-left"
          >
            AutoPatch AI
          </button>
        </div>

        <nav aria-label="Workspace navigation" className="flex-1 space-y-1 p-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-white border border-transparent'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-800/80 p-4">
          <div className="truncate text-sm font-medium text-white">{user.name}</div>
          <div className="truncate text-xs text-slate-400">{user.email}</div>
          <button
            type="button"
            onClick={onLogout}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-[#070B14] px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/70"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative flex w-64 flex-col border-r border-slate-800 bg-[#0A101D]">
            <div className="flex h-16 items-center justify-between border-b border-slate-800 px-5">
              <span className="font-display text-lg font-bold text-white">AutoPatch AI</span>
              <button
                type="button"
                aria-label="Close navigation menu"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <nav aria-label="Mobile workspace navigation" className="flex-1 space-y-1 p-3">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavClick(item.id)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                        : 'text-slate-300 hover:bg-slate-800/60 hover:text-white border border-transparent'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="border-t border-slate-800 p-4">
              <div className="truncate text-sm font-medium text-white">{user.name}</div>
              <div className="truncate text-xs text-slate-400">{user.email}</div>
              <button
                type="button"
                onClick={onLogout}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-[#070B14] px-3 py-2 text-xs font-medium text-slate-300"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Sign Out</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-slate-800/80 bg-[#0A101D] px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label="Open navigation menu"
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-lg p-2 text-slate-300 hover:bg-slate-800 hover:text-white lg:hidden"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
            <h1 className="truncate font-display text-base font-semibold text-white sm:text-lg">
              {tabTitles[activeTab]}
            </h1>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onSelectTab('upload')}
              className="rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-500 whitespace-nowrap shrink-0"
            >
              Upload Project
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

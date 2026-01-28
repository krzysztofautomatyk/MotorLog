import React from 'react';
import { Activity, ChevronRight, Home, Database, Wifi, WifiOff } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

interface LayoutProps {
  children: React.ReactNode;
  breadcrumbs: { label: string; action?: () => void }[];
  theme: 'light' | 'dark' | 'system';
  onThemeChange: (theme: 'light' | 'dark' | 'system') => void;
  apiConnected?: boolean;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  breadcrumbs,
  theme,
  onThemeChange,
  apiConnected = true
}) => {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col transition-colors duration-300">
      {/* Header */}
      <header className="bg-[var(--bg-secondary)] border-b border-[var(--border-primary)] sticky top-0 z-50 shadow-[var(--shadow-sm)]">
        <div className="w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-2 rounded-lg shadow-md">
              <Activity className="h-6 w-6 text-white" />
            </div>
            <div>
              <span className="font-bold text-xl tracking-tight text-[var(--text-primary)]">
                Motor<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Analytics</span>
              </span>
              <span className="ml-2 text-[10px] font-semibold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded uppercase tracking-wider">
                Pro
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* API Status Indicator */}
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider ${apiConnected
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                : 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
              }`}>
              {apiConnected ? (
                <>
                  <Database className="h-3 w-3" />
                  <span>Connected</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3" />
                  <span>Offline</span>
                </>
              )}
            </div>

            {/* Theme Toggle */}
            <ThemeToggle theme={theme} onThemeChange={onThemeChange} />

            <div className="text-xs text-[var(--text-tertiary)] hidden sm:block">
              Enterprise Edition v2.5
            </div>
          </div>
        </div>

        {/* Breadcrumbs Bar */}
        <div className="bg-[var(--bg-tertiary)] border-b border-[var(--border-primary)] px-4 sm:px-6 lg:px-8 py-3">
          <nav className="w-full flex items-center text-sm font-medium text-[var(--text-secondary)]">
            <button
              onClick={breadcrumbs[0]?.action}
              className="hover:text-[var(--accent-blue)] transition-colors flex items-center gap-1"
            >
              <Home className="h-4 w-4" /> Home
            </button>

            {breadcrumbs.map((crumb, idx) => (
              <div key={idx} className="flex items-center">
                <ChevronRight className="h-4 w-4 mx-2 text-[var(--text-tertiary)]" />
                <button
                  onClick={crumb.action}
                  disabled={!crumb.action}
                  className={`${crumb.action ? 'hover:text-[var(--accent-blue)] cursor-pointer' : 'text-[var(--text-primary)] cursor-default font-semibold'} transition-colors`}
                >
                  {crumb.label}
                </button>
              </div>
            ))}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow w-full px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-[var(--bg-secondary)] border-t border-[var(--border-primary)] py-3 px-4 text-center">
        <p className="text-xs text-[var(--text-tertiary)]">
          © 2026 MotorAnalytics Pro • Real-time Industrial Monitoring
        </p>
      </footer>
    </div>
  );
};
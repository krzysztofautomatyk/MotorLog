import React from 'react';
import { Activity, ChevronRight, Home } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  breadcrumbs: { label: string; action?: () => void }[];
}

export const Layout: React.FC<LayoutProps> = ({ children, breadcrumbs }) => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Activity className="h-6 w-6 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-800">Motor<span className="text-blue-600">Analytics</span></span>
          </div>
          <div className="text-sm text-slate-500">
            Enterprise Edition v2.4
          </div>
        </div>
        
        {/* Breadcrumbs Bar */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-3">
            <nav className="w-full flex items-center text-sm font-medium text-slate-500">
              <button 
                onClick={breadcrumbs[0]?.action}
                className="hover:text-blue-600 transition-colors flex items-center gap-1"
              >
                <Home className="h-4 w-4" /> Home
              </button>
              
              {breadcrumbs.map((crumb, idx) => (
                <div key={idx} className="flex items-center">
                  <ChevronRight className="h-4 w-4 mx-2 text-slate-300" />
                  <button 
                    onClick={crumb.action}
                    disabled={!crumb.action}
                    className={`${crumb.action ? 'hover:text-blue-600 cursor-pointer' : 'text-slate-800 cursor-default'} transition-colors`}
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
    </div>
  );
};
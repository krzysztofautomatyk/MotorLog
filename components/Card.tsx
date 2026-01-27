import React from 'react';

interface CardProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  status?: 'Healthy' | 'Warning' | 'Critical';
  children?: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ title, subtitle, icon, onClick, status, children, className = '' }) => {
  const statusColors = {
    Healthy: 'bg-emerald-500',
    Warning: 'bg-amber-500',
    Critical: 'bg-rose-500'
  };

  return (
    <div 
      onClick={onClick}
      className={`bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 p-6 cursor-pointer group ${className}`}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex gap-3">
          {icon && (
            <div className="p-2 bg-slate-100 rounded-lg text-slate-600 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
              {icon}
            </div>
          )}
          <div>
            <h3 className="font-semibold text-lg text-slate-900">{title}</h3>
            {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
          </div>
        </div>
        {status && (
          <span className="flex h-3 w-3 relative">
             <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${statusColors[status]}`}></span>
             <span className={`relative inline-flex rounded-full h-3 w-3 ${statusColors[status]}`}></span>
          </span>
        )}
      </div>
      {children}
    </div>
  );
};

export const KPICard: React.FC<{ label: string; value: string | number; unit?: string; trend?: 'up' | 'down' | 'neutral' }> = ({ label, value, unit, trend }) => (
  <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
    <p className="text-sm font-medium text-slate-500 mb-1">{label}</p>
    <div className="flex items-baseline gap-1">
      <span className="text-2xl font-bold text-slate-900">{value}</span>
      {unit && <span className="text-sm text-slate-400 font-medium">{unit}</span>}
    </div>
  </div>
);
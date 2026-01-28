import React from 'react';

interface CardProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  status?: 'Healthy' | 'Warning' | 'Critical';
  children?: React.ReactNode;
  className?: string;
  loading?: boolean;
}

export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  icon,
  onClick,
  status,
  children,
  className = '',
  loading = false
}) => {
  const statusColors = {
    Healthy: 'bg-emerald-500',
    Warning: 'bg-amber-500',
    Critical: 'bg-rose-500'
  };

  if (loading) {
    return (
      <div className={`bg-[var(--bg-card)] rounded-xl border border-[var(--border-primary)] p-6 animate-pulse ${className}`}>
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-[var(--bg-tertiary)]" />
          <div className="flex-1 space-y-2">
            <div className="h-5 bg-[var(--bg-tertiary)] rounded w-3/4" />
            <div className="h-4 bg-[var(--bg-tertiary)] rounded w-1/2" />
          </div>
        </div>
        {children && (
          <div className="pt-4 border-t border-[var(--border-primary)]">
            <div className="h-4 bg-[var(--bg-tertiary)] rounded w-full" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`
        bg-[var(--bg-card)] rounded-xl border border-[var(--border-primary)] 
        shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] 
        transition-all duration-200 p-6 cursor-pointer group
        hover:border-[var(--accent-blue)] hover:border-opacity-50
        ${className}
      `}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex gap-3">
          {icon && (
            <div className="p-2 bg-[var(--bg-tertiary)] rounded-lg text-[var(--text-secondary)] group-hover:bg-blue-50 group-hover:text-blue-600 dark:group-hover:bg-blue-900/30 dark:group-hover:text-blue-400 transition-colors">
              {icon}
            </div>
          )}
          <div>
            <h3 className="font-semibold text-lg text-[var(--text-primary)]">{title}</h3>
            {subtitle && <p className="text-sm text-[var(--text-secondary)]">{subtitle}</p>}
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

interface KPICardProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'neutral';
  loading?: boolean;
}

export const KPICard: React.FC<KPICardProps> = ({
  label,
  value,
  unit,
  trend,
  loading = false
}) => {
  if (loading) {
    return (
      <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border-primary)] p-4 shadow-[var(--shadow-sm)] animate-pulse">
        <div className="h-4 bg-[var(--bg-tertiary)] rounded w-1/2 mb-2" />
        <div className="h-8 bg-[var(--bg-tertiary)] rounded w-3/4" />
      </div>
    );
  }

  const trendColors = {
    up: 'text-emerald-600',
    down: 'text-rose-600',
    neutral: 'text-[var(--text-tertiary)]'
  };

  return (
    <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border-primary)] p-4 shadow-[var(--shadow-sm)]">
      <p className="text-sm font-medium text-[var(--text-secondary)] mb-1">{label}</p>
      <div className="flex items-baseline gap-1">
        <span className={`text-2xl font-bold text-[var(--text-primary)] ${trend ? trendColors[trend] : ''}`}>
          {value}
        </span>
        {unit && <span className="text-sm text-[var(--text-tertiary)] font-medium">{unit}</span>}
      </div>
    </div>
  );
};
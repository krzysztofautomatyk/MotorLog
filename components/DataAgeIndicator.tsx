import React, { useMemo } from 'react';
import { Clock, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

interface DataAgeIndicatorProps {
    lastTimestamp: string | null;
    autoRefresh?: boolean;
}

interface DataAgeStatus {
    label: string;
    className: string;
    icon: React.ReactNode;
    description: string;
    minutesAgo: number;
}

export const DataAgeIndicator: React.FC<DataAgeIndicatorProps> = ({
    lastTimestamp,
    autoRefresh = false
}) => {
    const status = useMemo((): DataAgeStatus | null => {
        if (!lastTimestamp) return null;

        const lastDate = new Date(lastTimestamp);
        const now = new Date();
        const diffMs = now.getTime() - lastDate.getTime();
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMinutes / 60);
        const diffDays = Math.floor(diffHours / 24);

        // Data freshness thresholds
        if (diffMinutes < 15) {
            return {
                label: 'Fresh Data',
                className: 'data-fresh bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800',
                icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />,
                description: `${diffMinutes < 1 ? 'Just now' : `${diffMinutes}m ago`}`,
                minutesAgo: diffMinutes
            };
        } else if (diffMinutes < 60) {
            return {
                label: 'Recent Data',
                className: 'data-stale bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800',
                icon: <Clock className="h-3.5 w-3.5 text-amber-600" />,
                description: `${diffMinutes}m ago`,
                minutesAgo: diffMinutes
            };
        } else if (diffHours < 24) {
            return {
                label: 'Stale Data',
                className: 'data-stale bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800',
                icon: <AlertTriangle className="h-3.5 w-3.5 text-orange-600" />,
                description: `${diffHours}h ago`,
                minutesAgo: diffMinutes
            };
        } else {
            return {
                label: 'Old Data',
                className: 'data-old bg-rose-50 border-rose-200 dark:bg-rose-950/30 dark:border-rose-800',
                icon: <XCircle className="h-3.5 w-3.5 text-rose-600" />,
                description: `${diffDays}d ago`,
                minutesAgo: diffMinutes
            };
        }
    }, [lastTimestamp]);

    if (!status) {
        return (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-100 border border-slate-200 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:border-slate-700">
                <XCircle className="h-3 w-3" />
                <span>No Data</span>
            </div>
        );
    }

    return (
        <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-semibold tracking-tight ${status.className}`}
            title={`Last data point: ${new Date(lastTimestamp!).toLocaleString()}. Auto-refresh is ${autoRefresh ? 'ON' : 'OFF'}.`}
        >
            {status.icon}
            <span className="uppercase">{status.description}</span>
            {status.minutesAgo >= 15 && (
                <span className="text-[9px] opacity-75">
                    ({status.label})
                </span>
            )}
        </div>
    );
};

export default DataAgeIndicator;

import React from 'react';

interface SkeletonProps {
    className?: string;
    variant?: 'text' | 'rectangular' | 'circular' | 'chart';
    width?: string | number;
    height?: string | number;
    lines?: number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
    className = '',
    variant = 'rectangular',
    width,
    height,
    lines = 1
}) => {
    const baseClasses = 'skeleton rounded animate-pulse';

    const variantClasses = {
        text: 'h-4 rounded',
        rectangular: 'rounded-lg',
        circular: 'rounded-full',
        chart: 'rounded-lg'
    };

    const style: React.CSSProperties = {
        width: width || '100%',
        height: height || (variant === 'text' ? '1rem' : variant === 'chart' ? '250px' : '100%'),
        background: 'linear-gradient(90deg, var(--bg-tertiary) 25%, var(--border-primary) 50%, var(--bg-tertiary) 75%)',
        backgroundSize: '200% 100%',
    };

    if (variant === 'text' && lines > 1) {
        return (
            <div className={`space-y-2 ${className}`}>
                {Array.from({ length: lines }).map((_, i) => (
                    <div
                        key={i}
                        className={`${baseClasses} ${variantClasses.text}`}
                        style={{
                            ...style,
                            width: i === lines - 1 ? '75%' : '100%'
                        }}
                    />
                ))}
            </div>
        );
    }

    return (
        <div
            className={`${baseClasses} ${variantClasses[variant]} ${className}`}
            style={style}
        />
    );
};

// Card skeleton for loading states
export const CardSkeleton: React.FC<{ count?: number }> = ({ count = 1 }) => (
    <>
        {Array.from({ length: count }).map((_, i) => (
            <div
                key={i}
                className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-primary)] p-6 animate-pulse"
            >
                <div className="flex items-start gap-3 mb-4">
                    <Skeleton variant="rectangular" width={40} height={40} />
                    <div className="flex-1 space-y-2">
                        <Skeleton variant="text" width="60%" />
                        <Skeleton variant="text" width="40%" />
                    </div>
                    <Skeleton variant="circular" width={12} height={12} />
                </div>
                <div className="pt-4 border-t border-[var(--border-primary)]">
                    <div className="flex justify-between">
                        <Skeleton variant="text" width="30%" />
                        <Skeleton variant="text" width="20%" />
                    </div>
                </div>
            </div>
        ))}
    </>
);

// Chart skeleton for loading states
export const ChartSkeleton: React.FC<{ title?: string }> = ({ title }) => (
    <div className="bg-[var(--bg-card)] p-4 rounded-lg border border-[var(--border-primary)] shadow-sm">
        {title && (
            <div className="mb-3 flex justify-between items-center">
                <Skeleton variant="text" width="30%" height={20} />
                <div className="flex gap-2">
                    <Skeleton variant="rectangular" width={60} height={24} />
                    <Skeleton variant="rectangular" width={80} height={24} />
                </div>
            </div>
        )}
        <Skeleton variant="chart" height={250} />
    </div>
);

// Header controls skeleton
export const ControlsSkeleton: React.FC = () => (
    <div className="bg-[var(--bg-card)] p-3 rounded-lg border border-[var(--border-primary)] shadow-sm flex flex-wrap items-center justify-between gap-4 animate-pulse">
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
                <Skeleton variant="text" width={120} />
                <Skeleton variant="rectangular" width={100} height={32} />
            </div>
        </div>
        <div className="flex items-center gap-3">
            <Skeleton variant="rectangular" width={150} height={28} />
            <Skeleton variant="text" width={60} />
        </div>
        <div className="flex items-center gap-4">
            <div className="flex gap-1">
                {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} variant="rectangular" width={50} height={28} />
                ))}
            </div>
            <Skeleton variant="rectangular" width={80} height={28} />
            <Skeleton variant="rectangular" width={130} height={28} />
        </div>
    </div>
);

export default Skeleton;

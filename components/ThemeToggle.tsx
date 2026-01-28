import React from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';

interface ThemeToggleProps {
    theme: 'light' | 'dark' | 'system';
    onThemeChange: (theme: 'light' | 'dark' | 'system') => void;
    compact?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
    theme,
    onThemeChange,
    compact = false
}) => {
    const themes: Array<{ value: 'light' | 'dark' | 'system'; icon: React.ReactNode; label: string }> = [
        { value: 'light', icon: <Sun className="h-4 w-4" />, label: 'Light' },
        { value: 'dark', icon: <Moon className="h-4 w-4" />, label: 'Dark' },
        { value: 'system', icon: <Monitor className="h-4 w-4" />, label: 'System' }
    ];

    if (compact) {
        // Simple toggle button
        return (
            <button
                onClick={() => onThemeChange(theme === 'dark' ? 'light' : 'dark')}
                className="p-2 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--border-primary)] transition-colors"
                title={`Current: ${theme}. Click to toggle.`}
            >
                {theme === 'dark' ? (
                    <Sun className="h-5 w-5 text-amber-500" />
                ) : (
                    <Moon className="h-5 w-5 text-indigo-500" />
                )}
            </button>
        );
    }

    return (
        <div className="flex items-center gap-1 p-1 bg-[var(--bg-tertiary)] rounded-lg">
            {themes.map(({ value, icon, label }) => (
                <button
                    key={value}
                    onClick={() => onThemeChange(value)}
                    className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all
            ${theme === value
                            ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                            : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                        }
          `}
                    title={label}
                >
                    {icon}
                    <span className="hidden sm:inline">{label}</span>
                </button>
            ))}
        </div>
    );
};

export default ThemeToggle;

import { useState, useEffect, useCallback } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface UseThemeReturn {
    theme: Theme;
    resolvedTheme: 'light' | 'dark';
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
}

const STORAGE_KEY = 'motorlog-theme';

export const useTheme = (): UseThemeReturn => {
    const [theme, setThemeState] = useState<Theme>(() => {
        if (typeof window === 'undefined') return 'system';
        const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
        return stored || 'system';
    });

    const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() => {
        if (typeof window === 'undefined') return 'light';
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    });

    // Listen for system theme changes
    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

        const handleChange = (e: MediaQueryListEvent) => {
            setSystemTheme(e.matches ? 'dark' : 'light');
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    // Apply theme to document
    useEffect(() => {
        const resolvedTheme = theme === 'system' ? systemTheme : theme;
        document.documentElement.setAttribute('data-theme', resolvedTheme);
    }, [theme, systemTheme]);

    const setTheme = useCallback((newTheme: Theme) => {
        setThemeState(newTheme);
        localStorage.setItem(STORAGE_KEY, newTheme);
    }, []);

    const toggleTheme = useCallback(() => {
        setTheme(theme === 'dark' ? 'light' : theme === 'light' ? 'dark' : 'light');
    }, [theme, setTheme]);

    const resolvedTheme = theme === 'system' ? systemTheme : theme;

    return {
        theme,
        resolvedTheme,
        setTheme,
        toggleTheme
    };
};

export default useTheme;

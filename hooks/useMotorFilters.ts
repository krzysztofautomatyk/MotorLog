import { useState, useCallback, useMemo } from 'react';
import { FilterState } from '../types';

interface UseMotorFiltersOptions {
    initialWeeks?: string[];
    initialDay?: number | 'ALL';
}

interface UseMotorFiltersReturn {
    filters: FilterState;
    setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
    toggleWeek: (week: string) => void;
    setDay: (day: number | 'ALL') => void;
    resetFilters: () => void;
    hasActiveFilters: boolean;
}

export const useMotorFilters = (options: UseMotorFiltersOptions = {}): UseMotorFiltersReturn => {
    const { initialWeeks = [], initialDay = 'ALL' } = options;

    const [filters, setFilters] = useState<FilterState>({
        selectedWeeks: initialWeeks,
        selectedDay: initialDay
    });

    const toggleWeek = useCallback((week: string) => {
        setFilters(prev => {
            const newWeeks = prev.selectedWeeks.includes(week)
                ? prev.selectedWeeks.filter(w => w !== week)
                : [...prev.selectedWeeks, week];

            // Ensure at least one week is selected
            if (newWeeks.length === 0) return prev;

            return { ...prev, selectedWeeks: newWeeks };
        });
    }, []);

    const setDay = useCallback((day: number | 'ALL') => {
        setFilters(prev => ({ ...prev, selectedDay: day }));
    }, []);

    const resetFilters = useCallback(() => {
        setFilters({
            selectedWeeks: initialWeeks,
            selectedDay: 'ALL'
        });
    }, [initialWeeks]);

    const hasActiveFilters = useMemo(() => {
        return filters.selectedDay !== 'ALL' || filters.selectedWeeks.length > 1;
    }, [filters]);

    return {
        filters,
        setFilters,
        toggleWeek,
        setDay,
        resetFilters,
        hasActiveFilters
    };
};

export default useMotorFilters;

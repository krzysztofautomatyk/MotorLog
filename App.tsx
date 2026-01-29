import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Layout } from './components/Layout';
import { Card } from './components/Card';
import { MotorCharts, MotorChartsHandle } from './components/MotorCharts';
import { CardSkeleton, ControlsSkeleton, ChartSkeleton } from './components/Skeleton';
import { DataAgeIndicator } from './components/DataAgeIndicator';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useTheme } from './hooks/useTheme';
import { getZones, getLines, getMotors, generateMotorData, getLatestMotorData, getAvailableWeeks, checkApiHealth, DataServiceError } from './services/dataService';
import { ZoneData, LineData, MotorLog, FilterState } from './types';
import { Factory, Cog, Layers, RotateCcw, RefreshCw, AlertTriangle, Clock } from 'lucide-react';

// View State Enum
type ViewState = 'ZONES' | 'LINES' | 'MOTOR_DETAIL';

// Loading states
interface LoadingState {
  zones: boolean;
  lines: boolean;
  motors: boolean;
  chartData: boolean;
}

const App = () => {
  // Theme
  const { theme, setTheme } = useTheme();

  // Navigation State
  const [view, setView] = useState<ViewState>('ZONES');
  const [selectedZone, setSelectedZone] = useState<ZoneData | null>(null);
  const [selectedLine, setSelectedLine] = useState<LineData | null>(null);
  const [selectedMotor, setSelectedMotor] = useState<string | null>(null);

  // Data Lists
  const [zones, setZones] = useState<ZoneData[]>([]);
  const [lines, setLines] = useState<LineData[]>([]);
  const [availableMotors, setAvailableMotors] = useState<string[]>([]);
  const [allWeeks, setAllWeeks] = useState<string[]>([]);

  // Filter State
  const [filters, setFilters] = useState<FilterState>({
    selectedWeeks: [],
    selectedDays: []
  });

  // Chart Data State
  const [chartData, setChartData] = useState<MotorLog[]>([]);
  const chartsRef = useRef<MotorChartsHandle>(null);

  // Loading states
  const [loading, setLoading] = useState<LoadingState>({
    zones: true,
    lines: false,
    motors: false,
    chartData: false
  });

  // Error state
  const [error, setError] = useState<string | null>(null);

  // API connection status
  const [apiConnected, setApiConnected] = useState(true);

  // Check API health on mount
  useEffect(() => {
    const checkHealth = async () => {
      const result = await checkApiHealth();
      setApiConnected(result.status === 'ok');
    };
    checkHealth();

    // Re-check every 30 seconds
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  // Initial Load - Zones and Weeks
  useEffect(() => {
    let isMounted = true;

    const loadInitialData = async () => {
      setLoading(prev => ({ ...prev, zones: true }));
      setError(null);

      try {
        const [zoneList, weeks] = await Promise.all([
          getZones(),
          getAvailableWeeks()
        ]);

        if (!isMounted) return;

        setZones(zoneList);
        setAllWeeks(weeks);
        setApiConnected(true);

        if (weeks.length > 0) {
          setFilters(prev => ({ ...prev, selectedWeeks: [weeks[0]] }));
        }
      } catch (err) {
        if (!isMounted) return;

        setApiConnected(false);
        if (err instanceof DataServiceError) {
          setError(err.message);
        } else {
          setError('Failed to load initial data. Make sure the API server is running.');
        }
      } finally {
        if (isMounted) {
          setLoading(prev => ({ ...prev, zones: false }));
        }
      }
    };

    loadInitialData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Modes: MANUAL (week/day + load) or AUTO (10s last 10 minutes)
  const [mode, setMode] = useState<'MANUAL' | 'AUTO'>('MANUAL');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [loadNonce, setLoadNonce] = useState(0);

  useEffect(() => {
    if (!autoRefresh || loadNonce === 0) return;

    const interval = setInterval(() => {
      setRefreshCounter(c => c + 1);
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, loadNonce]);

  // Update Filters and Fetch Data (including auto-refresh trigger)
  useEffect(() => {
    let isMounted = true;

    const isAutoMode = mode === 'AUTO';

    if (selectedZone && selectedLine && selectedMotor && ((isAutoMode && loadNonce > 0) || (!isAutoMode && filters.selectedDays.length > 0 && loadNonce > 0))) {
      // Show loading only for initial load, not for auto-refresh updates
      const isAutoRefreshUpdate = autoRefresh && refreshCounter > 0;
      if (!isAutoRefreshUpdate) {
        setLoading(prev => ({ ...prev, chartData: true }));
      }

      (async () => {
        try {
          let data: MotorLog[];

          if (isAutoMode) {
            // Use lightweight endpoint for auto-refresh mode (last 15 minutes)
            data = await getLatestMotorData(
              selectedZone.name,
              selectedLine.name,
              selectedMotor,
              10
            );
          } else {
            // Use full endpoint when auto-refresh is OFF (filtered by weeks/days)
            data = await generateMotorData(
              selectedZone.name,
              selectedLine.name,
              selectedMotor,
              filters.selectedWeeks,
              filters.selectedDays
            );
          }

          if (isMounted) {
            setChartData(data);
            setApiConnected(true);
            setError(null);
          }
        } catch (err) {
          if (isMounted) {
            setApiConnected(false);
            if (err instanceof DataServiceError) {
              setError(err.message);
            }
          }
        } finally {
          if (isMounted) {
            setLoading(prev => ({ ...prev, chartData: false }));
          }
        }
      })();
    }

    return () => {
      isMounted = false;
    };
  }, [selectedZone, selectedLine, selectedMotor, filters, refreshCounter, autoRefresh, loadNonce, mode]);

  // Get last timestamp from data for age indicator
  const lastDataTimestamp = useMemo(() => {
    if (chartData.length === 0) return null;
    return chartData[chartData.length - 1].timestamp;
  }, [chartData]);

  // Handle Navigation
  const handleZoneClick = useCallback(async (zone: ZoneData) => {
    setSelectedZone(zone);
    setLoading(prev => ({ ...prev, lines: true }));
    setError(null);

    try {
      const lineList = await getLines(zone.name);
      setLines(lineList);
      setView('LINES');
    } catch (err) {
      if (err instanceof DataServiceError) {
        setError(err.message);
      }
    } finally {
      setLoading(prev => ({ ...prev, lines: false }));
    }
  }, []);

  const handleLineClick = useCallback(async (line: LineData) => {
    setSelectedLine(line);
    setLoading(prev => ({ ...prev, motors: true }));
    setError(null);

    try {
      const motors = await getMotors(line.zone, line.name);
      setAvailableMotors(motors);
      setSelectedMotor(motors[0] || null);
      setView('MOTOR_DETAIL');
    } catch (err) {
      if (err instanceof DataServiceError) {
        setError(err.message);
      }
    } finally {
      setLoading(prev => ({ ...prev, motors: false }));
    }
  }, []);

  const resetToZones = useCallback(() => {
    setView('ZONES');
    setSelectedZone(null);
    setSelectedLine(null);
    setSelectedMotor(null);
    setChartData([]);
    setError(null);
    setLoadNonce(0);
    setMode('MANUAL');
    setAutoRefresh(false);
  }, []);

  const resetToLines = useCallback(() => {
    if (selectedZone) {
      setView('LINES');
      setSelectedLine(null);
      setSelectedMotor(null);
      setChartData([]);
      setLoadNonce(0);
      setMode('MANUAL');
      setAutoRefresh(false);
    }
  }, [selectedZone]);

  // Toggle week filter with debounce-like behavior
  const handleWeekToggle = useCallback((week: string) => {
    setFilters(prev => {
      const newWeeks = prev.selectedWeeks.includes(week)
        ? prev.selectedWeeks.filter(w => w !== week)
        : [...prev.selectedWeeks, week];

      if (newWeeks.length > 0) {
        return { ...prev, selectedWeeks: newWeeks };
      }
      return prev;
    });
  }, []);

  const handleDayToggle = useCallback((day: number) => {
    setFilters(prev => {
      // Toggle logic: if already selected, remove it
      const newDays = prev.selectedDays.includes(day)
        ? prev.selectedDays.filter(d => d !== day)
        : [...prev.selectedDays, day];

      // We can update directly. Empty array means 'ALL' in our logic (or None, but usually treated as ALL in API if filter is optional)
      return { ...prev, selectedDays: newDays };
    });
  }, []);

  const handleLoadData = useCallback(() => {
    if (!selectedZone || !selectedLine || !selectedMotor) return;
    if (filters.selectedDays.length === 0) {
      setError('Wybierz co najmniej jeden dzień, aby załadować dane.');
      return;
    }
    setError(null);
    setRefreshCounter(0);
    setLoading(prev => ({ ...prev, chartData: true }));
    setLoadNonce(n => n + 1);
  }, [filters.selectedDays.length, selectedLine, selectedMotor, selectedZone]);

  const handleModeChange = useCallback((nextMode: 'MANUAL' | 'AUTO') => {
    setMode(nextMode);
    setRefreshCounter(0);
    if (nextMode === 'AUTO') {
      setAutoRefresh(true);
      setLoadNonce(n => (n === 0 ? 1 : n + 1));
      setError(null);
    } else {
      setAutoRefresh(false);
      setLoadNonce(0);
      setChartData([]);
    }
  }, []);

  // Breadcrumbs config
  const breadcrumbs = useMemo(() => {
    const crumbs = [];
    crumbs.push({ label: 'All Zones', action: view !== 'ZONES' ? resetToZones : undefined });
    if (selectedZone) crumbs.push({ label: selectedZone.name, action: view !== 'LINES' ? resetToLines : undefined });
    if (selectedLine) crumbs.push({ label: selectedLine.name });
    return crumbs;
  }, [view, selectedZone, selectedLine, resetToZones, resetToLines]);

  return (
    <Layout
      breadcrumbs={breadcrumbs}
      theme={theme}
      onThemeChange={setTheme}
      apiConnected={apiConnected}
    >
      {/* Error Banner */}
      {error && (
        <div className="mb-6 p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-rose-800 dark:text-rose-200">Connection Error</h4>
            <p className="text-sm text-rose-700 dark:text-rose-300 mt-1">{error}</p>
            <p className="text-xs text-rose-600 dark:text-rose-400 mt-2">
              Make sure the API server is running: <code className="bg-rose-100 dark:bg-rose-800 px-1 rounded">npm run server</code>
            </p>
          </div>
        </div>
      )}

      {/* 1. ZONES VIEW */}
      {view === 'ZONES' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-[var(--text-primary)]">Manufacturing Zones</h2>
              <div className="text-sm text-[var(--text-secondary)] mt-1">Select a zone to view production lines</div>
            </div>
            <div className="text-sm bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full border border-blue-100 dark:border-blue-800 font-medium">
              {loading.zones ? '...' : `${zones.length} Active Zones`}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {loading.zones ? (
              <CardSkeleton count={4} />
            ) : zones.length === 0 ? (
              <div className="col-span-full text-center py-12 text-[var(--text-secondary)]">
                <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-amber-500" />
                <p className="text-lg font-medium">No zones found</p>
                <p className="text-sm mt-1">Check if the database has data</p>
              </div>
            ) : (
              zones.map((zone) => (
                <Card
                  key={zone.name}
                  title={zone.name}
                  subtitle={`${zone.lineCount} Lines • ${zone.motorCount} Motors`}
                  icon={<Layers className="h-6 w-6" />}
                  status={zone.status}
                  onClick={() => handleZoneClick(zone)}
                >
                  <div className="mt-4 pt-4 border-t border-[var(--border-primary)] flex justify-between text-sm">
                    <span className="text-[var(--text-secondary)]">Status</span>
                    <span className={`font-semibold ${zone.status === 'Healthy' ? 'text-emerald-600' :
                      zone.status === 'Warning' ? 'text-amber-600' : 'text-rose-600'
                      }`}>{zone.status}</span>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {/* 2. LINES VIEW */}
      {view === 'LINES' && selectedZone && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-[var(--text-primary)]">{selectedZone.name} Lines</h2>
              <div className="text-sm text-[var(--text-secondary)] mt-1">Select a line to analyze motors</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {loading.lines ? (
              <CardSkeleton count={3} />
            ) : lines.length === 0 ? (
              <div className="col-span-full text-center py-12 text-[var(--text-secondary)]">
                <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-amber-500" />
                <p className="text-lg font-medium">No lines found in this zone</p>
              </div>
            ) : (
              lines.map((line) => (
                <Card
                  key={line.name}
                  title={line.name}
                  subtitle={`${line.motorCount} Active Motors`}
                  icon={<Factory className="h-6 w-6" />}
                  onClick={() => handleLineClick(line)}
                  className="hover:border-[var(--accent-blue)]"
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* 3. MOTOR DASHBOARD VIEW */}
      {view === 'MOTOR_DETAIL' && selectedLine && (
        <div className="space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-500">

          {/* Compact Header Bar */}
          {loading.motors ? (
            <ControlsSkeleton />
          ) : (
            <div className="glass bg-[var(--bg-card)] p-3 rounded-lg border border-[var(--border-primary)] shadow-[var(--shadow-sm)] flex flex-wrap items-center justify-between gap-4 sticky top-[7.5rem] z-40">

              {/* Left: Zone/Line/Motor Info + Selector */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-[var(--text-secondary)] font-medium">Zone:</span>
                  <span className="font-bold text-[var(--text-primary)]">{selectedZone?.name}</span>
                  <span className="text-[var(--text-tertiary)]">|</span>
                  <span className="text-[var(--text-secondary)] font-medium">Line:</span>
                  <span className="font-bold text-[var(--text-primary)]">{selectedLine?.name}</span>
                </div>
                <div className="flex items-center gap-2 ml-2">
                  <Cog className="h-4 w-4 text-[var(--text-tertiary)]" />
                  <select
                    className="px-2 py-1 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded text-sm font-semibold focus:ring-2 focus:ring-blue-500 hover:bg-[var(--bg-card)] transition-colors cursor-pointer text-[var(--text-primary)]"
                    value={selectedMotor || ''}
                    onChange={(e) => setSelectedMotor(e.target.value)}
                  >
                    {availableMotors.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              {/* Middle: Status + Data age */}
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">
                  {loading.chartData ? '...' : `${chartData.length} pts`}
                </span>

                {/* Data Age Indicator */}
                <DataAgeIndicator lastTimestamp={lastDataTimestamp} autoRefresh={autoRefresh} />

                {autoRefresh && (
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded border border-emerald-100 dark:border-emerald-800 text-[10px] live-indicator">
                    <RefreshCw className="h-2.5 w-2.5 animate-spin" style={{ animationDuration: '3s' }} />
                    LIVE 10m
                  </span>
                )}
              </div>

              {/* Right: Filters + Auto-refresh checkbox */}
              <div className="flex items-center gap-4">
                {/* Mode toggle */}
                <div className="flex items-center gap-1 bg-[var(--bg-tertiary)] px-2 py-1 rounded border border-[var(--border-primary)]">
                  <button
                    onClick={() => handleModeChange('MANUAL')}
                    className={`px-2 py-1 rounded text-xs font-bold ${mode === 'MANUAL'
                      ? 'bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-primary)] shadow-sm'
                      : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                      }`}
                    title="Tryb: wybór tygodnia i dnia/dni + ręczne ładowanie"
                  >
                    Manual
                  </button>
                  <button
                    onClick={() => handleModeChange('AUTO')}
                    className={`px-2 py-1 rounded text-xs font-bold ${mode === 'AUTO'
                      ? 'bg-blue-600 text-white border border-blue-600 shadow-sm'
                      : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                      }`}
                    title="Tryb: Auto 10s, ostatnie 10 minut"
                  >
                    Auto 10s
                  </button>
                </div>

                {/* Week buttons */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--text-secondary)] uppercase font-bold tracking-tight">Week:</span>
                  <div className="flex gap-1">
                    {allWeeks.map(w => (
                      <button
                        key={w}
                        onClick={() => mode === 'MANUAL' && handleWeekToggle(w)}
                        className={`px-2 py-1 rounded text-xs font-bold border transition-all ${mode !== 'MANUAL'
                          ? 'cursor-not-allowed opacity-60 bg-[var(--bg-tertiary)] border-[var(--border-primary)]'
                          : filters.selectedWeeks.includes(w)
                            ? 'bg-blue-600 text-white border-blue-600 shadow-md transform scale-105'
                            : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-primary)] hover:bg-[var(--bg-tertiary)]'
                          }`}
                        disabled={mode !== 'MANUAL'}
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Day buttons */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--text-secondary)] uppercase font-bold tracking-tight">Day (1-7):</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5, 6, 7].map(d => (
                      <button
                        key={d}
                        onClick={() => mode === 'MANUAL' && handleDayToggle(d)}
                        className={`w-6 h-6 flex items-center justify-center rounded text-xs font-bold border transition-all ${mode !== 'MANUAL'
                          ? 'cursor-not-allowed opacity-60 bg-[var(--bg-tertiary)] border-[var(--border-primary)]'
                          : filters.selectedDays.includes(d)
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-md transform scale-105'
                            : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-primary)] hover:bg-[var(--bg-tertiary)]'
                          }`}
                        disabled={mode !== 'MANUAL'}
                        title={`Toggle Day ${d}`}
                      >
                        {d}
                      </button>
                    ))}
                    {filters.selectedDays.length === 0 && (
                      <span className="ml-1 text-[10px] text-[var(--text-tertiary)] font-medium uppercase self-center">{mode === 'MANUAL' ? '(wymagany wybór)' : '(auto)'}</span>
                    )}
                  </div>
                </div>

                {/* Load button (manual only) */}
                {mode === 'MANUAL' && (
                  <button
                    onClick={handleLoadData}
                    className={`flex items-center gap-2 px-3 py-2 rounded border font-bold text-xs transition-colors ${filters.selectedDays.length === 0
                      ? 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] border-[var(--border-primary)] cursor-not-allowed'
                      : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 shadow-sm'
                      }`}
                    disabled={filters.selectedDays.length === 0 || loading.chartData}
                    title="Załaduj dane dla wybranych dni"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    {loading.chartData ? 'Ładowanie...' : 'Ładuj dane'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Charts Area with Error Boundary */}
          <ErrorBoundary>
            {loading.chartData && chartData.length === 0 ? (
              <div className="space-y-2">
                <ChartSkeleton title="Average Current & Limits" />
                <ChartSkeleton title="Real-time Motor Current" />
                <ChartSkeleton title="Operational Status" />
              </div>
            ) : (
              <MotorCharts ref={chartsRef} data={chartData} autoRefresh={autoRefresh} />
            )}
          </ErrorBoundary>

        </div>
      )}
    </Layout>
  );
};

export default App;
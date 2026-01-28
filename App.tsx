import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Layout } from './components/Layout';
import { Card, KPICard } from './components/Card';
import { MotorCharts, MotorChartsHandle } from './components/MotorCharts';
import { getZones, getLines, getMotors, generateMotorData, getAvailableWeeks } from './services/dataService';
import { ZoneData, LineData, MotorLog, FilterState, AnalyticsSummary } from './types';
import { Factory, Cog, Zap, AlertTriangle, Layers, RotateCcw, RefreshCw } from 'lucide-react';

// View State Enum
type ViewState = 'ZONES' | 'LINES' | 'MOTOR_DETAIL';

const App = () => {
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
    selectedDay: 'ALL'
  });

  // Chart Data State
  const [chartData, setChartData] = useState<MotorLog[]>([]);
  const chartsRef = useRef<MotorChartsHandle>(null);

  // Initial Load
  useEffect(() => {
    let isMounted = true;
    (async () => {
      const zoneList = await getZones();
      const weeks = await getAvailableWeeks();
      if (!isMounted) return;
      setZones(zoneList);
      setAllWeeks(weeks);
      if (weeks.length > 0) {
        setFilters(prev => ({ ...prev, selectedWeeks: [weeks[0]] }));
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // Auto-refresh state with checkbox toggle
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshCounter, setRefreshCounter] = useState(0);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      setRefreshCounter(c => c + 1);
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Update Filters and Fetch Data (including auto-refresh trigger)
  useEffect(() => {
    let isMounted = true;
    if (selectedZone && selectedLine && selectedMotor) {
      (async () => {
        const data = await generateMotorData(
          selectedZone.name,
          selectedLine.name,
          selectedMotor,
          filters.selectedWeeks,
          filters.selectedDay
        );
        if (isMounted) setChartData(data);
      })();
    }
    return () => {
      isMounted = false;
    };
  }, [selectedZone, selectedLine, selectedMotor, filters, refreshCounter]);

  // Handle Navigation
  const handleZoneClick = async (zone: ZoneData) => {
    setSelectedZone(zone);
    const lineList = await getLines(zone.name);
    setLines(lineList);
    setView('LINES');
  };

  const handleLineClick = async (line: LineData) => {
    setSelectedLine(line);
    const motors = await getMotors(line.zone, line.name);
    setAvailableMotors(motors);
    setSelectedMotor(motors[0]);
    setView('MOTOR_DETAIL');
  };

  const resetToZones = () => {
    setView('ZONES');
    setSelectedZone(null);
    setSelectedLine(null);
    setSelectedMotor(null);
  };

  const resetToLines = () => {
    if (selectedZone) {
      setView('LINES');
      setSelectedLine(null);
      setSelectedMotor(null);
    }
  };

  // Compute Analytics
  const analytics: AnalyticsSummary = useMemo(() => {
    if (chartData.length === 0) return { totalRunningTime: 0, peakCurrent: 0, averageEfficiency: 0, cycles: 0, maxLimitBreaches: 0 };

    let totalRun = 0;
    let maxCur = 0;
    let breaches = 0;
    let transitions = 0;
    let wasOn = -1;

    chartData.forEach(d => {
      // Assuming approximately uniform sampling for running time estimation or use RunningTime from data if cumulative
      // Using d.isMotorOn which is 0 or 1
      if (d.isMotorOn === 1) totalRun += 1; // Count samples roughly

      if (d.motorCurrent > maxCur) maxCur = d.motorCurrent;
      if (d.motorCurrent > d.maxCurrentLimit) breaches++;

      if (d.isMotorOn !== wasOn) {
        if (d.isMotorOn === 1 && wasOn !== -1) transitions++;
        wasOn = d.isMotorOn;
      }
    });

    return {
      totalRunningTime: totalRun, // Simple count for relative metric
      peakCurrent: parseFloat(maxCur.toFixed(2)),
      averageEfficiency: 92, // Mock metric
      cycles: transitions,
      maxLimitBreaches: breaches
    };
  }, [chartData]);

  // Breadcrumbs config
  const breadcrumbs = useMemo(() => {
    const crumbs = [];
    crumbs.push({ label: 'All Zones', action: view !== 'ZONES' ? resetToZones : undefined });
    if (selectedZone) crumbs.push({ label: selectedZone.name, action: view !== 'LINES' ? resetToLines : undefined });
    if (selectedLine) crumbs.push({ label: selectedLine.name });
    return crumbs;
  }, [view, selectedZone, selectedLine]);

  return (
    <Layout breadcrumbs={breadcrumbs}>

      {/* 1. ZONES VIEW */}
      {view === 'ZONES' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Manufacturing Zones</h2>
              <div className="text-sm text-slate-500 mt-1">Select a zone to view production lines</div>
            </div>
            <div className="text-sm bg-blue-50 text-blue-700 px-3 py-1 rounded-full border border-blue-100 font-medium">
              {zones.length} Active Zones
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {zones.map((zone) => (
              <Card
                key={zone.name}
                title={zone.name}
                subtitle={`${zone.lineCount} Lines • ${zone.motorCount} Motors`}
                icon={<Layers className="h-6 w-6" />}
                status={zone.status}
                onClick={() => handleZoneClick(zone)}
              >
                <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between text-sm">
                  <span className="text-slate-500">Efficiency</span>
                  <span className="font-semibold text-slate-700">98.5%</span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* 2. LINES VIEW */}
      {view === 'LINES' && selectedZone && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{selectedZone.name} Lines</h2>
              <div className="text-sm text-slate-500 mt-1">Select a line to analyze motors</div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {lines.map((line) => (
              <Card
                key={line.name}
                title={line.name}
                subtitle={`${line.motorCount} Active Motors`}
                icon={<Factory className="h-6 w-6" />}
                onClick={() => handleLineClick(line)}
                className="hover:border-blue-400"
              />
            ))}
          </div>
        </div>
      )}

      {/* 3. MOTOR DASHBOARD VIEW */}
      {view === 'MOTOR_DETAIL' && selectedLine && (
        <div className="space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-500">

          {/* Compact Header Bar */}
          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4 sticky top-1 z-50">

            {/* Left: Zone/Line/Motor Info + Selector */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-500 font-medium">Zone:</span>
                <span className="font-bold text-slate-800">{selectedZone?.name}</span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-500 font-medium">Line:</span>
                <span className="font-bold text-slate-800">{selectedLine?.name}</span>
              </div>
              <div className="flex items-center gap-2 ml-2">
                <Cog className="h-4 w-4 text-slate-400" />
                <select
                  className="px-2 py-1 bg-slate-50 border border-slate-300 rounded text-sm font-semibold focus:ring-2 focus:ring-blue-500 hover:bg-white transition-colors cursor-pointer"
                  value={selectedMotor || ''}
                  onChange={(e) => setSelectedMotor(e.target.value)}
                >
                  {availableMotors.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>

            {/* Middle: Linked Charts Indicator & 10m Reset + LIVE status */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-blue-50/50 px-3 py-1 rounded-full border border-blue-100">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700">
                  <Layers className="h-3.5 w-3.5" />
                  <span>Synchronized Charts</span>
                </div>
                <button
                  onClick={() => chartsRef.current?.resetZoom()}
                  className="flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-blue-200 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all text-[10px] uppercase tracking-wider font-bold shadow-sm"
                  title="Reset view to last 10 minutes"
                >
                  <RotateCcw className="h-2.5 w-2.5" />
                  10 Min
                </button>
              </div>

              <div className="flex items-center gap-3 ml-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{chartData.length} pts</span>
                {autoRefresh && (
                  <span className="flex items-center gap-1 text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded border border-green-100 text-[10px]">
                    <RefreshCw className="h-2.5 w-2.5 animate-spin" style={{ animationDuration: '3s' }} />
                    LIVE
                  </span>
                )}
              </div>
            </div>

            {/* Right: Filters + Auto-refresh checkbox */}
            <div className="flex items-center gap-4">
              {/* Week buttons */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 uppercase font-bold tracking-tight">Week:</span>
                <div className="flex gap-1">
                  {allWeeks.map(w => (
                    <button
                      key={w}
                      onClick={() => {
                        const newWeeks = filters.selectedWeeks.includes(w)
                          ? filters.selectedWeeks.filter(wk => wk !== w)
                          : [...filters.selectedWeeks, w];
                        if (newWeeks.length > 0) setFilters({ ...filters, selectedWeeks: newWeeks });
                      }}
                      className={`px-2 py-1 rounded text-xs font-bold border transition-all ${filters.selectedWeeks.includes(w)
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md transform scale-105'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>

              {/* Day dropdown */}
              <select
                className="px-2 py-1 bg-white border border-slate-300 rounded text-xs font-bold text-slate-700 cursor-pointer hover:border-blue-400 transition-colors"
                value={filters.selectedDay}
                onChange={(e) => setFilters({ ...filters, selectedDay: e.target.value === 'ALL' ? 'ALL' : parseInt(e.target.value) })}
              >
                <option value="ALL">All Days</option>
                {[1, 2, 3, 4, 5, 6, 7].map(d => <option key={d} value={d}>Day {d}</option>)}
              </select>

              {/* Auto-refresh checkbox */}
              <label className="flex items-center gap-2 cursor-pointer bg-slate-50 px-2 py-1 rounded border border-slate-200 hover:bg-white transition-colors">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 accent-blue-600"
                />
                <span className="text-xs font-bold text-slate-600 uppercase tracking-tighter">Auto-refresh 10s</span>
              </label>
            </div>
          </div>

          {/* Charts Area - Full Height */}
          <MotorCharts ref={chartsRef} data={chartData} autoRefresh={autoRefresh} />

        </div>
      )}
    </Layout>
  );
};

export default App;
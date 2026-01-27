import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Brush,
  AreaChart,
  LineChart,
  ReferenceLine,
  Scatter,
  ScatterChart,
  ZAxis
} from 'recharts';
import { MotorLog } from '../types';
import { ZoomIn, ZoomOut, RotateCcw, Table, X } from 'lucide-react';

interface MotorChartsProps {
  data: MotorLog[];
}

const formatRunningTime = (seconds: number): string => {
  if (seconds < 1) {
    return `${(seconds * 1000).toFixed(0)} ms`;
  } else if (seconds < 60) {
    return `${seconds.toFixed(2)} s`;
  } else {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return `${mins}m ${secs}s`;
  }
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as MotorLog;
    // Only show tooltip when avgCurrent > 0
    if (data.avgCurrent <= 0) return null;
    
    return (
      <div className="bg-slate-800 text-white p-4 rounded-lg shadow-xl border border-slate-700 text-xs z-50">
        <div className="font-bold border-b border-slate-600 pb-2 mb-2 text-sm">
          {data.timestamp}
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <span className="text-slate-400">Zone:</span>
          <span className="font-medium">{data.zone}</span>
          
          <span className="text-slate-400">Line:</span>
          <span className="font-medium">{data.line}</span>
          
          <span className="text-slate-400">Motor:</span>
          <span className="font-medium">{data.motorName}</span>

          <span className="text-slate-400">Date Time:</span>
          <span className="font-medium">{data.timestamp}</span>
          
          <span className="text-slate-400">Avg Value:</span>
          <span className="font-mono text-emerald-400 font-bold">{data.avgCurrent.toFixed(2)} A</span>
          
          <span className="text-slate-400">Max Limit:</span>
          <span className="font-mono text-rose-400 font-bold">{data.maxCurrentLimit.toFixed(2)} A</span>
          
          <span className="text-slate-400">Running Time:</span>
          <span className="font-mono text-cyan-400">{formatRunningTime(data.runningTime)}</span>
        </div>
      </div>
    );
  }
  return null;
};

export const MotorCharts: React.FC<MotorChartsProps> = ({ data }) => {
  const [activePoint, setActivePoint] = useState<MotorLog | null>(null);
  const [isPinned, setIsPinned] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [showOnOffTable, setShowOnOffTable] = useState(false);
  
  // Zoom state - percentage of data to show (100 = all, 50 = half, etc.)
  const [zoomLevel, setZoomLevel] = useState(100);
  const [zoomStart, setZoomStart] = useState(0);
  
  // Computed visible data based on zoom
  const visibleData = useMemo(() => {
    if (zoomLevel >= 100 || data.length === 0) return data;
    const visibleCount = Math.max(10, Math.floor(data.length * (zoomLevel / 100)));
    const maxStart = data.length - visibleCount;
    const start = Math.min(zoomStart, maxStart);
    return data.slice(start, start + visibleCount);
  }, [data, zoomLevel, zoomStart]);
  
  // Filter AvgCurrent data - only show points where avgCurrent > 0
  const avgCurrentData = useMemo(() => {
    return visibleData.map(d => ({
      ...d,
      avgCurrentFiltered: d.avgCurrent > 0 ? d.avgCurrent : null
    }));
  }, [visibleData]);
  
  // Extract ON/OFF transitions for table display
  const onOffTransitions = useMemo(() => {
    const transitions: { timestamp: string; state: 'ON' | 'OFF'; prevState: 'ON' | 'OFF' | null }[] = [];
    for (let i = 0; i < visibleData.length; i++) {
      const current = visibleData[i];
      const prev = i > 0 ? visibleData[i - 1] : null;
      
      // Detect state change
      if (!prev || current.isMotorOn !== prev.isMotorOn) {
        transitions.push({
          timestamp: current.timestamp,
          state: current.isMotorOn === 1 ? 'ON' : 'OFF',
          prevState: prev ? (prev.isMotorOn === 1 ? 'ON' : 'OFF') : null
        });
      }
    }
    return transitions;
  }, [visibleData]);
  
  // Create step chart data with proper transitions (duplicate timestamps for vertical lines)
  // Logic: 
  // 1. If timestamp is same as prev, preserve strict order (user requirement: 0 then 1 = start).
  // 2. If timestamp differs and state changed, insert a "hold" point to create square wave.
  const onOffChartData = useMemo(() => {
    const result: { timestamp: string; isMotorOn: number; originalTimestamp: string }[] = [];
    
    for (let i = 0; i < visibleData.length; i++) {
      const current = visibleData[i];
      const prev = i > 0 ? visibleData[i - 1] : null;
      
      if (prev) {
        // Check if this is a sub-second/immediate sequence (same timestamp string)
        if (current.timestamp === prev.timestamp) {
            // User explicitly wants to see this sequence preserved raw (e.g. 0 then 1 at same time)
            // Do not insert anything, just push current
            result.push({
                timestamp: current.timestamp,
                isMotorOn: current.isMotorOn,
                originalTimestamp: current.timestamp
            });
        } else {
            // New timestamp. Check if value changed from previous point's FINAL value.
            // Note: prev element in loop is visibleData[i-1].
            if (current.isMotorOn !== prev.isMotorOn) {
                // Square wave logic:
                // From PrevTime to CurrTime, the value held PreValue.
                // So at CurrTime, we first plot PrevValue (vertical drop/rise start)
                result.push({
                    timestamp: current.timestamp,
                    isMotorOn: prev.isMotorOn,
                    originalTimestamp: current.timestamp
                });
                // Then at CurrTime, we plot CurrValue (vertical drop/rise end)
                result.push({
                    timestamp: current.timestamp,
                    isMotorOn: current.isMotorOn,
                    originalTimestamp: current.timestamp
                });
            } else {
                // No change, line continues
                result.push({
                    timestamp: current.timestamp,
                    isMotorOn: current.isMotorOn,
                    originalTimestamp: current.timestamp
                });
            }
        }
      } else {
        // First point
        result.push({
          timestamp: current.timestamp,
          isMotorOn: current.isMotorOn,
          originalTimestamp: current.timestamp
        });
      }
    }
    
    return result;
  }, [visibleData]);
  
  const handleZoomIn = () => {
    setZoomLevel(prev => Math.max(10, prev - 20));
  };
  
  const handleZoomOut = () => {
    setZoomLevel(prev => Math.min(100, prev + 20));
  };
  
  const handleZoomReset = () => {
    setZoomLevel(100);
    setZoomStart(0);
  };
  
  const handlePanLeft = () => {
    setZoomStart(prev => Math.max(0, prev - Math.floor(data.length * 0.1)));
  };
  
  const handlePanRight = () => {
    const visibleCount = Math.floor(data.length * (zoomLevel / 100));
    const maxStart = data.length - visibleCount;
    setZoomStart(prev => Math.min(maxStart, prev + Math.floor(data.length * 0.1)));
  };
  
  const formatXAxis = (tickItem: string) => {
    if (!tickItem) return '';
    // Expected format: "2026-01-26 10:11:06.130" or ISO
    const parts = tickItem.split('T');
    if (parts.length > 1) {
       const timePart = parts[1].replace('Z', '');
       const timeParts = timePart.split(':');
       const seconds = timeParts[2]?.split('.')[0] || '00';
       return `${timeParts[0]}:${timeParts[1]}:${seconds}`;
    }
    // Fallback for space-separated format
    const spaceParts = tickItem.split(' ');
    if (spaceParts.length > 1) {
       const timeParts = spaceParts[1].split(':');
       return `${timeParts[0]}:${timeParts[1]}:${timeParts[2]?.split('.')[0]}`;
    }
    return tickItem;
  };

  useEffect(() => {
    if (visibleData.length > 0) {
      setActivePoint(visibleData[visibleData.length - 1]);
      setIsPinned(false);
    } else {
      setActivePoint(null);
      setIsPinned(false);
    }
  }, [visibleData]);

  const handleMove = useCallback(
    (state: any) => {
      if (!state || !state.activePayload || state.activePayload.length === 0) return;
      if (isPinned && !isScrubbing) return;
      const point = state.activePayload[0].payload as MotorLog;
      setActivePoint(point);
    },
    [isPinned, isScrubbing]
  );

  const handleLeave = useCallback(() => {
    if (!isPinned) {
      setActivePoint(visibleData.length > 0 ? visibleData[visibleData.length - 1] : null);
    }
  }, [visibleData, isPinned]);

  const handleClick = useCallback(() => {
    if (!activePoint) return;
    setIsPinned(prev => !prev);
  }, [activePoint]);

  const activeSummary = useMemo(() => {
    if (!activePoint) return null;
    return {
      timestamp: activePoint.timestamp,
      avgCurrent: activePoint.avgCurrent,
      motorCurrent: activePoint.motorCurrent,
      runningTime: activePoint.runningTime,
      maxCurrentLimit: activePoint.maxCurrentLimit,
      isMotorOn: activePoint.isMotorOn
    };
  }, [activePoint]);

  if (!data || data.length === 0) {
    return (
        <div className="h-96 flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
            <p>No telemetry data available for selected filters.</p>
            <p className="text-xs mt-2">Try selecting a different Production Week or Day.</p>
        </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">

      {/* Zoom Controls - Sticky */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-lg flex flex-wrap items-center justify-between gap-4 sticky top-16 z-40">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-600">Zoom:</span>
          <button
            onClick={handleZoomIn}
            disabled={zoomLevel <= 10}
            className="p-2 rounded-lg bg-slate-100 hover:bg-blue-100 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="h-5 w-5" />
          </button>
          <button
            onClick={handleZoomOut}
            disabled={zoomLevel >= 100}
            className="p-2 rounded-lg bg-slate-100 hover:bg-blue-100 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="h-5 w-5" />
          </button>
          <button
            onClick={handleZoomReset}
            className="p-2 rounded-lg bg-slate-100 hover:bg-blue-100 hover:text-blue-600 transition-colors"
            title="Reset Zoom"
          >
            <RotateCcw className="h-5 w-5" />
          </button>
          <span className="text-sm text-slate-500 ml-2">{zoomLevel}%</span>
        </div>
        
        {zoomLevel < 100 && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-600">Pan:</span>
            <button
              onClick={handlePanLeft}
              disabled={zoomStart <= 0}
              className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-blue-100 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              ← Left
            </button>
            <button
              onClick={handlePanRight}
              className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-blue-100 hover:text-blue-600 transition-colors text-sm font-medium"
            >
              Right →
            </button>
          </div>
        )}
        
        <div className="text-sm text-slate-500">
          Showing {visibleData.length} of {data.length} points
        </div>
      </div>

      {/* Cursor Summary */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className={`h-2 w-2 rounded-full ${isPinned ? 'bg-blue-600' : 'bg-slate-400'}`}></span>
          <div>
            <p className="text-xs uppercase tracking-wide font-semibold text-slate-500">Scrub Line</p>
            <p className="text-sm text-slate-700">Click chart to {isPinned ? 'unpin' : 'pin'} the vertical cursor</p>
          </div>
        </div>
        {activeSummary && (
          <div className="flex flex-wrap gap-4 text-sm text-slate-600">
            <span className="font-medium text-slate-800">{activeSummary.timestamp}</span>
            <span>Avg: <strong className="text-slate-900">{activeSummary.avgCurrent.toFixed(2)} A</strong></span>
            <span>Current: <strong className="text-slate-900">{activeSummary.motorCurrent.toFixed(2)} A</strong></span>
            <span>Limit: <strong className="text-rose-600">{activeSummary.maxCurrentLimit.toFixed(2)} A</strong></span>
            <span>Runtime: <strong className="text-cyan-600">{formatRunningTime(activeSummary.runningTime)}</strong></span>
            <span>Status: <strong className="text-slate-900">{activeSummary.isMotorOn === 1 ? 'ON' : 'OFF'}</strong></span>
          </div>
        )}
      </div>
      
      {/* Chart 1: Avg Current & Max Limit */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="mb-6 flex justify-between items-center">
            <div>
                <h3 className="font-bold text-slate-800 text-lg">Average Current & Limits</h3>
                <p className="text-slate-500 text-sm">Compare average performance against safety thresholds</p>
            </div>
            <div className="flex gap-2">
                <span className="flex items-center text-xs text-rose-600 font-medium bg-rose-50 px-2 py-1 rounded border border-rose-100">
                    <div className="w-4 h-0.5 bg-rose-500 mr-1" style={{borderTop: '2px dashed #f43f5e'}}></div> Limit
                </span>
                <span className="flex items-center text-xs text-blue-600 font-medium bg-blue-50 px-2 py-1 rounded border border-blue-100">
                    <div className="w-2 h-2 rounded-full bg-blue-500 mr-1"></div> Avg (scatter)
                </span>
            </div>
        </div>
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={avgCurrentData}
              syncId="motorSync"
              onMouseMove={handleMove}
              onMouseLeave={handleLeave}
              onMouseDown={() => setIsScrubbing(true)}
              onMouseUp={() => setIsScrubbing(false)}
              onClick={handleClick}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={formatXAxis} 
                stroke="#94a3b8" 
                tick={{fontSize: 11}}
                minTickGap={30}
              />
              <YAxis unit="A" stroke="#94a3b8" tick={{fontSize: 11}} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#64748b', strokeWidth: 1, strokeDasharray: '4 4' }} />

              {activePoint && (
                <ReferenceLine x={activePoint.timestamp} stroke="#0f172a" strokeDasharray="6 4" />
              )}
              
              {/* Max Current Limit Line */}
              <Line
                type="step"
                dataKey="maxCurrentLimit"
                stroke="#f43f5e"
                strokeWidth={2}
                dot={false}
                activeDot={false}
                strokeDasharray="5 5"
                isAnimationActive={false}
              />
              
              {/* Average Current as SCATTER POINTS - only where avgCurrent > 0 */}
              <Scatter
                dataKey="avgCurrentFiltered"
                fill="#0ea5e9"
                shape="circle"
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 2: Real-time Motor Current */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="font-bold text-slate-800 text-lg mb-2">Real-time Motor Current</h3>
        <p className="text-slate-500 text-sm mb-6">Instantaneous current draw over time</p>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={visibleData}
              syncId="motorSync"
              onMouseMove={handleMove}
              onMouseLeave={handleLeave}
              onMouseDown={() => setIsScrubbing(true)}
              onMouseUp={() => setIsScrubbing(false)}
              onClick={handleClick}
            >
              <defs>
                <linearGradient id="colorCurrent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.05}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="timestamp" tickFormatter={formatXAxis} stroke="#94a3b8" tick={{fontSize: 11}} minTickGap={30} />
              <YAxis unit="A" stroke="#94a3b8" tick={{fontSize: 11}} />
              <Tooltip 
                labelFormatter={(label) => formatXAxis(label)}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              {activePoint && (
                <ReferenceLine x={activePoint.timestamp} stroke="#0f172a" strokeDasharray="6 4" />
              )}
              <Area 
                type="monotone" 
                dataKey="motorCurrent" 
                stroke="#8b5cf6" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorCurrent)" 
                isAnimationActive={true}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 3: ON/OFF Status */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="font-bold text-slate-800 text-lg">Operational Status</h3>
            <p className="text-slate-500 text-sm">Machine run cycles (1 = ON, 0 = OFF)</p>
          </div>
          <button
            onClick={() => setShowOnOffTable(!showOnOffTable)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              showOnOffTable 
                ? 'bg-emerald-600 text-white hover:bg-emerald-700' 
                : 'bg-slate-100 text-slate-700 hover:bg-emerald-100 hover:text-emerald-700'
            }`}
          >
            {showOnOffTable ? <X className="h-4 w-4" /> : <Table className="h-4 w-4" />}
            {showOnOffTable ? 'Hide Table' : 'Show Data Table'}
          </button>
        </div>
        
        {/* ON/OFF Table */}
        {showOnOffTable && (
          <div className="mb-6 max-h-96 overflow-auto border border-slate-200 rounded-lg shadow-inner bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 sticky top-0 border-b border-slate-200 z-10">
                <tr>
                  <th className="px-4 py-2 text-left font-mono font-semibold text-slate-600">Timestamp</th>
                  <th className="px-4 py-2 text-left font-mono font-semibold text-slate-600">Value (0/1)</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-600">State</th>
                </tr>
              </thead>
              <tbody>
                {onOffChartData.map((row, idx) => {
                    // Check if this row is start of a new change to highlight it?
                    // Optional: Highlight rows where value is different from prev?
                    return (
                        <tr key={idx} className={`border-b border-slate-100 hover:bg-slate-50 ${row.isMotorOn === 1 ? 'bg-emerald-50/30' : ''}`}>
                            <td className="px-4 py-1 font-mono text-xs text-slate-600">{row.timestamp}</td>
                            <td className="px-4 py-1 font-mono font-bold text-slate-800">{row.isMotorOn}</td>
                            <td className="px-4 py-1">
                                <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                                    row.isMotorOn === 1 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                                }`}>
                                    {row.isMotorOn === 1 ? 'ON' : 'OFF'}
                                </span>
                            </td>
                        </tr>
                    );
                })}
              </tbody>
            </table>
          </div>
        )}
        
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={onOffChartData}
              syncId="motorSync"
            >
              <defs>
                <linearGradient id="colorOnOff" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.6}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="timestamp" tickFormatter={formatXAxis} stroke="#94a3b8" tick={{fontSize: 11}} minTickGap={30} />
              <YAxis 
                type="number" 
                domain={[0, 1.2]} 
                ticks={[0, 1]} 
                tickFormatter={(val) => val === 1 ? 'ON' : 'OFF'}
                stroke="#94a3b8"
                tick={{fontSize: 11, fontWeight: 600}}
              />
              <Tooltip 
                labelFormatter={(label) => formatXAxis(label)}
                formatter={(value: number) => [value === 1 ? 'Running' : 'Stopped', 'Status']}
                cursor={{ stroke: '#64748b', strokeWidth: 1 }}
              />
              {activePoint && (
                <ReferenceLine x={activePoint.timestamp} stroke="#0f172a" strokeDasharray="6 4" />
              )}
              <Area 
                type="linear" 
                dataKey="isMotorOn" 
                stroke="#10b981" 
                strokeWidth={2} 
                fill="url(#colorOnOff)"
                fillOpacity={1}
                dot={false}
                activeDot={{ r: 4, fill: '#10b981' }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      
    </div>
  );
};
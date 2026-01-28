import React, { useMemo, useState, useEffect, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { MotorLog } from '../types';
import { Table, X, Clock, AlertCircle } from 'lucide-react';

interface MotorChartsProps {
  data: MotorLog[];
  autoRefresh?: boolean;
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

// Group ID for chart synchronization
const CHART_GROUP = 'motor-charts-group';

// Parse timestamp string as "naive" - returns UTC ms where UTC values match the DB string
// This ensures we display exactly what's in the database
const parseNaiveTimestamp = (timestamp: string | number): number => {
  if (typeof timestamp === 'number') return timestamp;
  if (!timestamp) return Date.now();
  
  // Handle format: "2024-01-28 14:30:00.000" or "2024-01-28T14:30:00.000"
  const normalized = String(timestamp).replace(' ', 'T').replace(/Z$/, '');
  
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?/);
  if (match) {
    const [, year, month, day, hours, minutes, seconds, ms = '0'] = match;
    return Date.UTC(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hours),
      parseInt(minutes),
      parseInt(seconds),
      parseInt(ms.padEnd(3, '0'))
    );
  }
  
  return new Date(normalized).getTime();
};

// Format timestamp for tooltip - displays using UTC to show exact database value
const formatTooltipTime = (timestamp: string | number): string => {
  const ms = typeof timestamp === 'number' ? timestamp : parseNaiveTimestamp(timestamp);
  const date = new Date(ms);
  
  // Use UTC methods to display the exact value from the database
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  const milliseconds = String(date.getUTCMilliseconds()).padStart(3, '0');
  
  return `${day}/${month}/${year}, ${hours}:${minutes}:${seconds}.${milliseconds}`;
};

// Format timestamp for table display - exact database value
const formatTableTimestamp = (timestampMs: number): string => {
  const date = new Date(timestampMs);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  const ms = String(date.getUTCMilliseconds()).padStart(3, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${ms}`;
};

// Get current local time as "naive UTC" (local time values stored as UTC)
// This matches our data format where database local times are stored as UTC
const getNowAsNaiveUTC = (): number => {
  const now = new Date();
  return Date.UTC(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
    now.getMilliseconds()
  );
};

export interface MotorChartsHandle {
  resetZoom: () => void;
}

// Helper to get CSS variable value
const getCSSVar = (name: string, fallback: string): string => {
  if (typeof window === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
};

export const MotorCharts = React.forwardRef<MotorChartsHandle, MotorChartsProps>(({ data, autoRefresh = false }, ref) => {
  const [showOnOffTable, setShowOnOffTable] = useState(false);

  // Refs for chart instances
  const chart1Ref = useRef<ReactECharts>(null);
  const chart2Ref = useRef<ReactECharts>(null);
  const chart3Ref = useRef<ReactECharts>(null);

  // Connect charts for synchronized zoom/pan
  useEffect(() => {
    const connectCharts = () => {
      const chart1 = chart1Ref.current?.getEchartsInstance();
      const chart2 = chart2Ref.current?.getEchartsInstance();
      const chart3 = chart3Ref.current?.getEchartsInstance();

      if (chart1 && chart2 && chart3) {
        // Connect all charts to the same group - this syncs zoom/pan automatically!
        echarts.connect(CHART_GROUP);
      }
    };

    // Wait for charts to initialize
    const timer = setTimeout(connectCharts, 500);
    return () => clearTimeout(timer);
  }, [data]);

  // Calculate 10-minute window based on CURRENT TIME (not last data timestamp)
  // This ensures we always see the "live" window, even if data is old
  const [currentTime, setCurrentTime] = useState(getNowAsNaiveUTC());

  // Update current time every 10 seconds (synced with auto-refresh)
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      setCurrentTime(getNowAsNaiveUTC());
    }, 10000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const getLast10MinRange = useMemo(() => {
    const now = currentTime;
    const tenMinutes = 10 * 60 * 1000;
    const startTs = now - tenMinutes;

    return { startValue: startTs, endValue: now };
  }, [currentTime]);

  // Auto-zoom to current 10-minute window when:
  // 1. Component mounts (initial render)
  // 2. currentTime updates (every 10 seconds when autoRefresh is ON)
  // 3. autoRefresh is enabled
  useEffect(() => {
    // Only apply zoom if autoRefresh is ON.
    // If OFF, we want to let the user see the full data or zoom manually.
    if (!autoRefresh) return;

    const range = getLast10MinRange;

    const applyZoom = () => {
      const charts = [
        chart1Ref.current?.getEchartsInstance(),
        chart2Ref.current?.getEchartsInstance(),
        chart3Ref.current?.getEchartsInstance()
      ];

      charts.forEach(chart => {
        if (chart) {
          chart.dispatchAction({
            type: 'dataZoom',
            startValue: range.startValue,
            endValue: range.endValue
          });
        }
      });
    };

    // Small delay to ensure charts are ready
    const timer = setTimeout(applyZoom, 100);
    return () => clearTimeout(timer);
  }, [currentTime, getLast10MinRange]);

  // Manual reset zoom to last 10 minutes (from NOW)
  const handleResetZoom = () => {
    // Update current time to NOW when manually resetting
    const now = getNowAsNaiveUTC();
    setCurrentTime(now);

    const tenMinutes = 10 * 60 * 1000;
    const range = { startValue: now - tenMinutes, endValue: now };

    const charts = [
      chart1Ref.current?.getEchartsInstance(),
      chart2Ref.current?.getEchartsInstance(),
      chart3Ref.current?.getEchartsInstance()
    ];

    charts.forEach(chart => {
      if (chart) {
        chart.dispatchAction({
          type: 'dataZoom',
          startValue: range.startValue,
          endValue: range.endValue
        });
      }
    });
  };

  // Expose resetZoom via ref
  React.useImperativeHandle(ref, () => ({
    resetZoom: handleResetZoom
  }));

  // Prepare chart data
  const chartData = useMemo(() => {
    return data.map(d => ({
      timestamp: d.timestamp,
      timestampMs: d.timestampObj, // Use pre-parsed naive timestamp
      avgCurrent: d.avgCurrent > 0 ? d.avgCurrent : null,
      maxLimit: d.maxCurrentLimit,
      motorCurrent: d.motorCurrent,
      isMotorOn: d.isMotorOn,
      zone: d.zone,
      line: d.line,
      motorName: d.motorName,
      runningTime: formatRunningTime(d.runningTime)
    }));
  }, [data]);

  // ON/OFF data - deduplicated for step chart
  const onOffData = useMemo(() => {
    if (data.length === 0) return [];

    const result: { timestampMs: number; value: number; label: string }[] = [];
    let lastState: number | null = null;
    let lastTs: string | null = null;

    for (const current of data) {
      if (current.timestamp === lastTs && current.isMotorOn === lastState) {
        continue;
      }

      if (lastState === null || current.isMotorOn !== lastState || current.timestamp !== lastTs) {
        result.push({
          timestampMs: current.timestampObj, // Use pre-parsed naive timestamp
          value: current.isMotorOn,
          label: current.isMotorOn === 1 ? 'ON' : 'OFF'
        });
        lastState = current.isMotorOn;
        lastTs = current.timestamp;
      }
    }

    return result;
  }, [data]);

  // Common chart options - with theme-aware colors and FORCED time range
  const getCommonOptions = () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    // FORCE the time axis to show CURRENT TIME, not data time
    const timeRange = getLast10MinRange;

    // Only force zoom/axis if autoRefresh is ON
    const zoomConfig = autoRefresh ? {
      startValue: timeRange.startValue,
      endValue: timeRange.endValue
    } : {
      start: 0,
      end: 100
    };

    const axisConfig = autoRefresh ? {
      min: timeRange.startValue,
      max: timeRange.endValue
    } : {};

    return {
      animation: false,
      backgroundColor: 'transparent',
      useUTC: true, // CRITICAL: Tell ECharts to use UTC for time display
      textStyle: {
        color: isDark ? '#cbd5e1' : '#475569'
      },
      grid: {
        left: 55,
        right: 15,
        top: 15,
        bottom: 50
      },
      // DataZoom for user interaction (scrolling/zooming)
      dataZoom: [
        {
          type: 'inside',
          xAxisIndex: 0,
          filterMode: 'none',
          ...zoomConfig
        },
        {
          type: 'slider',
          xAxisIndex: 0,
          filterMode: 'none',
          height: 18,
          bottom: 8,
          backgroundColor: isDark ? '#334155' : '#f1f5f9',
          fillerColor: isDark ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.2)',
          borderColor: isDark ? '#475569' : '#cbd5e1',
          handleStyle: {
            color: isDark ? '#60a5fa' : '#3b82f6'
          },
          textStyle: {
            color: isDark ? '#94a3b8' : '#64748b'
          },
          ...zoomConfig
        }
      ],
      toolbox: {
        feature: {
          dataZoom: {
            yAxisIndex: 'none'
          },
          restore: {}
        },
        right: 20,
        iconStyle: {
          borderColor: isDark ? '#94a3b8' : '#64748b'
        }
      },
      // Return xAxis config separately so each chart can merge it
      _xAxisTimeRange: axisConfig
    };
  };

  // Chart 1: Avg Current & Max Limit
  const chart1Options = useMemo(() => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const axisColor = isDark ? '#64748b' : '#94a3b8';
    const splitLineColor = isDark ? '#334155' : '#e2e8f0';

    const commonOpts = getCommonOptions();
    const { _xAxisTimeRange, ...restCommon } = commonOpts as any;

    return {
      ...restCommon,
      tooltip: {
        trigger: 'axis',
        confine: false,
        appendToBody: true,
        backgroundColor: isDark ? '#1e293b' : '#ffffff',
        borderColor: isDark ? '#334155' : '#e2e8f0',
        textStyle: {
          color: isDark ? '#f1f5f9' : '#1e293b'
        },
        formatter: (params: any) => {
          if (!params || params.length === 0) return '';
          const dataIndex = params[0].dataIndex;
          const d = chartData[dataIndex];
          if (!d || d.avgCurrent === null) return '';

          const timeWithMs = formatTooltipTime(d.timestamp);

          return `
            <div style="font-weight: bold; margin-bottom: 8px;">${timeWithMs}</div>
            <div style="color: #0ea5e9; font-weight: bold;">Avg Current: ${d.avgCurrent?.toFixed(2)} A</div>
            <div style="color: #f43f5e;">Max Limit: ${d.maxLimit.toFixed(2)} A</div>
            <div>Running Time: ${d.runningTime}</div>
          `;
        }
      },
      xAxis: {
        type: 'time',
        min: _xAxisTimeRange.min,
        max: _xAxisTimeRange.max,
        axisLine: { lineStyle: { color: axisColor } },
        axisLabel: {
          formatter: '{HH}:{mm}:{ss}',
          color: isDark ? '#94a3b8' : '#64748b'
        },
        splitLine: { show: false }
      },
      yAxis: {
        type: 'value',
        name: 'Current (A)',
        nameTextStyle: { color: isDark ? '#94a3b8' : '#64748b' },
        axisLine: { lineStyle: { color: axisColor } },
        axisLabel: {
          formatter: '{value} A',
          color: isDark ? '#94a3b8' : '#64748b'
        },
        splitLine: { lineStyle: { color: splitLineColor } }
      },
      series: [
        {
          name: 'Avg Current',
          type: 'scatter',
          symbolSize: 10,
          data: chartData.map(d => [d.timestampMs, d.avgCurrent]),
          itemStyle: {
            color: '#0ea5e9'
          }
        },
        {
          name: 'Max Limit',
          type: 'line',
          step: 'end',
          lineStyle: {
            color: '#f43f5e',
            width: 2,
            type: 'dashed'
          },
          showSymbol: false,
          data: chartData.map(d => [d.timestampMs, d.maxLimit])
        }
      ]
    };
  }, [chartData, getLast10MinRange, autoRefresh]);

  // Chart 2: Real-time Motor Current
  const chart2Options = useMemo(() => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const axisColor = isDark ? '#64748b' : '#94a3b8';
    const splitLineColor = isDark ? '#334155' : '#e2e8f0';

    const commonOpts = getCommonOptions();
    const { _xAxisTimeRange, ...restCommon } = commonOpts as any;

    return {
      ...restCommon,
      tooltip: {
        trigger: 'axis',
        backgroundColor: isDark ? '#1e293b' : '#ffffff',
        borderColor: isDark ? '#334155' : '#e2e8f0',
        textStyle: {
          color: isDark ? '#f1f5f9' : '#1e293b'
        },
        formatter: (params: any) => {
          if (!params || params.length === 0) return '';
          const p = params[0];
          const timeWithMs = formatTooltipTime(p.value[0]);
          return `
            <div style="font-weight: bold; margin-bottom: 8px;">${timeWithMs}</div>
            <div style="color: #8b5cf6;">Motor Current: ${p.value[1]?.toFixed(2)} A</div>
          `;
        }
      },
      xAxis: {
        type: 'time',
        min: _xAxisTimeRange.min,
        max: _xAxisTimeRange.max,
        axisLine: { lineStyle: { color: axisColor } },
        axisLabel: {
          formatter: '{HH}:{mm}:{ss}',
          color: isDark ? '#94a3b8' : '#64748b'
        },
        splitLine: { show: false }
      },
      yAxis: {
        type: 'value',
        name: 'Current (A)',
        nameTextStyle: { color: isDark ? '#94a3b8' : '#64748b' },
        axisLine: { lineStyle: { color: axisColor } },
        axisLabel: {
          formatter: '{value} A',
          color: isDark ? '#94a3b8' : '#64748b'
        },
        splitLine: { lineStyle: { color: splitLineColor } }
      },
      series: [
        {
          name: 'Motor Current',
          type: 'line',
          areaStyle: {
            color: isDark
              ? 'rgba(139, 92, 246, 0.15)'
              : 'rgba(139, 92, 246, 0.2)'
          },
          lineStyle: {
            color: '#8b5cf6',
            width: 2
          },
          showSymbol: false,
          data: chartData.map(d => [d.timestampMs, d.motorCurrent])
        }
      ]
    };
  }, [chartData, getLast10MinRange, autoRefresh]);

  // Chart 3: ON/OFF Status
  const chart3Options = useMemo(() => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const axisColor = isDark ? '#64748b' : '#94a3b8';
    const splitLineColor = isDark ? '#334155' : '#e2e8f0';

    const commonOpts = getCommonOptions();
    const { _xAxisTimeRange, ...restCommon } = commonOpts as any;

    return {
      ...restCommon,
      tooltip: {
        trigger: 'axis',
        backgroundColor: isDark ? '#1e293b' : '#ffffff',
        borderColor: isDark ? '#334155' : '#e2e8f0',
        textStyle: {
          color: isDark ? '#f1f5f9' : '#1e293b'
        },
        formatter: (params: any) => {
          if (!params || params.length === 0) return '';
          const p = params[0];
          const timeWithMs = formatTooltipTime(p.value[0]);
          return `
            <div style="font-weight: bold; margin-bottom: 8px;">${timeWithMs}</div>
            <div style="color: #10b981;">Status: ${p.value[1] === 1 ? 'ON' : 'OFF'}</div>
          `;
        }
      },
      xAxis: {
        type: 'time',
        min: _xAxisTimeRange.min,
        max: _xAxisTimeRange.max,
        axisLine: { lineStyle: { color: axisColor } },
        axisLabel: {
          formatter: '{HH}:{mm}:{ss}',
          color: isDark ? '#94a3b8' : '#64748b'
        },
        splitLine: { show: false }
      },
      yAxis: {
        type: 'value',
        min: -0.1,
        max: 1.3,
        interval: 1,
        axisLine: { lineStyle: { color: axisColor } },
        axisLabel: {
          formatter: (value: number) => value === 1 ? 'ON' : value === 0 ? 'OFF' : '',
          color: isDark ? '#94a3b8' : '#64748b'
        },
        splitLine: { lineStyle: { color: splitLineColor } }
      },
      series: [
        {
          name: 'Status',
          type: 'line',
          step: 'end',
          areaStyle: {
            color: isDark
              ? 'rgba(16, 185, 129, 0.2)'
              : 'rgba(16, 185, 129, 0.3)'
          },
          lineStyle: {
            color: '#10b981',
            width: 2
          },
          showSymbol: false,
          data: onOffData.map(d => [d.timestampMs, d.value])
        }
      ]
    };
  }, [onOffData, getLast10MinRange, autoRefresh]);

  if (!data || data.length === 0) {
    return (
      <div className="h-96 flex flex-col items-center justify-center text-[var(--text-tertiary)] bg-[var(--bg-tertiary)] rounded-xl border-2 border-dashed border-[var(--border-primary)]">
        <AlertCircle className="h-12 w-12 mb-4 text-amber-500" />
        <p className="text-lg font-medium">No telemetry data available</p>
        <p className="text-sm mt-2">Try selecting a different Production Week or Day.</p>
        <div className="mt-4 flex items-center gap-2 text-xs bg-[var(--bg-card)] px-3 py-2 rounded-lg border border-[var(--border-primary)]">
          <Clock className="h-4 w-4" />
          <span>Auto-refresh will fetch new data every 10 seconds</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">

      {/* Chart 1: Average Current & Limits */}
      <div className="bg-[var(--bg-card)] p-3 rounded-lg border border-[var(--border-primary)] shadow-[var(--shadow-sm)] relative overflow-hidden">
        <div className="mb-2 flex justify-between items-center">
          <div>
            <h3 className="font-semibold text-[var(--text-primary)] text-sm">Average Current & Limits</h3>
          </div>
          <div className="flex gap-2">
            <span className="flex items-center text-xs text-rose-600 font-medium bg-rose-50 dark:bg-rose-900/30 px-2 py-1 rounded border border-rose-100 dark:border-rose-800">
              <div className="w-4 h-0.5 mr-1" style={{ borderTop: '2px dashed #f43f5e' }}></div> Limit
            </span>
            <span className="flex items-center text-xs text-cyan-600 font-medium bg-cyan-50 dark:bg-cyan-900/30 px-2 py-1 rounded border border-cyan-100 dark:border-cyan-800">
              <div className="w-2 h-2 rounded-full bg-cyan-500 mr-1"></div> Avg Current
            </span>
          </div>
        </div>
        <ReactECharts
          ref={chart1Ref}
          option={chart1Options}
          style={{ height: '300px', width: '100%' }}
          opts={{ renderer: 'canvas' }}
          notMerge={true}
          lazyUpdate={true}
          onChartReady={(chart) => {
            chart.group = CHART_GROUP;
          }}
        />
      </div>

      {/* Chart 2: Real-time Motor Current */}
      <div className="bg-[var(--bg-card)] p-3 rounded-lg border border-[var(--border-primary)] shadow-[var(--shadow-sm)]">
        <h3 className="font-semibold text-[var(--text-primary)] text-sm mb-1">Real-time Motor Current</h3>
        <ReactECharts
          ref={chart2Ref}
          option={chart2Options}
          style={{ height: '250px', width: '100%' }}
          opts={{ renderer: 'canvas' }}
          notMerge={true}
          lazyUpdate={true}
          onChartReady={(chart) => {
            chart.group = CHART_GROUP;
          }}
        />
      </div>

      {/* Chart 3: ON/OFF Status */}
      <div className="bg-[var(--bg-card)] p-3 rounded-lg border border-[var(--border-primary)] shadow-[var(--shadow-sm)]">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-semibold text-[var(--text-primary)] text-sm">Operational Status (ON/OFF)</h3>
          <button
            onClick={() => setShowOnOffTable(!showOnOffTable)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${showOnOffTable
              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
              : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-emerald-100 hover:text-emerald-700 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-400'
              }`}
          >
            {showOnOffTable ? <X className="h-3 w-3" /> : <Table className="h-3 w-3" />}
            {showOnOffTable ? 'Hide' : 'Table'}
          </button>
        </div>

        {/* ON/OFF Table */}
        {showOnOffTable && (
          <div className="mb-4 max-h-96 overflow-auto border border-[var(--border-primary)] rounded-lg shadow-inner bg-[var(--bg-card)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--bg-tertiary)] sticky top-0 border-b border-[var(--border-primary)] z-10">
                <tr>
                  <th className="px-4 py-2 text-left font-mono font-semibold text-[var(--text-secondary)]">Timestamp</th>
                  <th className="px-4 py-2 text-left font-mono font-semibold text-[var(--text-secondary)]">Value (0/1)</th>
                  <th className="px-4 py-2 text-left font-semibold text-[var(--text-secondary)]">State</th>
                </tr>
              </thead>
              <tbody>
                {onOffData.map((row, idx) => (
                  <tr key={idx} className={`border-b border-[var(--border-primary)] hover:bg-[var(--bg-tertiary)] ${row.value === 1 ? 'bg-emerald-50/30 dark:bg-emerald-900/10' : ''}`}>
                    <td className="px-4 py-1 font-mono text-xs text-[var(--text-secondary)]">{formatTableTimestamp(row.timestampMs)}</td>
                    <td className="px-4 py-1 font-mono font-bold text-[var(--text-primary)]">{row.value}</td>
                    <td className="px-4 py-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${row.value === 1 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'}`}>
                        {row.label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <ReactECharts
          ref={chart3Ref}
          option={chart3Options}
          style={{ height: '250px', width: '100%' }}
          opts={{ renderer: 'canvas' }}
          notMerge={true}
          lazyUpdate={true}
          onChartReady={(chart) => {
            chart.group = CHART_GROUP;
          }}
        />
      </div>

    </div>
  );
});

MotorCharts.displayName = 'MotorCharts';
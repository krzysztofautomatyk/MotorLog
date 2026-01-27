import React, { useMemo, useState, useEffect, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { MotorLog } from '../types';
import { Table, X, RotateCcw } from 'lucide-react';

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

// Group ID for chart synchronization
const CHART_GROUP = 'motor-charts-group';

export const MotorCharts: React.FC<MotorChartsProps> = ({ data }) => {
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

  // Calculate default 10-minute range
  const defaultTimeRange = useMemo(() => {
    if (data.length === 0) return { start: 0, end: 100 };

    const lastTimestamp = new Date(data[data.length - 1].timestamp).getTime();
    const startTimestamp = lastTimestamp - 10 * 60 * 1000; // 10 minutes before

    return { start: startTimestamp, end: lastTimestamp };
  }, [data]);

  // Reset zoom to default 10-minute range
  const handleResetZoom = () => {
    const charts = [
      chart1Ref.current?.getEchartsInstance(),
      chart2Ref.current?.getEchartsInstance(),
      chart3Ref.current?.getEchartsInstance()
    ];

    charts.forEach(chart => {
      if (chart) {
        chart.dispatchAction({
          type: 'dataZoom',
          start: 0,
          end: 100
        });
      }
    });
  };

  // Prepare chart data
  const chartData = useMemo(() => {
    return data.map(d => ({
      timestamp: d.timestamp,
      timestampMs: new Date(d.timestamp).getTime(),
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
          timestampMs: new Date(current.timestamp).getTime(),
          value: current.isMotorOn,
          label: current.isMotorOn === 1 ? 'ON' : 'OFF'
        });
        lastState = current.isMotorOn;
        lastTs = current.timestamp;
      }
    }

    return result;
  }, [data]);

  // Common chart options
  const getCommonOptions = (height: number) => ({
    animation: false,
    grid: {
      left: 60,
      right: 20,
      top: 20,
      bottom: 60
    },
    dataZoom: [
      {
        type: 'inside',
        xAxisIndex: 0,
        filterMode: 'none'
      },
      {
        type: 'slider',
        xAxisIndex: 0,
        filterMode: 'none',
        height: 20,
        bottom: 10
      }
    ],
    toolbox: {
      feature: {
        dataZoom: {
          yAxisIndex: 'none'
        },
        restore: {}
      },
      right: 20
    }
  });

  // Chart 1: Avg Current & Max Limit
  const chart1Options = useMemo(() => ({
    ...getCommonOptions(350),
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        if (!params || params.length === 0) return '';
        const dataIndex = params[0].dataIndex;
        const d = chartData[dataIndex];
        if (!d || d.avgCurrent === null) return '';

        return `
          <div style="font-weight: bold; margin-bottom: 8px;">${d.timestamp}</div>
          <div>Zone: ${d.zone}</div>
          <div>Line: ${d.line}</div>
          <div>Motor: ${d.motorName}</div>
          <div style="color: #0ea5e9; font-weight: bold;">Avg Current: ${d.avgCurrent?.toFixed(2)} A</div>
          <div style="color: #f43f5e;">Max Limit: ${d.maxLimit.toFixed(2)} A</div>
          <div>Running Time: ${d.runningTime}</div>
          <div>Status: ${d.isMotorOn === 1 ? 'ON' : 'OFF'}</div>
        `;
      }
    },
    xAxis: {
      type: 'time',
      axisLabel: {
        formatter: '{HH}:{mm}:{ss}'
      }
    },
    yAxis: {
      type: 'value',
      name: 'Current (A)',
      axisLabel: {
        formatter: '{value} A'
      }
    },
    series: [
      {
        name: 'Avg Current',
        type: 'scatter',
        symbolSize: 6,
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
  }), [chartData]);

  // Chart 2: Real-time Motor Current
  const chart2Options = useMemo(() => ({
    ...getCommonOptions(250),
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        if (!params || params.length === 0) return '';
        const p = params[0];
        return `${new Date(p.value[0]).toLocaleTimeString()}<br/>Current: ${p.value[1]?.toFixed(2)} A`;
      }
    },
    xAxis: {
      type: 'time',
      axisLabel: {
        formatter: '{HH}:{mm}:{ss}'
      }
    },
    yAxis: {
      type: 'value',
      name: 'Current (A)',
      axisLabel: {
        formatter: '{value} A'
      }
    },
    series: [
      {
        name: 'Motor Current',
        type: 'line',
        areaStyle: {
          color: 'rgba(139, 92, 246, 0.2)'
        },
        lineStyle: {
          color: '#8b5cf6',
          width: 2
        },
        showSymbol: false,
        data: chartData.map(d => [d.timestampMs, d.motorCurrent])
      }
    ]
  }), [chartData]);

  // Chart 3: ON/OFF Status
  const chart3Options = useMemo(() => ({
    ...getCommonOptions(250),
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        if (!params || params.length === 0) return '';
        const p = params[0];
        return `${new Date(p.value[0]).toLocaleTimeString()}<br/>Status: ${p.value[1] === 1 ? 'ON' : 'OFF'}`;
      }
    },
    xAxis: {
      type: 'time',
      axisLabel: {
        formatter: '{HH}:{mm}:{ss}'
      }
    },
    yAxis: {
      type: 'value',
      min: -0.1,
      max: 1.3,
      interval: 1,
      axisLabel: {
        formatter: (value: number) => value === 1 ? 'ON' : value === 0 ? 'OFF' : ''
      }
    },
    series: [
      {
        name: 'Status',
        type: 'line',
        step: 'end',
        areaStyle: {
          color: 'rgba(16, 185, 129, 0.3)'
        },
        lineStyle: {
          color: '#10b981',
          width: 2
        },
        showSymbol: false,
        data: onOffData.map(d => [d.timestampMs, d.value])
      }
    ]
  }), [onOffData]);

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

      {/* Zoom Controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-lg flex flex-wrap items-center justify-between gap-4 sticky top-16 z-40">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-slate-600">
            🔗 Wykresy zsynchronizowane - użyj suwaka lub przeciągnij aby zoom
          </span>
          <button
            onClick={handleResetZoom}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 hover:bg-blue-100 hover:text-blue-600 transition-colors text-sm font-medium"
            title="Reset zoom"
          >
            <RotateCcw className="h-4 w-4" />
            Reset Zoom
          </button>
        </div>
        <div className="text-sm text-slate-500">
          Total: {data.length} points
        </div>
      </div>

      {/* Chart 1: Avg Current & Max Limit */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="mb-4 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-slate-800 text-lg">Average Current & Limits</h3>
            <p className="text-slate-500 text-sm">Compare average performance against safety thresholds</p>
          </div>
          <div className="flex gap-2">
            <span className="flex items-center text-xs text-rose-600 font-medium bg-rose-50 px-2 py-1 rounded border border-rose-100">
              <div className="w-4 h-0.5 mr-1" style={{ borderTop: '2px dashed #f43f5e' }}></div> Limit
            </span>
            <span className="flex items-center text-xs text-cyan-600 font-medium bg-cyan-50 px-2 py-1 rounded border border-cyan-100">
              <div className="w-2 h-2 rounded-full bg-cyan-500 mr-1"></div> Avg Current
            </span>
          </div>
        </div>
        <ReactECharts
          ref={chart1Ref}
          option={chart1Options}
          style={{ height: '350px', width: '100%' }}
          opts={{ renderer: 'canvas' }}
          notMerge={true}
          lazyUpdate={true}
          onChartReady={(chart) => {
            chart.group = CHART_GROUP;
          }}
        />
      </div>

      {/* Chart 2: Real-time Motor Current */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="font-bold text-slate-800 text-lg mb-2">Real-time Motor Current</h3>
        <p className="text-slate-500 text-sm mb-4">Instantaneous current draw over time</p>
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
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="font-bold text-slate-800 text-lg">Operational Status</h3>
            <p className="text-slate-500 text-sm">Machine run cycles (1 = ON, 0 = OFF)</p>
          </div>
          <button
            onClick={() => setShowOnOffTable(!showOnOffTable)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${showOnOffTable
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
          <div className="mb-4 max-h-96 overflow-auto border border-slate-200 rounded-lg shadow-inner bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 sticky top-0 border-b border-slate-200 z-10">
                <tr>
                  <th className="px-4 py-2 text-left font-mono font-semibold text-slate-600">Timestamp</th>
                  <th className="px-4 py-2 text-left font-mono font-semibold text-slate-600">Value (0/1)</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-600">State</th>
                </tr>
              </thead>
              <tbody>
                {onOffData.map((row, idx) => (
                  <tr key={idx} className={`border-b border-slate-100 hover:bg-slate-50 ${row.value === 1 ? 'bg-emerald-50/30' : ''}`}>
                    <td className="px-4 py-1 font-mono text-xs text-slate-600">{new Date(row.timestampMs).toISOString()}</td>
                    <td className="px-4 py-1 font-mono font-bold text-slate-800">{row.value}</td>
                    <td className="px-4 py-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${row.value === 1 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
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
};
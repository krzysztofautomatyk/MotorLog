import React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Brush,
  AreaChart,
  LineChart
} from 'recharts';
import { MotorLog } from '../types';

interface MotorChartsProps {
  data: MotorLog[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as MotorLog;
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
          
          <span className="text-slate-400">Avg Value:</span>
          <span className="font-mono text-emerald-400 font-bold">{data.avgCurrent.toFixed(2)} A</span>
          
          <span className="text-slate-400">Max Limit:</span>
          <span className="font-mono text-rose-400 font-bold">{data.maxCurrentLimit.toFixed(2)} A</span>
          
          <span className="text-slate-400">Running Time:</span>
          <span>{data.runningTime.toFixed(1)} min</span>
        </div>
      </div>
    );
  }
  return null;
};

export const MotorCharts: React.FC<MotorChartsProps> = ({ data }) => {
  
  const formatXAxis = (tickItem: string) => {
    if (!tickItem) return '';
    // Expected format: "2026-01-26 10:11:06.130"
    const parts = tickItem.split(' ');
    if (parts.length > 1) {
       const timeParts = parts[1].split(':');
       return `${timeParts[0]}:${timeParts[1]}:${timeParts[2]?.split('.')[0]}`;
    }
    return tickItem;
  };

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
      
      {/* Chart 1: Avg Current & Max Limit */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="mb-6 flex justify-between items-center">
            <div>
                <h3 className="font-bold text-slate-800 text-lg">Average Current & Limits</h3>
                <p className="text-slate-500 text-sm">Compare average performance against safety thresholds</p>
            </div>
            <div className="flex gap-2">
                <span className="flex items-center text-xs text-rose-600 font-medium bg-rose-50 px-2 py-1 rounded border border-rose-100">
                    <div className="w-2 h-0.5 bg-rose-500 mr-1"></div> Limit
                </span>
                <span className="flex items-center text-xs text-blue-600 font-medium bg-blue-50 px-2 py-1 rounded border border-blue-100">
                    <div className="w-2 h-2 rounded-full bg-blue-500 mr-1"></div> Avg
                </span>
            </div>
        </div>
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} syncId="motorSync">
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
              
              {/* Average Current Point */}
              <Line
                type="monotone"
                dataKey="avgCurrent"
                stroke="#0ea5e9"
                strokeWidth={2}
                dot={{ r: 3, fill: "#0ea5e9", strokeWidth: 0 }}
                activeDot={{ r: 6, stroke: "#fff", strokeWidth: 2 }}
                isAnimationActive={true}
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
            <AreaChart data={data} syncId="motorSync">
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
        <h3 className="font-bold text-slate-800 text-lg mb-2">Operational Status</h3>
        <p className="text-slate-500 text-sm mb-6">Machine run cycles (1 = ON, 0 = OFF)</p>
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} syncId="motorSync">
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
              <Line 
                type="stepAfter" 
                dataKey="isMotorOn" 
                stroke="#10b981" 
                strokeWidth={2} 
                dot={false}
                activeDot={{ r: 4, fill: '#10b981' }}
                isAnimationActive={false}
              />
              {/* Brush for zooming control - controls all charts because of syncId */}
              <Brush 
                 dataKey="timestamp" 
                 height={30} 
                 stroke="#cbd5e1"
                 fill="#f8fafc"
                 tickFormatter={() => ''}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      
    </div>
  );
};
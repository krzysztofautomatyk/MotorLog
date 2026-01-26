import { MotorLog, ZoneData, LineData, RawMotorLog } from '../types';
import * as mock from './mockDataService';

const useMock = import.meta.env.VITE_DATA_SOURCE !== 'mssql';
const API_BASE = import.meta.env.VITE_API_BASE || '';

console.log('🔍 DataService Config:', {
  VITE_DATA_SOURCE: import.meta.env.VITE_DATA_SOURCE,
  VITE_API_BASE: import.meta.env.VITE_API_BASE,
  useMock,
  API_BASE
});

const toNumber = (val: unknown, fallback = 0) => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') return parseFloat(val);
  return fallback;
};

const normalizeMotorLog = (raw: any): MotorLog => {
  const timestamp = raw.Timestamp || raw.timestamp;
  const dateStr = timestamp?.replace(' ', 'T');
  const dateObj = dateStr ? new Date(dateStr) : new Date();
  const day = dateObj.getDay() === 0 ? 7 : dateObj.getDay();

  return {
    id: Number(raw.Id ?? raw.id),
    timestamp,
    timestampObj: dateObj.getTime(),
    motorName: raw.MotorName || raw.motorName,
    zone: raw.Zone || raw.zone,
    line: raw.Line || raw.line,
    productionWeek: raw.ProductionWeek || raw.productionWeek,
    dayOfWeek: Number(raw.DayOfWeek ?? raw.dayOfWeek ?? day),
    maxCurrentLimit: toNumber(raw.MaxCurrentLimit ?? raw.maxCurrentLimit),
    motorCurrent: toNumber(raw.MotorCurrent ?? raw.motorCurrent),
    isMotorOn: raw.IsMotorOn === true || raw.isMotorOn === 1 ? 1 : 0,
    avgCurrent: toNumber(raw.AvgCurrent ?? raw.avgCurrent),
    runningTime: toNumber(raw.RunningTime ?? raw.runningTime)
  };
};

const fetchJson = async <T,>(path: string): Promise<T> => {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }
  return res.json();
};

export const getZones = async (): Promise<ZoneData[]> => {
  if (useMock) return mock.getZones();
  try {
    return await fetchJson<ZoneData[]>('/api/zones');
  } catch {
    return mock.getZones();
  }
};

export const getLines = async (zone: string): Promise<LineData[]> => {
  if (useMock) return mock.getLines(zone);
  try {
    return await fetchJson<LineData[]>(`/api/lines?zone=${encodeURIComponent(zone)}`);
  } catch {
    return mock.getLines(zone);
  }
};

export const getMotors = async (zone: string, line: string): Promise<string[]> => {
  if (useMock) return mock.getMotors(zone, line);
  try {
    return await fetchJson<string[]>(`/api/motors?zone=${encodeURIComponent(zone)}&line=${encodeURIComponent(line)}`);
  } catch {
    return mock.getMotors(zone, line);
  }
};

export const getAvailableWeeks = async (): Promise<string[]> => {
  if (useMock) return mock.getAvailableWeeks();
  try {
    return await fetchJson<string[]>('/api/weeks');
  } catch {
    return mock.getAvailableWeeks();
  }
};

export const generateMotorData = async (
  zone: string,
  line: string,
  motorName: string,
  weeks: string[],
  day: number | 'ALL'
): Promise<MotorLog[]> => {
  if (useMock) return mock.generateMotorData(zone, line, motorName, weeks, day);
  try {
    const params = new URLSearchParams({
      zone,
      line,
      motor: motorName,
      weeks: weeks.join(','),
      day: String(day)
    });
    const raw = await fetchJson<any[]>(`/api/motor-logs?${params.toString()}`);
    return raw.map(normalizeMotorLog).sort((a, b) => a.timestampObj - b.timestampObj);
  } catch {
    return mock.generateMotorData(zone, line, motorName, weeks, day);
  }
};

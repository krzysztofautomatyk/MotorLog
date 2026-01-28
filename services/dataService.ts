import { MotorLog, ZoneData, LineData } from '../types';

// ALWAYS use database - no fallback to mock data
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

console.log('🔍 DataService Config:', {
  VITE_DATA_SOURCE: import.meta.env.VITE_DATA_SOURCE,
  VITE_API_BASE: import.meta.env.VITE_API_BASE,
  API_BASE,
  mode: 'DATABASE ONLY - No mock fallback'
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

// Error class for API failures
export class DataServiceError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public endpoint?: string
  ) {
    super(message);
    this.name = 'DataServiceError';
  }
}

const fetchJson = async <T,>(path: string): Promise<T> => {
  const url = `${API_BASE}${path}`;

  try {
    const res = await fetch(url);

    if (!res.ok) {
      throw new DataServiceError(
        `API request failed: ${res.status} ${res.statusText}`,
        res.status,
        path
      );
    }

    return res.json();
  } catch (error) {
    if (error instanceof DataServiceError) {
      throw error;
    }

    // Network error or other fetch failure
    throw new DataServiceError(
      `Network error: Unable to connect to API at ${url}. Make sure the server is running.`,
      undefined,
      path
    );
  }
};

export const getZones = async (): Promise<ZoneData[]> => {
  return fetchJson<ZoneData[]>('/api/zones');
};

export const getLines = async (zone: string): Promise<LineData[]> => {
  return fetchJson<LineData[]>(`/api/lines?zone=${encodeURIComponent(zone)}`);
};

export const getMotors = async (zone: string, line: string): Promise<string[]> => {
  return fetchJson<string[]>(`/api/motors?zone=${encodeURIComponent(zone)}&line=${encodeURIComponent(line)}`);
};

export const getAvailableWeeks = async (): Promise<string[]> => {
  return fetchJson<string[]>('/api/weeks');
};

export const generateMotorData = async (
  zone: string,
  line: string,
  motorName: string,
  weeks: string[],
  days: number[] // Empty array means 'ALL'
): Promise<MotorLog[]> => {
  const params = new URLSearchParams({
    zone,
    line,
    motor: motorName,
    weeks: weeks.join(','),
    day: days.length > 0 ? days.join(',') : 'ALL'
  });

  const raw = await fetchJson<any[]>(`/api/motor-logs?${params.toString()}`);
  return raw.map(normalizeMotorLog).sort((a, b) => a.timestampObj - b.timestampObj);
};

// Health check function
export const checkApiHealth = async (): Promise<{ status: 'ok' | 'error'; message?: string }> => {
  try {
    const result = await fetchJson<{ status: string }>('/api/health');
    return { status: result.status === 'ok' ? 'ok' : 'error' };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

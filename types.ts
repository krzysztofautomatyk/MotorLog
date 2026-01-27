export interface RawMotorLog {
  Id: string;
  Timestamp: string;
  BufferIndex: number;
  MotorID: number;
  MotorName: string;
  Zone: string;
  Line: string;
  ProductionWeek: string;
  MaxCurrentLimit: string;
  MotorCurrent: string;
  IsMotorOn: boolean;
  AvgCurrent: string;
  RunningTime: string;
  RecordedAt: string;
}

export interface MotorLog {
  id: number;
  timestamp: string; // ISO Date string
  timestampObj: number; // Numeric timestamp for easier charting
  motorName: string;
  zone: string;
  line: string;
  productionWeek: string;
  dayOfWeek: number; // 1-7 (Monday is 1)
  maxCurrentLimit: number;
  motorCurrent: number;
  isMotorOn: number; // Converted to 0 or 1 for step chart
  avgCurrent: number;
  runningTime: number; // in minutes
}

export interface ZoneData {
  name: string;
  lineCount: number;
  motorCount: number;
  status: 'Healthy' | 'Warning' | 'Critical';
}

export interface LineData {
  name: string;
  zone: string;
  motorCount: number;
}

export interface FilterState {
  selectedWeeks: string[];
  selectedDay: number | 'ALL';
}

export interface AnalyticsSummary {
  totalRunningTime: number;
  peakCurrent: number;
  averageEfficiency: number;
  cycles: number;
  maxLimitBreaches: number;
}
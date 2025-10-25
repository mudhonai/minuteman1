// Feiertage NRW 2025 (MM-DD Format)
export const NRW_HOLIDAYS_2025 = [
  '01-01', '04-18', '04-21', '05-01', '05-29', '06-09', '06-19',
  '10-03', '11-01', '12-25', '12-26',
];

// Soll-Arbeitszeiten (in Minuten)
export const TARGET_HOURS_DAILY: Record<number, number> = {
  1: 510, // Mo: 8h 30m
  2: 510, // Di: 8h 30m
  3: 510, // Mi: 8h 30m
  4: 510, // Do: 8h 30m
  5: 240, // Fr: 4h 00m
};

export const TARGET_HOURS_WEEKLY = 38.5 * 60; // 2310 Minuten
export const TARGET_HOURS_MONTHLY = 165 * 60; // 9900 Minuten

// Zuschlagssätze
export const SURCHARGE_RATES = {
  SATURDAY: 0.30,
  SUNDAY: 0.60,
  HOLIDAY: 1.30,
};

// TypeScript Typen
export interface Break {
  start: string; // ISO String
  end: string | null;
}

export interface CurrentEntry {
  id?: string;
  user_id: string;
  start_time: string;
  status: 'working' | 'break';
  breaks: Break[];
  updated_at?: string;
}

export interface TimeEntry {
  id: string;
  user_id: string;
  start_time: string;
  end_time: string;
  breaks: Break[];
  net_work_duration_minutes: number;
  total_break_duration_ms: number;
  regular_minutes: number;
  surcharge_minutes: number;
  surcharge_amount: number;
  is_surcharge_day: boolean;
  surcharge_label: string;
  date: string;
  created_at?: string;
}

export interface UserSettings {
  id?: string;
  user_id: string;
  break_reminder_enabled: boolean;
  custom_holidays: string[];
  created_at?: string;
  updated_at?: string;
}

export type AbsenceType = 'urlaub' | 'juep' | 'krankheit';

export interface AbsenceEntry {
  id: string;
  user_id: string;
  date: string;
  absence_type: AbsenceType;
  hours: number;
  note?: string;
  created_at?: string;
  updated_at?: string;
}

export type WorkStatus = 'idle' | 'working' | 'break';

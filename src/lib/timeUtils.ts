import { Break, SURCHARGE_RATES, NRW_HOLIDAYS_2025, TARGET_HOURS_DAILY } from './types';

export const formatMinutesToHHMM = (totalMinutes: number | undefined | null): string => {
  if (totalMinutes === undefined || totalMinutes === null || isNaN(totalMinutes)) return '0:00';
  const sign = totalMinutes < 0 ? '-' : '';
  const absMinutes = Math.abs(Math.round(totalMinutes));
  const hours = Math.floor(absMinutes / 60);
  const minutes = absMinutes % 60;
  return `${sign}${hours}:${minutes.toString().padStart(2, '0')}`;
};

export const formatGermanDateTime = (timestamp: string | null): string => {
  if (!timestamp) return '---';
  const date = new Date(timestamp);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${day}.${month}.${year} ${hours}:${minutes}`;
};

export const formatDateForHistory = (timestamp: string): string => {
  const date = new Date(timestamp);
  return date.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const isHoliday = (date: Date, customHolidays: string[]): boolean => {
  const mmdd = `${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
  return NRW_HOLIDAYS_2025.includes(mmdd) || customHolidays.includes(mmdd);
};

export const calculateNetWorkDuration = (
  startTime: string,
  endTime: string,
  breaks: Break[]
): { netMinutes: number; totalBreakMs: number } => {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  let totalBreakMs = 0;

  for (const br of breaks) {
    if (br.start && br.end) {
      totalBreakMs += new Date(br.end).getTime() - new Date(br.start).getTime();
    }
  }

  const netMs = end - start - totalBreakMs;
  return { netMinutes: Math.round(netMs / (1000 * 60)), totalBreakMs };
};

export const calculateSurcharge = (
  startTime: string,
  netMinutes: number,
  customHolidays: string[]
): {
  regularMinutes: number;
  surchargeMinutes: number;
  surchargeAmount: number;
  isSurchargeDay: boolean;
  surchargeLabel: string;
} => {
  const date = new Date(startTime);
  const dayOfWeek = date.getDay();
  const isHol = isHoliday(date, customHolidays);

  let rate = 0;
  let label = 'Regulär';
  let surchargeMinutes = 0;
  let regularMinutes = netMinutes;
  let isSurchargeDay = false; // Nur für echte Sondertage (Sa, So, Feiertag)

  // Feiertage: Ab der ersten Minute 130% Zuschlag
  if (isHol) {
    rate = SURCHARGE_RATES.HOLIDAY;
    label = 'Feiertagszuschlag (130%)';
    surchargeMinutes = netMinutes;
    regularMinutes = 0; // Alles ist Überstunde
    isSurchargeDay = true; // ECHTER Sondertag
  } 
  // Samstag: Ab der ersten Minute 30% Zuschlag
  else if (dayOfWeek === 6) {
    rate = SURCHARGE_RATES.SATURDAY;
    label = 'Samstagszuschlag (30%)';
    surchargeMinutes = netMinutes;
    regularMinutes = 0; // Alles ist Überstunde
    isSurchargeDay = true; // ECHTER Sondertag
  } 
  // Sonntag: Ab der ersten Minute 60% Zuschlag
  else if (dayOfWeek === 0) {
    rate = SURCHARGE_RATES.SUNDAY;
    label = 'Sonntagszuschlag (60%)';
    surchargeMinutes = netMinutes;
    regularMinutes = 0; // Alles ist Überstunde
    isSurchargeDay = true; // ECHTER Sondertag
  } 
  // Montag bis Freitag: Nur Überstunden über Soll erhalten 30% Zuschlag
  else if (dayOfWeek >= 1 && dayOfWeek <= 5) {
    const targetMinutes = TARGET_HOURS_DAILY[dayOfWeek] || 0;
    const overtimeMinutes = Math.max(0, netMinutes - targetMinutes);
    
    if (overtimeMinutes > 0) {
      rate = SURCHARGE_RATES.SATURDAY; // 30%
      label = 'Überstundenzuschlag (30%)';
      surchargeMinutes = overtimeMinutes;
      regularMinutes = targetMinutes; // Nur das Soll ist regulär
      // isSurchargeDay bleibt false, da es kein Sondertag ist
    }
  }

  const surchargeAmount = Math.round(surchargeMinutes * rate);

  return {
    regularMinutes,
    surchargeMinutes,
    surchargeAmount,
    isSurchargeDay, // Nur true für Sa, So, Feiertage
    surchargeLabel: label,
  };
};

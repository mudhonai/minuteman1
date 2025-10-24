import { Break, SURCHARGE_RATES, NRW_HOLIDAYS_2025 } from './types';

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

  if (isHol) {
    rate = SURCHARGE_RATES.HOLIDAY;
    label = 'Feiertagszuschlag (130%)';
  } else if (dayOfWeek === 6) {
    rate = SURCHARGE_RATES.SATURDAY;
    label = 'Samstagszuschlag (30%)';
  } else if (dayOfWeek === 0) {
    rate = SURCHARGE_RATES.SUNDAY;
    label = 'Sonntagszuschlag (60%)';
  }

  const surchargeMinutes = rate > 0 ? netMinutes : 0;
  const surchargeAmount = Math.round(surchargeMinutes * rate);

  return {
    regularMinutes: netMinutes,
    surchargeMinutes,
    surchargeAmount,
    isSurchargeDay: rate > 0,
    surchargeLabel: label,
  };
};

/**
 * Ethiopian (Amete Mihret) ⇄ Gregorian conversion via Julian Day Numbers.
 * 12 months of 30 days, then Pagume (month 13) with 5 days, or 6 in a year
 * where year % 4 === 3.
 */

const AMETE_MIHRET_EPOCH = 1723856;

export const ETHIOPIAN_MONTH_NAMES = [
  "Meskerem", "Tikimt", "Hidar", "Tahsas", "Tir", "Yekatit",
  "Megabit", "Miyazya", "Ginbot", "Sene", "Hamle", "Nehase", "Pagume",
];

export interface EthiopianDate {
  year: number;
  month: number; // 1–13
  day: number;
}

function gregorianToJdn(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
}

function jdnToGregorian(jdn: number): { year: number; month: number; day: number } {
  const a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  return {
    day: e - Math.floor((153 * m + 2) / 5) + 1,
    month: m + 3 - 12 * Math.floor(m / 10),
    year: 100 * b + d - 4800 + Math.floor(m / 10),
  };
}

function jdnToEthiopian(jdn: number): EthiopianDate {
  const k = jdn - AMETE_MIHRET_EPOCH;
  const r = ((k % 1461) + 1461) % 1461;
  const n = (r % 365) + 365 * Math.floor(r / 1460);
  return {
    year: 4 * Math.floor(k / 1461) + Math.floor(r / 365) - Math.floor(r / 1460),
    month: Math.floor(n / 30) + 1,
    day: (n % 30) + 1,
  };
}

function ethiopianToJdn({ year, month, day }: EthiopianDate): number {
  return AMETE_MIHRET_EPOCH + 365 + 365 * (year - 1) + Math.floor(year / 4) + 30 * month + day - 31;
}

export function daysInEthiopianMonth(year: number, month: number): number {
  if (month < 13) return 30;
  return year % 4 === 3 ? 6 : 5;
}

/** Reads the date's UTC calendar day — callers pass Addis-local midnights. */
export function toEthiopian(date: Date): EthiopianDate {
  return jdnToEthiopian(gregorianToJdn(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()));
}

/** UTC midnight of the matching Gregorian day. */
export function toGregorian(date: EthiopianDate): Date {
  const g = jdnToGregorian(ethiopianToJdn(date));
  return new Date(Date.UTC(g.year, g.month - 1, g.day));
}

export function isValidEthiopianDate({ year, month, day }: EthiopianDate): boolean {
  return (
    Number.isInteger(year) && Number.isInteger(month) && Number.isInteger(day) &&
    year >= 1900 && year <= 2200 && month >= 1 && month <= 13 &&
    day >= 1 && day <= daysInEthiopianMonth(year, month)
  );
}

/** Today in Addis Ababa (UTC+3, no DST), in the Ethiopian calendar. */
export function ethiopianToday(): EthiopianDate {
  return toEthiopian(new Date(Date.now() + 3 * 60 * 60 * 1000));
}

export function formatEthiopianDate(date: EthiopianDate): string {
  return `${ETHIOPIAN_MONTH_NAMES[date.month - 1]} ${date.day}, ${date.year}`;
}

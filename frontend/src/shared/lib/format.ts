import { formatDistanceToNow, type Locale } from 'date-fns';
import { enUS, uk } from 'date-fns/locale';

const DATE_LOCALES: Record<string, Locale> = { en: enUS, uk };

export function dateLocale(lang: string): Locale {
  return DATE_LOCALES[lang] ?? enUS;
}

/** Long date as in the screenshots: "June 10, 2025" / "10 червня 2025 р.". */
export function formatDate(date: Date | string | number, lang: string): string {
  return new Intl.DateTimeFormat(lang, { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(date),
  );
}

export function formatRelative(date: Date | string | number, lang: string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: dateLocale(lang) });
}

export function formatNumber(value: number, lang: string, opts?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(lang, opts).format(value);
}

export function formatPercent(value: number, lang: string, fractionDigits = 0): string {
  return new Intl.NumberFormat(lang, {
    style: 'percent',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value / 100);
}

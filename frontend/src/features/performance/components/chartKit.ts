import { useLanguage } from '@/shared/i18n';

/** Shared look for chart tooltips and axes, taken from the dashboard's charts. */
export const axisTick = { fill: 'rgb(var(--c-text-muted))', fontSize: 12 };
export const gridStroke = 'rgb(var(--c-border-subtle))';
export const axisLine = { stroke: 'rgb(var(--c-border))' };

export function useDayLabel() {
  const { language } = useLanguage();
  return (iso: string) =>
    new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
      new Date(`${iso}T00:00:00Z`),
    );
}

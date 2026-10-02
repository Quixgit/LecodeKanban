import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/shared/i18n';
import { Button, IconButton, SegmentedControl } from '@/shared/ui';
import { MODES, parseKey, type CalendarMode } from '../model/dates';

interface Props {
  anchor: string;
  mode: CalendarMode;
  onMode: (m: CalendarMode) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

/** Title of the visible range plus previous / next / today and the Month | Week | Day switch. */
export function CalendarHeader({ anchor, mode, onMode, onPrev, onNext, onToday }: Props) {
  const { t } = useTranslation('calendar');
  const { language } = useLanguage();
  const fmt = (o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(language, { timeZone: 'UTC', ...o }).format(parseKey(anchor));
  const title =
    mode === 'month'
      ? fmt({ month: 'long', year: 'numeric' })
      : mode === 'week'
        ? t('weekOf', { date: fmt({ dateStyle: 'long' }) })
        : fmt({ dateStyle: 'full' });

  return (
    <div className="flex flex-wrap items-center gap-3">
      <h2 className="min-w-0 flex-1 text-xl font-semibold capitalize text-text" aria-live="polite">
        {title}
      </h2>
      <div className="flex items-center gap-1">
        <IconButton variant="ghost" label={t('prev')} onClick={onPrev}>
          <ChevronLeft />
        </IconButton>
        <Button variant="secondary" size="sm" onClick={onToday}>
          {t('today')}
        </Button>
        <IconButton variant="ghost" label={t('next')} onClick={onNext}>
          <ChevronRight />
        </IconButton>
      </div>
      <SegmentedControl<CalendarMode>
        label={t('mode.label')}
        value={mode}
        onChange={onMode}
        options={MODES.map((m) => ({ value: m, label: t(`mode.${m}`) }))}
      />
    </div>
  );
}

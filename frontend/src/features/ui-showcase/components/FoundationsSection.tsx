import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/cn';
import { Row, ShowcaseSection } from './ShowcaseSection';

const swatches: { group: string; tokens: string[] }[] = [
  {
    group: 'brand',
    tokens: [
      'primary',
      'primary-solid',
      'primary-soft',
      'primary-subtle',
      'primary-border',
      'primary-ink',
    ],
  },
  {
    group: 'surfaces',
    tokens: ['bg', 'surface', 'surface-muted', 'surface-sunken', 'border', 'border-subtle'],
  },
  { group: 'text', tokens: ['text', 'text-secondary', 'text-muted', 'text-faint'] },
  {
    group: 'status',
    tokens: [
      'todo',
      'progress',
      'review',
      'done',
      'danger',
      'progress-soft',
      'review-soft',
      'done-soft',
      'danger-soft',
    ],
  },
];

const typeScale = [
  ['3xl', 'text-3xl font-semibold'],
  ['2xl', 'text-2xl font-semibold'],
  ['xl', 'text-xl font-semibold'],
  ['lg', 'text-lg font-medium'],
  ['md', 'text-md'],
  ['base', 'text-base'],
  ['sm', 'text-sm text-text-secondary'],
  ['xs', 'text-xs text-text-muted'],
] as const;

const radii = [
  ['xs', 'rounded-xs'],
  ['sm', 'rounded-sm'],
  ['md', 'rounded-md'],
  ['lg', 'rounded-lg'],
  ['xl', 'rounded-xl'],
  ['2xl', 'rounded-2xl'],
  ['full', 'rounded-full'],
] as const;

const shadows = [
  ['xs', 'shadow-xs'],
  ['sm', 'shadow-sm'],
  ['md', 'shadow-md'],
  ['lg', 'shadow-lg'],
  ['drag', 'shadow-drag'],
  ['primary', 'shadow-primary'],
] as const;

export function FoundationsSection() {
  const { t } = useTranslation('showcase');
  return (
    <ShowcaseSection
      id="foundations"
      title={t('foundations.title')}
      description={t('foundations.description')}
    >
      {swatches.map(({ group, tokens }) => (
        <Row key={group} label={t(`foundations.colors.${group}`)}>
          {tokens.map((tok) => (
            <figure key={tok} className="w-28">
              <div
                className="h-14 rounded-lg border border-border-subtle"
                style={{ background: `rgb(var(--c-${tok}))` }}
              />
              <figcaption className="mt-1.5 truncate font-mono text-2xs text-text-muted">
                {tok}
              </figcaption>
            </figure>
          ))}
        </Row>
      ))}
      <Row label={t('foundations.typography')}>
        <div className="flex w-full flex-col gap-1.5">
          {typeScale.map(([name, cls]) => (
            <div key={name} className="flex items-baseline gap-4">
              <span className="w-12 font-mono text-2xs text-text-muted">{name}</span>
              <span className={cls}>{t('foundations.pangram')}</span>
            </div>
          ))}
        </div>
      </Row>
      <Row label={t('foundations.radii')}>
        {radii.map(([r, cls]) => (
          <div key={r} className="text-center">
            <div className={cn('size-14 border border-primary-border bg-primary-subtle', cls)} />
            <span className="mt-1 block font-mono text-2xs text-text-muted">{r}</span>
          </div>
        ))}
      </Row>
      <Row label={t('foundations.shadows')}>
        {shadows.map(([s, cls]) => (
          <div key={s} className="text-center">
            <div className={cn('size-20 rounded-xl bg-surface', cls)} />
            <span className="mt-2 block font-mono text-2xs text-text-muted">{s}</span>
          </div>
        ))}
      </Row>
    </ShowcaseSection>
  );
}

import { motion, useReducedMotion } from 'framer-motion';
import { CircleDot, Hammer, Sparkles, Wrench } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { transition } from '@/shared/motion';
import { Card, CardHeader, CardTitle, SegmentedControl } from '@/shared/ui';
import { useBuildInfo } from '../hooks/useSupport';

type Tab = 'changes' | 'planned' | 'versions';
type Tag = 'feature' | 'improvement' | 'fix';

interface Change {
  date: string;
  tag: Tag;
  title: string;
  text: string;
  tech: string[];
}
interface Planned {
  status: 'in_progress' | 'planned';
  title: string;
  text: string;
}

const TAG_STYLE: Record<Tag, { icon: typeof Sparkles; tone: string }> = {
  feature: { icon: Sparkles, tone: 'bg-done-soft text-done-ink' },
  improvement: { icon: Hammer, tone: 'bg-primary-soft text-primary-ink' },
  fix: { icon: Wrench, tone: 'bg-progress-soft text-progress-ink' },
};

function Changes() {
  const { t } = useTranslation('help');
  const reduce = useReducedMotion();
  const items = t('whatsNew.changes', { returnObjects: true }) as Change[];
  return (
    <ol className="relative ml-2 flex flex-col gap-6 border-l border-border pl-5">
      {items.map((it, i) => {
        const { icon: Icon, tone } = TAG_STYLE[it.tag];
        return (
          <motion.li
            key={`${it.date}-${it.title}`}
            initial={reduce ? false : { opacity: 0, x: -8 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '0px 0px -40px 0px' }}
            transition={{ ...transition.ui, delay: Math.min(i, 5) * 0.04 }}
            className="relative"
          >
            <span
              aria-hidden
              className="absolute -left-[1.6rem] top-1.5 size-2.5 rounded-full border-2 border-surface bg-primary"
            />
            <p className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-medium uppercase tracking-wide text-text-muted">{it.date}</span>
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium',
                  tone,
                )}
              >
                <Icon className="size-3" aria-hidden />
                {t(`whatsNew.tag.${it.tag}`)}
              </span>
            </p>
            <h3 className="mt-1 text-base font-medium text-text">{it.title}</h3>
            <p className="text-sm text-text-secondary">{it.text}</p>
            {it.tech.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1">
                {it.tech.map((line) => (
                  <li key={line} className="flex gap-2 text-xs text-text-muted">
                    <span
                      aria-hidden
                      className="mt-1.5 size-1 shrink-0 rounded-full bg-border-strong"
                    />
                    <code className="font-mono text-[11.5px] leading-relaxed">{line}</code>
                  </li>
                ))}
              </ul>
            )}
          </motion.li>
        );
      })}
    </ol>
  );
}

function Roadmap() {
  const { t } = useTranslation('help');
  const items = t('whatsNew.planned', { returnObjects: true }) as Planned[];
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-secondary">{t('whatsNew.plannedNote')}</p>
      <ul className="grid gap-3 md:grid-cols-2">
        {items.map((p) => (
          <li key={p.title} className="rounded-xl border border-border-subtle p-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-medium text-text">{p.title}</h3>
              <span
                className={cn(
                  'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                  p.status === 'in_progress'
                    ? 'bg-progress-soft text-progress-ink'
                    : 'bg-surface-sunken text-text-secondary',
                )}
              >
                <CircleDot className="size-3" aria-hidden />
                {t(`whatsNew.status.${p.status}`)}
              </span>
            </div>
            <p className="mt-1 text-sm text-text-secondary">{p.text}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Versions() {
  const { t } = useTranslation('help');
  const { language } = useLanguage();
  const info = useBuildInfo().data;
  const built = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? '—'
      : new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(d);
  };
  const rows: { group: string; items: [string, string][] }[] = [
    {
      group: t('whatsNew.versions.platform'),
      items: [
        [t('whatsNew.versions.web'), __APP_VERSION__],
        [t('whatsNew.versions.webBuilt'), built(__BUILD_TIME__)],
        [
          t('whatsNew.versions.api'),
          info ? `${info.version}${info.commit ? ` (${info.commit})` : ''}` : '…',
        ],
        [t('whatsNew.versions.apiBuilt'), info?.builtAt ? built(info.builtAt) : '—'],
      ],
    },
    {
      group: t('whatsNew.versions.runtime'),
      items: [
        ['Go', info?.goVersion ?? '…'],
        [t('whatsNew.versions.database'), info?.database ?? '…'],
      ],
    },
    { group: t('whatsNew.versions.libraries'), items: Object.entries(__APP_LIBS__) },
  ];
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {rows.map((g) => (
        <section key={g.group} aria-label={g.group}>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">
            {g.group}
          </h3>
          <dl className="flex flex-col gap-1.5">
            {g.items.map(([k, v]) => (
              <div
                key={k}
                className="flex items-baseline justify-between gap-3 border-b border-border-subtle pb-1.5 text-sm"
              >
                <dt className="text-text-secondary">{k}</dt>
                <dd className="tabular text-right font-mono text-[12.5px] text-text">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}

/** What changed (with the technical notes), what is planned, and exactly which versions are running. */
export function WhatsNewCard() {
  const { t } = useTranslation('help');
  const [tab, setTab] = useState<Tab>('changes');
  return (
    <Card className="p-5" id="whats-new">
      <CardHeader className="flex-wrap">
        <div>
          <CardTitle>{t('whatsNew.title')}</CardTitle>
          <p className="text-sm text-text-muted">{t('whatsNew.subtitle')}</p>
        </div>
        <SegmentedControl<Tab>
          label={t('whatsNew.title')}
          value={tab}
          onChange={setTab}
          options={[
            { value: 'changes', label: t('whatsNew.tabs.changes') },
            { value: 'planned', label: t('whatsNew.tabs.planned') },
            { value: 'versions', label: t('whatsNew.tabs.versions') },
          ]}
        />
      </CardHeader>
      {tab === 'changes' ? <Changes /> : tab === 'planned' ? <Roadmap /> : <Versions />}
    </Card>
  );
}

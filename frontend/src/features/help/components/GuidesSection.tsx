import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { cn } from '@/shared/lib/cn';
import { transition } from '@/shared/motion';
import { Card, CardHeader, CardTitle } from '@/shared/ui';
import { findGuide, GUIDES, type GuideDef } from '../model/content';

function GuideTile({
  guide,
  index,
  onOpen,
}: {
  guide: GuideDef;
  index: number;
  onOpen: () => void;
}) {
  const { t } = useTranslation('help');
  const reduce = useReducedMotion();
  const Icon = guide.icon;
  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...transition.large, delay: index * 0.05 }}
    >
      <button
        type="button"
        onClick={onOpen}
        className="group flex h-full w-full flex-col gap-3 rounded-xl border border-border bg-surface p-4 text-left shadow-xs transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      >
        <span className="grid size-10 place-items-center rounded-lg bg-primary-subtle text-primary-ink transition-transform group-hover:scale-105">
          <Icon className="size-5" aria-hidden />
        </span>
        <span>
          <span className="block text-base font-medium text-text">
            {t(`guides.items.${guide.id}.title`)}
          </span>
          <span className="block text-sm text-text-secondary">
            {t(`guides.items.${guide.id}.summary`)}
          </span>
        </span>
        <span className="mt-auto flex items-center justify-between text-xs text-text-muted">
          {t('guides.articles', { count: guide.articles.length })}
          <ChevronRight
            className="size-4 transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </span>
      </button>
    </motion.li>
  );
}

function Reader({
  guide,
  article,
  onSelect,
  onBack,
}: {
  guide: GuideDef;
  article: string;
  onSelect: (a: string) => void;
  onBack: () => void;
}) {
  const { t } = useTranslation('help');
  const reduce = useReducedMotion();
  const Icon = guide.icon;
  const base = `guides.items.${guide.id}.articles.${article}`;
  const steps = t(`${base}.steps`, { returnObjects: true }) as string[];
  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1.5 rounded-md text-sm text-text-secondary hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t('guides.back')}
      </button>
      <div className="grid gap-6 md:grid-cols-[14rem_1fr]">
        <nav aria-label={t('guides.contents')}>
          <p className="mb-2 flex items-center gap-2 text-sm font-medium text-text">
            <Icon className="size-4 text-primary-ink" aria-hidden />
            {t(`guides.items.${guide.id}.title`)}
          </p>
          <ul className="flex flex-row gap-1 overflow-x-auto md:flex-col">
            {guide.articles.map((a) => (
              <li key={a} className="shrink-0">
                <button
                  type="button"
                  aria-current={a === article ? 'page' : undefined}
                  onClick={() => onSelect(a)}
                  className={cn(
                    'w-full rounded-lg px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                    a === article
                      ? 'bg-primary-subtle font-medium text-primary-ink'
                      : 'text-text-secondary hover:bg-surface-sunken hover:text-text',
                  )}
                >
                  {t(`guides.items.${guide.id}.articles.${a}.title`)}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <AnimatePresence mode="wait" initial={false}>
          <motion.article
            key={`${guide.id}/${article}`}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={transition.ui}
          >
            <h3 className="text-xl font-semibold text-text">{t(`${base}.title`)}</h3>
            <p className="mt-1 text-base text-text-secondary">{t(`${base}.summary`)}</p>
            <ol className="mt-5 flex flex-col gap-3">
              {steps.map((s, i) => (
                <li key={i} className="flex gap-3">
                  <span
                    className="tabular grid size-6 shrink-0 place-items-center rounded-full bg-primary-subtle text-xs font-semibold text-primary-ink"
                    aria-hidden
                  >
                    {i + 1}
                  </span>
                  <span className="text-base text-text">{s}</span>
                </li>
              ))}
            </ol>
          </motion.article>
        </AnimatePresence>
      </div>
    </div>
  );
}

/** The guides: a grid of topics; choosing one opens its articles in place (the address keeps ?guide=…&article=…). */
export function GuidesSection() {
  const { t } = useTranslation('help');
  const [params, setParams] = useSearchParams();
  const guide = findGuide(params.get('guide'));
  const article =
    guide && guide.articles.includes(params.get('article') ?? '')
      ? params.get('article')!
      : guide?.articles[0];

  const open = (id: string, a?: string) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('guide', id);
      if (a) next.set('article', a);
      else next.delete('article');
      return next;
    });
  const close = () =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('guide');
      next.delete('article');
      return next;
    });

  return (
    <Card className="p-5" id="guides">
      <CardHeader>
        <div>
          <CardTitle>{t('guides.title')}</CardTitle>
          <p className="text-sm text-text-muted">{t('guides.subtitle')}</p>
        </div>
      </CardHeader>
      {guide && article ? (
        <Reader
          guide={guide}
          article={article}
          onSelect={(a) => open(guide.id, a)}
          onBack={close}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {GUIDES.map((g, i) => (
            <GuideTile key={g.id} guide={g} index={i} onOpen={() => open(g.id)} />
          ))}
        </ul>
      )}
    </Card>
  );
}

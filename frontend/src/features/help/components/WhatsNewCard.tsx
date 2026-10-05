import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { transition } from '@/shared/motion';
import { Card, CardHeader, CardTitle } from '@/shared/ui';

interface Item {
  date: string;
  title: string;
  text: string;
}

/** Recent changes in plain words, newest first, on a timeline. */
export function WhatsNewCard() {
  const { t } = useTranslation('help');
  const reduce = useReducedMotion();
  const items = t('whatsNew.items', { returnObjects: true }) as Item[];
  return (
    <Card className="p-5" id="whats-new">
      <CardHeader>
        <div>
          <CardTitle>{t('whatsNew.title')}</CardTitle>
          <p className="text-sm text-text-muted">{t('whatsNew.subtitle')}</p>
        </div>
      </CardHeader>
      <ol className="relative ml-2 flex flex-col gap-5 border-l border-border pl-5">
        {items.map((it, i) => (
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
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{it.date}</p>
            <h3 className="text-base font-medium text-text">{it.title}</h3>
            <p className="text-sm text-text-secondary">{it.text}</p>
          </motion.li>
        ))}
      </ol>
    </Card>
  );
}

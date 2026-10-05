import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Reveal } from '@/shared/ui';
import { GuidesSection } from './GuidesSection';
import { QuickStartCard } from './QuickStartCard';
import { SearchBox } from './SearchBox';
import { ShortcutsCard } from './ShortcutsCard';
import { StatusCard } from './StatusCard';
import { WhatsNewCard } from './WhatsNewCard';

/** Help & Center: find an answer yourself, get started, learn the shortcuts, see what changed, know who to ask. */
export function HelpView() {
  const { t } = useTranslation('help');
  const [query, setQuery] = useState('');
  return (
    <div className="flex flex-col gap-6">
      <Reveal index={0}>
        <section className="flex flex-col items-center gap-2 px-2 pb-2 pt-4 text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-text">{t('hero.title')}</h2>
          <p className="mb-3 text-base text-text-secondary">{t('hero.subtitle')}</p>
          <SearchBox query={query} onQuery={setQuery} />
        </section>
      </Reveal>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Reveal index={1}>
          <QuickStartCard />
        </Reveal>
        <Reveal index={2}>
          <StatusCard />
        </Reveal>
      </div>
      <Reveal index={3}>
        <GuidesSection />
      </Reveal>
      <Reveal index={4}>
        <ShortcutsCard />
      </Reveal>
      <Reveal index={5}>
        <WhatsNewCard />
      </Reveal>
    </div>
  );
}

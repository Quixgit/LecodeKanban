import { LifeBuoy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { can, useCurrentWorkspace } from '@/features/workspaces';
import { Button, Reveal } from '@/shared/ui';
import { GuidesSection } from './GuidesSection';
import { QuickStartCard } from './QuickStartCard';
import { SearchBox } from './SearchBox';
import { ShortcutsCard } from './ShortcutsCard';
import { StatusCard } from './StatusCard';
import { SupportCard } from './SupportCard';
import { SupportInbox } from './SupportInbox';
import { WhatsNewCard } from './WhatsNewCard';

/** Help & Center: find an answer yourself, get started, learn the shortcuts, see what changed, know who to ask. */
export function HelpView() {
  const { t } = useTranslation('help');
  const [query, setQuery] = useState('');
  const { workspace } = useCurrentWorkspace();
  const manager = can(workspace, 'support.manage');
  const { hash } = useLocation();
  // Links such as /help#support land on their section.
  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(hash.slice(1));
    if (el) window.setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
  }, [hash]);
  const toSupport = () =>
    document.getElementById('support')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return (
    <div className="flex flex-col gap-6">
      <Reveal index={0}>
        <section className="flex flex-col items-center gap-2 px-2 pb-2 pt-4 text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-text">{t('hero.title')}</h2>
          <p className="mb-3 text-base text-text-secondary">{t('hero.subtitle')}</p>
          <SearchBox query={query} onQuery={setQuery} />
          <Button variant="ghost" size="sm" className="mt-1" onClick={toSupport}>
            <LifeBuoy />
            {t('hero.contact')}
          </Button>
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
        <SupportCard />
      </Reveal>
      {manager && (
        <Reveal index={5}>
          <SupportInbox />
        </Reveal>
      )}
      <Reveal index={6}>
        <ShortcutsCard />
      </Reveal>
      <Reveal index={7}>
        <WhatsNewCard />
      </Reveal>
    </div>
  );
}

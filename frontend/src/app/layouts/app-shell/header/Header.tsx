import { Info, Mail, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useChangeLanguage } from '@/features/auth';
import { env } from '@/shared/config/env';
import { IconButton, Tooltip } from '@/shared/ui';
import { LanguageSwitcher } from './LanguageSwitcher';
import { NotificationsMenu } from './NotificationsMenu';
import { PageTitle } from './PageTitle';
import { SearchTrigger } from './SearchTrigger';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu, type Viewer } from './UserMenu';

export function Header({ viewer }: { viewer: Viewer }) {
  const { t } = useTranslation();
  const changeLanguage = useChangeLanguage();
  return (
    <header className="sticky top-0 z-20 flex h-header shrink-0 items-center gap-4 border-b border-border-subtle bg-surface/85 px-6 backdrop-blur-md">
      <div className="min-w-0 flex-1">
        <PageTitle />
      </div>
      <SearchTrigger />
      <div className="flex items-center gap-2">
        <Tooltip content={t('header.help')} side="bottom">
          <IconButton asChild label={t('header.help')} className="hidden sm:inline-flex">
            <Link to="/help">
              <Info />
            </Link>
          </IconButton>
        </Tooltip>
        <Tooltip content={t('header.settings')} side="bottom">
          <IconButton asChild label={t('header.settings')} className="hidden sm:inline-flex">
            <Link to="/settings">
              <Settings />
            </Link>
          </IconButton>
        </Tooltip>
        <Tooltip content={t('header.mail')} side="bottom">
          <IconButton asChild label={t('header.mail')} className="hidden sm:inline-flex">
            <a href={env.gmailInboxUrl} target="_blank" rel="noreferrer">
              <Mail />
            </a>
          </IconButton>
        </Tooltip>
        <NotificationsMenu />
        <ThemeToggle />
        <LanguageSwitcher className="hidden sm:flex" onChange={changeLanguage} />
      </div>
      <span aria-hidden className="hidden h-8 w-px bg-border lg:block" />
      <UserMenu viewer={viewer} />
    </header>
  );
}

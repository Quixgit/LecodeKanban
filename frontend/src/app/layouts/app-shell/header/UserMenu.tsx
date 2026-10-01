import {
  ChevronDown,
  LayoutTemplate,
  LogOut,
  Monitor,
  Moon,
  Settings,
  Sun,
  UserRound,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useLogout } from '@/features/auth';
import { WorkspaceSwitcherItems } from '@/features/workspaces';
import { useTheme, type ThemePreference } from '@/shared/theme';
import {
  Avatar,
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  DropdownRadioGroup,
  DropdownRadioItem,
  DropdownSeparator,
  DropdownTrigger,
} from '@/shared/ui';

export interface Viewer {
  name: string;
  email?: string;
  avatarUrl?: string | null;
}

const themeIcons = { light: Sun, dark: Moon, system: Monitor } as const;

export function UserMenu({ viewer }: { viewer: Viewer }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { preference, setPreference } = useTheme();
  const logout = useLogout();

  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <button
          type="button"
          className="flex h-11 items-center gap-2.5 rounded-lg pl-1 pr-2 transition-colors duration-micro hover:bg-surface-muted"
          aria-label={t('userMenu.label')}
        >
          <Avatar name={viewer.name} src={viewer.avatarUrl} size="md" />
          <span className="hidden max-w-[160px] truncate text-md font-medium text-text lg:block">
            {viewer.name}
          </span>
          <ChevronDown className="size-4 stroke-[1.75] text-text-muted" aria-hidden />
        </button>
      </DropdownTrigger>
      <DropdownContent className="w-60">
        <div className="flex items-center gap-3 px-2.5 py-2">
          <Avatar name={viewer.name} src={viewer.avatarUrl} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-text">{viewer.name}</p>
            {viewer.email && <p className="truncate text-xs text-text-muted">{viewer.email}</p>}
          </div>
        </div>
        <WorkspaceSwitcherItems />
        <DropdownSeparator />
        <DropdownItem onSelect={() => navigate('/settings/profile')}>
          <UserRound />
          {t('userMenu.profile')}
        </DropdownItem>
        <DropdownItem onSelect={() => navigate('/settings')}>
          <Settings />
          {t('userMenu.settings')}
        </DropdownItem>
        <DropdownItem onSelect={() => navigate('/ui-kit')}>
          <LayoutTemplate />
          {t('userMenu.uiKit')}
        </DropdownItem>
        <DropdownSeparator />
        <DropdownLabel>{t('theme.label')}</DropdownLabel>
        <DropdownRadioGroup
          value={preference}
          onValueChange={(v) => setPreference(v as ThemePreference)}
        >
          {(['light', 'dark', 'system'] as const).map((p) => {
            const Icon = themeIcons[p];
            return (
              <DropdownRadioItem key={p} value={p}>
                <Icon />
                {t(`theme.${p}`)}
              </DropdownRadioItem>
            );
          })}
        </DropdownRadioGroup>
        <DropdownSeparator />
        <DropdownItem
          danger
          onSelect={() =>
            logout.mutate(undefined, { onSettled: () => navigate('/login', { replace: true }) })
          }
        >
          <LogOut />
          {t('userMenu.signOut')}
        </DropdownItem>
      </DropdownContent>
    </Dropdown>
  );
}

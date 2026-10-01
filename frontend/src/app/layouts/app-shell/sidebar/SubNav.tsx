import { CornerDownRight, FolderClosed } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { cn } from '@/shared/lib/cn';
import type { NavChild } from '../navigation';

/** Indented tree of child links with the guide line from the screenshots. */
export function SubNav({ parentKey, items }: { parentKey: string; items: NavChild[] }) {
  const { t } = useTranslation('nav');
  return (
    <ul
      className="relative ml-[22px] mt-1 border-l border-border pl-1.5"
      aria-label={t(`items.${parentKey}`)}
    >
      {items.map((child) => (
        <li key={child.key}>
          <NavLink
            to={child.to}
            className={({ isActive }) =>
              cn(
                'flex h-10 items-center gap-2 rounded-lg px-2 text-md transition-colors duration-micro',
                isActive
                  ? 'bg-primary-subtle font-medium text-primary-ink'
                  : 'text-text-secondary hover:bg-surface-muted hover:text-text',
              )
            }
          >
            <CornerDownRight
              className="size-3.5 shrink-0 stroke-[1.5] text-text-faint"
              aria-hidden
            />
            <FolderClosed className="size-[18px] shrink-0 stroke-[1.5]" aria-hidden />
            <span className="truncate">{t(`tasks.${child.key}`)}</span>
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

import { ChevronDown, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Member } from '@/shared/api';
import { cn } from '@/shared/lib/cn';
import {
  Avatar,
  AvatarGroup,
  Dropdown,
  DropdownCheckboxItem,
  DropdownContent,
  DropdownTrigger,
} from '@/shared/ui';

interface Props {
  members: Member[];
  value: string[];
  onChange: (ids: string[]) => void;
  label: string;
  id?: string;
}

/** Multi-select of workspace members rendered as an avatar stack. */
export function AssigneePicker({ members, value, onChange, label, id }: Props) {
  const { t } = useTranslation('tasks');
  const selected = members.filter((m) => value.includes(m.user.id));
  const toggle = (uid: string, on: boolean) =>
    onChange(on ? [...value, uid] : value.filter((v) => v !== uid));
  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <button
          id={id}
          type="button"
          aria-label={label}
          className={cn(
            'flex h-control w-full items-center gap-2 rounded-lg border border-border bg-surface px-3 text-left text-base shadow-xs',
            'transition-[border-color,box-shadow] duration-micro hover:border-border-strong data-[state=open]:border-primary data-[state=open]:shadow-focus',
          )}
        >
          {selected.length > 0 ? (
            <>
              <AvatarGroup
                people={selected.map((m) => ({ name: m.user.name, src: m.user.avatarUrl }))}
                size="xs"
                max={4}
              />
              <span className="min-w-0 flex-1 truncate text-text">
                {selected.map((m) => m.user.name).join(', ')}
              </span>
            </>
          ) : (
            <>
              <UserRound className="size-[18px] stroke-[1.6] text-text-muted" aria-hidden />
              <span className="flex-1 text-text-faint">{t('form.assigneesPlaceholder')}</span>
            </>
          )}
          <ChevronDown className="size-4 text-text-muted" aria-hidden />
        </button>
      </DropdownTrigger>
      <DropdownContent
        align="start"
        className="max-h-72 w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto"
      >
        {members.map((m) => (
          <DropdownCheckboxItem
            key={m.user.id}
            checked={value.includes(m.user.id)}
            onCheckedChange={(on) => toggle(m.user.id, on === true)}
            onSelect={(e) => e.preventDefault()}
          >
            <Avatar name={m.user.name} src={m.user.avatarUrl} size="xs" />
            <span className="truncate">{m.user.name}</span>
          </DropdownCheckboxItem>
        ))}
      </DropdownContent>
    </Dropdown>
  );
}

import { LogOut, MoreHorizontal, UserMinus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OpenMemberCard } from '@/features/member-card';
import type { Member, Role, Workspace } from '@/shared/api';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { useLanguage } from '@/shared/i18n';
import { formatDate } from '@/shared/lib/format';
import {
  Avatar,
  ConfirmDialog,
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownTrigger,
  EmptyState,
  IconButton,
  Pill,
  Select,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  toast,
} from '@/shared/ui';
import { useRoleMutations, useRoles, useWorkspaceMutations } from '../hooks/useWorkspaces';
import { can } from '../model/can';
import { assignableRoles, canRemove, ROLES } from '../model/permissions';
import { RolePill } from './RolePill';

interface Props {
  workspace: Workspace;
  members: Member[];
  currentUserId: string;
  onLeft: () => void;
}

export function MembersTable({ workspace, members, currentUserId, onLeft }: Props) {
  const { t } = useTranslation('team');
  const { language } = useLanguage();
  const errorText = useErrorText();
  const { changeRole, remove } = useWorkspaceMutations(workspace.id);
  const { assign } = useRoleMutations(workspace.id);
  const custom = (useRoles(workspace.id).data?.roles ?? []).filter((r) => r.custom);
  const manage = can(workspace, 'members.manage');
  const [pending, setPending] = useState<Member | null>(null);
  const actor = workspace.role;

  if (members.length === 0) return <EmptyState className="py-10" title={t('members.empty')} />;

  const onRole = (m: Member, role: Role) =>
    changeRole.mutate(
      { userId: m.user.id, role },
      {
        onSuccess: () =>
          toast.success(t('roleUpdated', { name: m.user.name, role: t(`roles.${role}`) })),
        onError: (e) => toast.error(errorText(e)),
      },
    );

  const onPick = (m: Member, value: string) => {
    if (value.startsWith('custom:')) {
      const id = value.slice('custom:'.length);
      assign.mutate(
        { userId: m.user.id, roleId: id },
        {
          onSuccess: () =>
            toast.success(
              t('roleUpdated', { name: m.user.name, role: custom.find((c) => c.key === id)?.name }),
            ),
          onError: (e) => toast.error(errorText(e)),
        },
      );
    } else onRole(m, value as Role);
  };

  const self = pending?.user.id === currentUserId;
  const confirmRemove = () => {
    if (!pending) return;
    remove.mutate(pending.user.id, {
      onSuccess: () => {
        toast.success(
          self
            ? t('left', { workspace: workspace.name })
            : t('removed', { name: pending.user.name }),
        );
        setPending(null);
        if (self) onLeft();
      },
      onError: (e) => {
        toast.error(errorText(e));
        setPending(null);
      },
    });
  };

  return (
    <>
      <Table>
        <THead>
          <TR>
            <TH>{t('members.columns.member')}</TH>
            <TH className="hidden md:table-cell">{t('members.columns.email')}</TH>
            <TH>{t('members.columns.role')}</TH>
            <TH className="hidden lg:table-cell">{t('members.columns.joined')}</TH>
            <TH align="center" className="w-20">
              {t('members.columns.action')}
            </TH>
          </TR>
        </THead>
        <TBody>
          {members.map((m) => {
            const isSelf = m.user.id === currentUserId;
            const roles = assignableRoles(actor, m.role, isSelf);
            const removable = canRemove(actor, m.role, isSelf);
            return (
              <TR key={m.user.id}>
                <TD>
                  <span className="flex items-center gap-2.5 font-medium text-text">
                    <Avatar name={m.user.name} src={m.user.avatarUrl} size="sm" />
                    <OpenMemberCard
                      userId={m.user.id}
                      label={t('members.openProfile', { name: m.user.name })}
                    >
                      <span className="truncate">{m.user.name}</span>
                    </OpenMemberCard>
                    {isSelf && (
                      <Pill tone="teal" size="sm">
                        {t('members.you')}
                      </Pill>
                    )}
                  </span>
                </TD>
                <TD className="hidden md:table-cell">{m.user.email}</TD>
                <TD>
                  {(roles.length > 1 ||
                    (manage && !isSelf && m.role !== 'owner' && custom.length > 0)) &&
                  (manage || isSelf) ? (
                    <Select
                      label={t('actions.changeRole')}
                      value={m.customRole ? `custom:${m.customRole.id}` : m.role}
                      onValueChange={(v) =>
                        v !== (m.customRole ? `custom:${m.customRole.id}` : m.role) && onPick(m, v)
                      }
                      className="h-8 px-2.5 text-sm"
                      options={[
                        ...roles.map((r) => ({ value: r as string, label: t(`roles.${r}`) })),
                        ...(m.role === 'owner' || isSelf
                          ? []
                          : custom
                              .filter((c) => ROLES.indexOf(c.base) >= ROLES.indexOf(actor))
                              .map((c) => ({ value: `custom:${c.key}`, label: c.name }))),
                        ...(m.customRole && !custom.some((c) => c.key === m.customRole!.id)
                          ? [{ value: `custom:${m.customRole.id}`, label: m.customRole.name }]
                          : []),
                      ]}
                    />
                  ) : (
                    <RolePill role={m.role} label={m.customRole?.name} />
                  )}
                </TD>
                <TD className="hidden whitespace-nowrap lg:table-cell">
                  {formatDate(m.joinedAt, language)}
                </TD>
                <TD align="center">
                  {removable && (
                    <Dropdown>
                      <DropdownTrigger asChild>
                        <IconButton label={t('members.columns.action')} size="sm">
                          <MoreHorizontal />
                        </IconButton>
                      </DropdownTrigger>
                      <DropdownContent>
                        <DropdownItem danger onSelect={() => setPending(m)}>
                          {isSelf ? <LogOut /> : <UserMinus />}
                          {isSelf ? t('actions.leave') : t('actions.remove')}
                        </DropdownItem>
                      </DropdownContent>
                    </Dropdown>
                  )}
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(null)}
        title={
          self
            ? t('confirmLeave.title', { workspace: workspace.name })
            : t('confirmRemove.title', { name: pending?.user.name })
        }
        description={self ? t('confirmLeave.body') : t('confirmRemove.body')}
        confirmLabel={self ? t('confirmLeave.confirm') : t('confirmRemove.confirm')}
        loading={remove.isPending}
        onConfirm={confirmRemove}
      />
    </>
  );
}

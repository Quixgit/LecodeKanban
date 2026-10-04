import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Lock, Plus, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  can,
  useCurrentWorkspace,
  useRoleMutations,
  useRoles,
  type PermissionInfo,
  type RoleDefinition,
} from '@/features/workspaces';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { cn } from '@/shared/lib/cn';
import {
  Button,
  ConfirmDialog,
  Field,
  FormAlert,
  Input,
  Modal,
  Pill,
  Select,
  Skeleton,
  Switch,
  toast,
  type Tone,
} from '@/shared/ui';
import { PERM_GROUPS, permKey, type RolePreset } from '../model/permissions';
import { SectionHeader } from './SectionHeader';

const TONE: Record<string, Tone> = {
  owner: 'teal',
  admin: 'purple',
  member: 'neutral',
  viewer: 'amber',
};

/** Settings → Roles & permissions: what each role may do, and your own roles on top of the built-in ones. */
export function RolesPage() {
  const { t } = useTranslation('settings');
  const reduce = useReducedMotion();
  const { workspace } = useCurrentWorkspace();
  const roles = useRoles(workspace?.id);
  const [selected, setSelected] = useState('member');
  const [creating, setCreating] = useState(false);
  const list = useMemo(() => roles.data?.roles ?? [], [roles.data]);
  const role = list.find((r) => r.key === selected) ?? list[0];
  const canEdit = can(workspace, 'roles.manage');

  // A deleted role leaves the selection pointing nowhere: fall back to the first one.
  useEffect(() => {
    if (list.length > 0 && !list.some((r) => r.key === selected)) setSelected(list[0]!.key);
  }, [list, selected]);

  return (
    <div>
      <SectionHeader
        title={t('sections.roles.title')}
        description={t('sections.roles.description')}
        action={
          canEdit && (
            <Button onClick={() => setCreating(true)}>
              <Plus />
              {t('roles.new')}
            </Button>
          )
        }
      />
      {!workspace || roles.isPending || !role ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <ul className="flex flex-col gap-1.5" aria-label={t('roles.list')}>
            {list.map((r) => (
              <li key={r.key}>
                <button
                  type="button"
                  aria-current={r.key === role.key}
                  onClick={() => setSelected(r.key)}
                  className={cn(
                    'relative flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left outline-none transition-colors duration-micro focus-visible:shadow-focus',
                    r.key === role.key
                      ? 'border-primary-border bg-primary-subtle'
                      : 'border-border-subtle bg-surface hover:border-border hover:bg-surface-muted',
                  )}
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface text-primary-ink">
                    {r.locked ? (
                      <Lock className="size-4" aria-hidden />
                    ) : (
                      <ShieldCheck className="size-4" aria-hidden />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-text">
                      {r.custom ? r.name : t(`roles.names.${r.key}`)}
                    </span>
                    <span className="block text-xs text-text-muted">
                      {t('roles.people', { count: r.members })}
                    </span>
                  </span>
                  {r.custom && (
                    <Pill size="sm" tone={TONE[r.base] ?? 'neutral'}>
                      {t('roles.custom')}
                    </Pill>
                  )}
                  {r.changed && (
                    <Pill size="sm" tone="amber">
                      {t('roles.changed')}
                    </Pill>
                  )}
                </button>
              </li>
            ))}
          </ul>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={role.key}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0 }}
              transition={{ duration: 0.16 }}
            >
              <RoleEditor
                key={role.key}
                workspaceId={workspace.id}
                role={role}
                catalog={roles.data!.catalog}
                canEdit={canEdit}
              />
            </motion.div>
          </AnimatePresence>
        </div>
      )}
      {creating && workspace && (
        <CreateRoleDialog
          workspaceId={workspace.id}
          roles={list}
          onClose={() => setCreating(false)}
          onCreated={(key) => {
            setCreating(false);
            setSelected(key);
          }}
        />
      )}
    </div>
  );
}

function RoleEditor({
  workspaceId,
  role,
  catalog,
  canEdit,
}: {
  workspaceId: string;
  role: RoleDefinition;
  catalog: PermissionInfo[];
  canEdit: boolean;
}) {
  const { t } = useTranslation('settings');
  const errorText = useErrorText();
  const m = useRoleMutations(workspaceId);
  const [name, setName] = useState(role.name);
  const [description, setDescription] = useState(role.description);
  const [base, setBase] = useState(role.base);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const locked = role.locked || !canEdit;
  const held = useMemo(() => new Set(role.permissions), [role.permissions]);
  const profileChanged =
    role.custom && (name !== role.name || description !== role.description || base !== role.base);

  const toggle = (key: string, on: boolean) => {
    const next = on ? [...role.permissions, key] : role.permissions.filter((p) => p !== key);
    const done = {
      onSuccess: () => toast.success(t('saved')),
      onError: (e: unknown) => toast.error(errorText(e)),
    };
    if (role.custom)
      m.update.mutate(
        {
          key: role.key,
          body: {
            name: role.name,
            description: role.description,
            base: role.base as 'admin' | 'member' | 'viewer',
            permissions: next,
          },
        },
        done,
      );
    else m.setPermissions.mutate({ key: role.key, permissions: next }, done);
  };
  const saveProfile = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    m.update.mutate(
      {
        key: role.key,
        body: {
          name,
          description,
          base: base as 'admin' | 'member' | 'viewer',
          permissions: role.permissions,
        },
      },
      { onSuccess: () => toast.success(t('saved')), onError: (err) => setError(errorText(err)) },
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-card">
        {role.custom && !locked ? (
          <form onSubmit={saveProfile} noValidate className="flex flex-col gap-4">
            {error && <FormAlert>{error}</FormAlert>}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('roles.name')}>
                <Input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label={t('roles.base')} hint={t('roles.baseHint')}>
                <Select
                  className="w-full justify-between"
                  label={t('roles.base')}
                  value={base}
                  onValueChange={(v) => setBase(v as typeof base)}
                  options={(['admin', 'member', 'viewer'] as const).map((r) => ({
                    value: r,
                    label: t(`roles.names.${r}`),
                  }))}
                />
              </Field>
            </div>
            <Field label={t('roles.description')}>
              <Input
                value={description}
                maxLength={200}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                className="text-danger-ink"
                onClick={() => setRemoving(true)}
              >
                <Trash2 />
                {t('roles.delete')}
              </Button>
              <Button
                type="submit"
                loading={m.update.isPending}
                disabled={!profileChanged || !name.trim()}
              >
                {t('roles.saveProfile')}
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-base font-semibold text-text">
                {role.custom ? role.name : t(`roles.names.${role.key}`)}
                <Pill size="sm" tone={TONE[role.base] ?? 'neutral'}>
                  {t(`roles.names.${role.base}`)}
                </Pill>
              </h3>
              <p className="mt-1 max-w-prose text-sm text-text-muted">
                {role.custom
                  ? role.description || t('roles.noDescription')
                  : t(`roles.about.${role.key}`)}
              </p>
              {role.locked && (
                <p className="mt-2 text-xs text-text-muted">{t('roles.ownerLocked')}</p>
              )}
            </div>
            {role.changed && canEdit && (
              <Button variant="secondary" size="sm" onClick={() => setResetting(true)}>
                <RotateCcw />
                {t('roles.reset')}
              </Button>
            )}
          </div>
        )}
      </section>

      {PERM_GROUPS.map((group) => {
        const items = catalog.filter((c) => c.group === group);
        if (items.length === 0) return null;
        return (
          <section
            key={group}
            className="overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-card"
          >
            <h3 className="border-b border-border-subtle px-5 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
              {t(`roles.groups.${group}`)}
            </h3>
            <ul>
              {items.map((c) => {
                const on = held.has(c.key);
                const alwaysOn = c.key === 'workspace.view';
                const ownerOnly = c.fixed;
                return (
                  <li
                    key={c.key}
                    className="flex items-center justify-between gap-4 border-b border-border-subtle px-5 py-3 last:border-b-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text">
                        {t(`perms.${permKey(c.key)}.title`)}
                      </p>
                      <p className="text-xs text-text-muted">
                        {t(`perms.${permKey(c.key)}.description`)}
                      </p>
                    </div>
                    <Switch
                      checked={on}
                      disabled={locked || alwaysOn || (ownerOnly && !on)}
                      aria-label={t(`perms.${permKey(c.key)}.title`)}
                      onCheckedChange={(v) => toggle(c.key, v)}
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <ConfirmDialog
        open={removing}
        onOpenChange={setRemoving}
        title={t('roles.deleteTitle', { name: role.name })}
        description={t('roles.deleteBody', {
          count: role.members,
          base: t(`roles.names.${role.base}`),
        })}
        confirmLabel={t('roles.delete')}
        loading={m.remove.isPending}
        onConfirm={() =>
          m.remove.mutate(role.key, {
            onSuccess: () => {
              setRemoving(false);
              toast.success(t('roles.deleted'));
            },
            onError: (e) => toast.error(errorText(e)),
          })
        }
      />
      <ConfirmDialog
        open={resetting}
        onOpenChange={setResetting}
        danger={false}
        title={t('roles.resetTitle', { name: t(`roles.names.${role.key}`) })}
        description={t('roles.resetBody')}
        confirmLabel={t('roles.reset')}
        loading={m.reset.isPending}
        onConfirm={() =>
          m.reset.mutate(role.key, {
            onSuccess: () => {
              setResetting(false);
              toast.success(t('roles.resetDone'));
            },
            onError: (e) => toast.error(errorText(e)),
          })
        }
      />
    </div>
  );
}

function CreateRoleDialog({
  workspaceId,
  roles,
  onClose,
  onCreated,
}: {
  workspaceId: string;
  roles: RoleDefinition[];
  onClose: () => void;
  onCreated: (key: string) => void;
}) {
  const { t } = useTranslation('settings');
  const errorText = useErrorText();
  const m = useRoleMutations(workspaceId);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [preset, setPreset] = useState<RolePreset>('member');
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const from = roles.find((r) => r.key === preset);
    m.create.mutate(
      {
        name,
        description,
        base: preset === 'blank' ? 'viewer' : (preset as 'admin' | 'member' | 'viewer'),
        permissions: from ? from.permissions : ['workspace.view'],
      },
      { onSuccess: (r) => onCreated(r.key), onError: (err) => setError(errorText(err)) },
    );
  };

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={t('roles.newTitle')}
      description={t('roles.newDescription')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('roles.cancel')}
          </Button>
          <Button
            type="submit"
            form="role-form"
            loading={m.create.isPending}
            disabled={!name.trim()}
          >
            {t('roles.create')}
          </Button>
        </>
      }
    >
      <form id="role-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        {error && <FormAlert>{error}</FormAlert>}
        <Field label={t('roles.name')}>
          <Input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field label={t('roles.description')}>
          <Input
            value={description}
            maxLength={200}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <Field label={t('roles.startFrom')} hint={t('roles.startFromHint')}>
          <Select
            className="w-full justify-between"
            label={t('roles.startFrom')}
            value={preset}
            onValueChange={(v) => setPreset(v as RolePreset)}
            options={[
              { value: 'blank', label: t('roles.blank') },
              { value: 'viewer', label: t('roles.names.viewer') },
              { value: 'member', label: t('roles.names.member') },
              { value: 'admin', label: t('roles.names.admin') },
            ]}
          />
        </Field>
      </form>
    </Modal>
  );
}

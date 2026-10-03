import { Check, ChevronDown, FolderKanban, ShieldCheck, X } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAllProjects } from '@/features/projects';
import { useWorkspaceMembers } from '@/features/workspaces';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { formatDate } from '@/shared/lib/format';
import {
  Button,
  Dropdown,
  DropdownCheckboxItem,
  DropdownContent,
  DropdownTrigger,
  Field,
  Input,
  Pill,
  Select,
  toast,
} from '@/shared/ui';
import type { WikiNodeDto, WikiNodePatch, WikiStatusName } from '../api/wikiApi';
import { useWikiMutations } from '../hooks/useWiki';
import { can } from '../model/permissions';

const STATUSES: WikiStatusName[] = ['draft', 'published', 'outdated'];
const REVIEW_CHOICES = [0, 30, 60, 90, 180, 365];

/** Page properties: status, tags, linked projects and the "is this still true?" review cycle. */
export function PageProperties({
  workspaceId,
  node,
  projectIds,
}: {
  workspaceId: string;
  node: WikiNodeDto;
  projectIds: readonly string[];
}) {
  const { t, i18n } = useTranslation('wiki');
  const errorText = useErrorText();
  const m = useWikiMutations(workspaceId);
  const members = useWorkspaceMembers(workspaceId);
  const projects = useAllProjects(workspaceId);
  const editable = can.edit(node.access.role);
  const [tag, setTag] = useState('');

  const patch = (p: WikiNodePatch) =>
    m.updateNode.mutate({ id: node.id, patch: p }, { onError: (e) => toast.error(errorText(e)) });

  const addTag = () => {
    const value = tag.trim();
    if (!value) return;
    setTag('');
    if (!node.tags.some((x) => x.toLowerCase() === value.toLowerCase()))
      patch({ tags: [...node.tags, value] });
  };
  const onTagKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    }
  };

  const list = projects.data?.items ?? [];
  const linked = list.filter((p) => projectIds.includes(p.id));
  const owner = members.data?.find((x) => x.user.id === node.ownerId)?.user.name;

  return (
    <section
      aria-label={t('properties.title')}
      className="grid gap-x-6 gap-y-4 rounded-2xl border border-border-subtle bg-surface-muted/60 p-4 sm:grid-cols-2"
    >
      <Field label={t('properties.status')}>
        <Select
          label={t('properties.status')}
          value={node.status}
          disabled={!editable}
          onValueChange={(v) => patch({ status: v as WikiStatusName })}
          className="w-full justify-between"
          options={STATUSES.map((s) => ({ value: s, label: t(`properties.statuses.${s}`) }))}
        />
      </Field>

      <Field label={t('properties.review')} hint={t('properties.reviewHint')}>
        <Select
          label={t('properties.review')}
          value={String(node.reviewDays)}
          disabled={!editable}
          onValueChange={(v) => patch({ reviewDays: Number(v) })}
          className="w-full justify-between"
          options={REVIEW_CHOICES.map((d) => ({
            value: String(d),
            label: d === 0 ? t('properties.reviewOff') : t('properties.reviewEvery', { count: d }),
          }))}
        />
      </Field>

      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <span className="inline-flex items-center gap-2 text-base text-text-secondary">
          <ShieldCheck className="size-4 stroke-[1.6]" aria-hidden />
          {node.lastVerifiedAt
            ? t('properties.verifiedOn', { date: formatDate(node.lastVerifiedAt, i18n.language) })
            : t('properties.neverVerified')}
        </span>
        {node.reviewDue && <Pill tone="amber">{t('properties.needsReview')}</Pill>}
        {editable && (
          <Button
            size="sm"
            variant="secondary"
            loading={m.updateNode.isPending && !!m.updateNode.variables?.patch.verify}
            onClick={() => patch({ verify: true })}
          >
            <Check />
            {t('properties.verify')}
          </Button>
        )}
      </div>

      <Field label={t('properties.tags')}>
        <div className="flex flex-col gap-2">
          {node.tags.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {node.tags.map((x) => (
                <li key={x}>
                  <Pill tone="neutral" className="gap-1">
                    {x}
                    {editable && (
                      <button
                        type="button"
                        aria-label={t('properties.removeTag', { tag: x })}
                        onClick={() => patch({ tags: node.tags.filter((y) => y !== x) })}
                        className="-mr-1 flex size-4 items-center justify-center rounded-full hover:bg-surface-sunken focus-visible:shadow-focus focus-visible:outline-none"
                      >
                        <X className="size-3" aria-hidden />
                      </button>
                    )}
                  </Pill>
                </li>
              ))}
            </ul>
          )}
          {editable && (
            <Input
              value={tag}
              maxLength={30}
              placeholder={t('properties.tagPlaceholder')}
              onChange={(e) => setTag(e.target.value)}
              onKeyDown={onTagKey}
              onBlur={addTag}
              disabled={node.tags.length >= 10}
            />
          )}
        </div>
      </Field>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-text">{t('properties.projects')}</span>
        {linked.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {linked.map((p) => (
              <li key={p.id}>
                <Pill tone="teal" icon={<FolderKanban />}>
                  {p.name}
                </Pill>
              </li>
            ))}
          </ul>
        )}
        {editable && (
          <Dropdown>
            <DropdownTrigger asChild>
              <button
                type="button"
                className="inline-flex h-control items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3.5 text-base text-text-secondary shadow-xs transition-colors duration-micro hover:border-border-strong focus-visible:shadow-focus focus-visible:outline-none"
              >
                {linked.length > 0 ? t('properties.projectsEdit') : t('properties.projectsAdd')}
                <ChevronDown className="size-4 stroke-[1.6] text-text-muted" aria-hidden />
              </button>
            </DropdownTrigger>
            <DropdownContent align="start" className="max-h-72 w-72 overflow-y-auto">
              {list.length === 0 ? (
                <p className="px-2.5 py-2 text-sm text-text-muted">{t('properties.noProjects')}</p>
              ) : (
                list.map((p) => (
                  <DropdownCheckboxItem
                    key={p.id}
                    checked={projectIds.includes(p.id)}
                    onSelect={(e) => e.preventDefault()}
                    onCheckedChange={(on) =>
                      patch({
                        projectIds: on
                          ? [...projectIds, p.id]
                          : projectIds.filter((x) => x !== p.id),
                      })
                    }
                  >
                    {p.name}
                  </DropdownCheckboxItem>
                ))
              )}
            </DropdownContent>
          </Dropdown>
        )}
      </div>

      <p className="text-sm text-text-muted sm:col-span-2">
        {owner && <span className="mr-4">{t('page.owner', { name: owner })}</span>}
        <span className="mr-4">
          {t('properties.created', { date: formatDate(node.createdAt, i18n.language) })}
        </span>
        <span>{t('page.updated', { date: formatDate(node.updatedAt, i18n.language) })}</span>
      </p>
    </section>
  );
}

import { copyText } from '@/shared/lib/clipboard';
import { motion } from 'framer-motion';
import {
  Copy,
  FileText,
  ImagePlus,
  MoreHorizontal,
  Settings2,
  Share2,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { PageEditor } from '@/features/wiki-editor';
import { useCurrentWorkspace, useWorkspaceMembers } from '@/features/workspaces';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { cn } from '@/shared/lib/cn';
import { formatDate } from '@/shared/lib/format';
import { listContainer, listItem, pageTransition } from '@/shared/motion';
import {
  Button,
  ConfirmDialog,
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  DropdownTrigger,
  EmptyState,
  IconButton,
  Pill,
  Skeleton,
  toast,
} from '@/shared/ui';
import { wikiApi } from '../api/wikiApi';
import { useNode, useTree, useWikiMutations } from '../hooks/useWiki';
import { can } from '../model/permissions';
import { ancestors, buildIndex, type WikiNode } from '../model/tree';
import { Breadcrumbs } from './Breadcrumbs';
import { IconPicker } from './IconPicker';
import { NodeIcon } from './NodeIcon';
import { PageProperties } from './PageProperties';
import { SaveTemplateDialog } from './SaveTemplateDialog';
import { ShareDialog } from './ShareDialog';
import { PageSkeleton } from './Skeletons';
import { VisibilityIcon } from './VisibilityIcon';
import type { WikiOutletContext } from './WikiLayout';

const statusTone = { draft: 'neutral', published: 'teal', outdated: 'amber' } as const;

/** A page or folder: breadcrumbs, title, properties, share/favorite actions and the editor. */
export function PageView() {
  const { t, i18n } = useTranslation('wiki');
  const errorText = useErrorText();
  const navigate = useNavigate();
  const { nodeId } = useParams();
  const { workspaceId } = useOutletContext<WikiOutletContext>();
  const { workspace } = useCurrentWorkspace();
  const node = useNode(nodeId);
  const tree = useTree(node.data?.spaceId);
  const members = useWorkspaceMembers(workspaceId);
  const m = useWikiMutations(workspaceId);
  const [share, setShare] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showProps, setShowProps] = useState(false);
  const [templateDlg, setTemplateDlg] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const coverInput = useRef<HTMLInputElement>(null);

  const index = useMemo(() => buildIndex(tree.data?.nodes ?? []), [tree.data]);
  const n = node.data;
  const editable = can.edit(n?.access.role);
  const trail = n ? ancestors(index, n.id) : [];
  const children = n ? (index.children.get(n.id) ?? []) : [];
  const owner = members.data?.find((x) => x.user.id === n?.ownerId)?.user.name;
  const isAdmin = workspace?.role === 'owner' || workspace?.role === 'admin';

  // The tab title follows the page.
  useEffect(() => {
    if (!n) return;
    const previous = document.title;
    document.title = `${n.title} · ${t('panel.title')}`;
    return () => {
      document.title = previous;
    };
  }, [n, t]);

  if (node.isPending) return <PageSkeleton />;
  if (node.isError || !n) {
    return (
      <EmptyState
        icon={<FileText />}
        title={t('page.errorTitle')}
        description={errorText(node.error)}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => node.refetch()}>
              {t('common.retry')}
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/docs">{t('page.backToDocs')}</Link>
            </Button>
          </div>
        }
      />
    );
  }

  const patch = (p: Parameters<typeof m.updateNode.mutate>[0]['patch']) =>
    m.updateNode.mutate({ id: n.id, patch: p }, { onError: (e) => toast.error(errorText(e)) });

  const copyLink = async () => {
    try {
      if (!(await copyText(`${window.location.origin}/docs/p/${n.id}`)))
        throw new Error('copy failed');
      toast.success(t('share.linkCopied'));
    } catch {
      toast.error(t('share.linkCopyFailed'));
    }
  };

  const remove = () =>
    m.deleteNode.mutate(n.id, {
      onSuccess: () => {
        toast.success(t('tree.deleted', { title: n.title }));
        navigate(`/docs/s/${n.spaceId}`, { replace: true });
      },
      onError: (e) => toast.error(errorText(e)),
    });

  const uploadCover = async (file: File | undefined) => {
    if (!file) return;
    setUploadingCover(true);
    try {
      const f = await wikiApi.uploadFile(n.id, file);
      if (!/^image\//.test(f.contentType)) throw new Error('not an image');
      patch({ cover: `${f.url}?inline=true` });
    } catch (e) {
      toast.error(
        t('cover.failed'),
        e instanceof Error && e.message === 'not an image' ? t('cover.notImage') : errorText(e),
      );
    } finally {
      setUploadingCover(false);
    }
  };

  return (
    <motion.article
      key={n.id}
      variants={pageTransition}
      initial="hidden"
      animate="visible"
      className={cn(
        'mx-auto flex w-full flex-col gap-5 px-5 py-6 sm:px-8',
        n.fullWidth ? 'max-w-none' : 'max-w-5xl',
      )}
    >
      {tree.data && <Breadcrumbs space={tree.data.space} trail={trail} />}

      {n.cover && (
        <div className="group relative -mx-1 overflow-hidden rounded-2xl border border-border-subtle bg-surface-muted">
          <img src={n.cover} alt="" className="h-44 w-full object-cover sm:h-56" />
          {editable && (
            <div className="absolute right-3 top-3 flex gap-1.5 opacity-0 transition-opacity duration-ui focus-within:opacity-100 group-hover:opacity-100">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => coverInput.current?.click()}
                loading={uploadingCover}
              >
                <ImagePlus />
                {t('cover.change')}
              </Button>
              <IconButton
                label={t('cover.remove')}
                variant="outline"
                size="sm"
                onClick={() => patch({ cover: '' })}
              >
                <X />
              </IconButton>
            </div>
          )}
        </div>
      )}

      <header className="flex flex-wrap items-start gap-3">
        <IconPicker node={n} editable={editable} onChange={(icon) => patch({ icon })} />
        <div className="min-w-0 flex-1">
          <TitleField
            key={n.id + n.updatedAt}
            title={n.title}
            editable={editable}
            label={t('page.titleLabel')}
            onSave={(title) => patch({ title })}
          />
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-text-muted">
            <Pill tone={statusTone[n.status]} size="sm">
              {t(`properties.statuses.${n.status}`)}
            </Pill>
            {n.reviewDue && (
              <Pill tone="red" size="sm">
                {t('properties.needsReview')}
              </Pill>
            )}
            <span className="inline-flex items-center gap-1.5">
              <VisibilityIcon visibility={n.access.visibility} />
              {t(`visibility.${n.access.visibility}.name`)}
            </span>
            {owner && <span>{t('page.owner', { name: owner })}</span>}
            <span>{t('page.updated', { date: formatDate(n.updatedAt, i18n.language) })}</span>
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="secondary" onClick={() => setShare(true)}>
            <Share2 />
            {t('menu.share')}
          </Button>
          <IconButton
            label={t('properties.title')}
            aria-pressed={showProps}
            className={
              showProps ? 'border-primary-border bg-primary-subtle text-primary-ink' : undefined
            }
            onClick={() => setShowProps((v) => !v)}
          >
            <Settings2 />
          </IconButton>
          <IconButton
            label={n.favorite ? t('menu.unfavorite') : t('menu.favorite')}
            aria-pressed={n.favorite}
            onClick={() =>
              m.favorite.mutate(
                { id: n.id, on: !n.favorite },
                { onError: (e) => toast.error(errorText(e)) },
              )
            }
          >
            <Star className={n.favorite ? 'fill-current text-progress' : undefined} />
          </IconButton>
          <Dropdown>
            <DropdownTrigger asChild>
              <IconButton label={t('page.more')}>
                <MoreHorizontal />
              </IconButton>
            </DropdownTrigger>
            <DropdownContent>
              <DropdownItem onSelect={copyLink}>
                <Copy />
                {t('menu.copyLink')}
              </DropdownItem>
              {editable && !n.cover && (
                <DropdownItem onSelect={() => setTimeout(() => coverInput.current?.click(), 0)}>
                  <ImagePlus />
                  {t('cover.add')}
                </DropdownItem>
              )}
              {editable && <DropdownSeparator />}
              {editable && (
                <DropdownItem danger onSelect={() => setConfirmDelete(true)}>
                  <Trash2 />
                  {t('menu.delete')}
                </DropdownItem>
              )}
            </DropdownContent>
          </Dropdown>
        </div>
      </header>

      {showProps && <PageProperties workspaceId={workspaceId} node={n} projectIds={n.projectIds} />}

      <Suspense
        fallback={
          <div className="flex flex-col gap-3" role="status" aria-busy>
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-5 w-1/2" />
          </div>
        }
      >
        <PageEditor
          nodeId={n.id}
          title={n.title}
          canEdit={editable}
          fullWidth={n.fullWidth}
          onFullWidthChange={editable ? (v) => patch({ fullWidth: v }) : undefined}
          onSaveAsTemplate={isAdmin ? () => setTemplateDlg(true) : undefined}
        />
      </Suspense>

      {n.kind === 'folder' && children.length > 0 && (
        <section aria-label={t('folder.contents')} className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-text">{t('folder.contents')}</h2>
          <FolderBody children={children} />
        </section>
      )}

      <input
        ref={coverInput}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        hidden
        aria-hidden
        tabIndex={-1}
        onChange={(e) => {
          void uploadCover(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <ShareDialog
        open={share}
        onOpenChange={setShare}
        workspaceId={workspaceId}
        target={{ nodeId: n.id }}
        title={n.title}
      />
      <SaveTemplateDialog
        open={templateDlg}
        onOpenChange={setTemplateDlg}
        workspaceId={workspaceId}
        nodeId={n.id}
        defaultName={n.title}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t('tree.deleteTitle', { title: n.title })}
        description={t('tree.deleteDescription')}
        confirmLabel={t('menu.delete')}
        loading={m.deleteNode.isPending}
        onConfirm={remove}
      />
    </motion.article>
  );
}

function TitleField({
  title,
  editable,
  label,
  onSave,
}: {
  title: string;
  editable: boolean;
  label: string;
  onSave: (title: string) => void;
}) {
  const [value, setValue] = useState(title);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => setValue(title), [title]);
  const commit = () => {
    const next = value.trim();
    if (!next) setValue(title);
    else if (next !== title) onSave(next);
  };
  if (!editable) return <h1 className="text-3xl font-semibold text-text">{title}</h1>;
  return (
    <h1 className="m-0">
      <input
        ref={ref}
        value={value}
        aria-label={label}
        maxLength={200}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') ref.current?.blur();
          if (e.key === 'Escape') {
            setValue(title);
            ref.current?.blur();
          }
        }}
        className="w-full rounded-lg bg-transparent px-1 py-0.5 text-3xl font-semibold text-text outline-none transition-shadow duration-micro hover:bg-surface-muted focus:bg-surface focus:shadow-focus"
      />
    </h1>
  );
}

/** Children of a folder as cards that stagger in like the project cards. */
export function FolderBody({ children }: { children: readonly WikiNode[] }) {
  const { t } = useTranslation('wiki');
  if (children.length === 0) {
    return (
      <EmptyState
        icon={<FileText />}
        title={t('folder.emptyTitle')}
        description={t('folder.emptyDescription')}
        className="rounded-2xl border border-dashed border-border py-16"
      />
    );
  }
  return (
    <motion.ul
      variants={listContainer}
      initial="hidden"
      animate="visible"
      className="grid gap-3 sm:grid-cols-2"
    >
      {children.map((c) => (
        <motion.li key={c.id} variants={listItem}>
          <Link
            to={`/docs/p/${c.id}`}
            className="flex items-center gap-3 rounded-xl border border-border-subtle bg-surface p-4 shadow-sm transition-[box-shadow,transform] duration-ui hover:-translate-y-0.5 hover:shadow-md focus-visible:shadow-focus focus-visible:outline-none"
          >
            <NodeIcon node={c} className="!size-6" />
            <span className="min-w-0 flex-1 truncate text-md font-medium text-text">{c.title}</span>
            <VisibilityIcon visibility={c.access.visibility} className="text-text-faint" />
          </Link>
        </motion.li>
      ))}
    </motion.ul>
  );
}

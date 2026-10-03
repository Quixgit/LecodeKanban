import { motion } from 'framer-motion';
import { Copy, FileText, MoreHorizontal, Share2, Star, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { useWorkspaceMembers } from '@/features/workspaces';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { formatDate } from '@/shared/lib/format';
import { itemPresence, listContainer, listItem, pageTransition } from '@/shared/motion';
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
  toast,
} from '@/shared/ui';
import { useNode, useTree, useWikiMutations } from '../hooks/useWiki';
import { can } from '../model/permissions';
import { ancestors, buildIndex, type WikiNode } from '../model/tree';
import { Breadcrumbs } from './Breadcrumbs';
import { NodeIcon } from './NodeIcon';
import { ShareDialog } from './ShareDialog';
import { PageSkeleton } from './Skeletons';
import { VisibilityIcon } from './VisibilityIcon';
import type { WikiOutletContext } from './WikiLayout';

/** A page or folder: breadcrumbs, title, share/favorite actions and the body. */
export function PageView() {
  const { t, i18n } = useTranslation('wiki');
  const errorText = useErrorText();
  const navigate = useNavigate();
  const { nodeId } = useParams();
  const { workspaceId } = useOutletContext<WikiOutletContext>();
  const node = useNode(nodeId);
  const tree = useTree(node.data?.spaceId);
  const members = useWorkspaceMembers(workspaceId);
  const m = useWikiMutations(workspaceId);
  const [share, setShare] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const index = useMemo(() => buildIndex(tree.data?.nodes ?? []), [tree.data]);
  const n = node.data;
  const editable = can.edit(n?.access.role);
  const trail = n ? ancestors(index, n.id) : [];
  const children = n ? (index.children.get(n.id) ?? []) : [];
  const owner = members.data?.find((x) => x.user.id === n?.ownerId)?.user.name;

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

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/docs/p/${n.id}`);
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

  return (
    <motion.article
      key={n.id}
      variants={pageTransition}
      initial="hidden"
      animate="visible"
      className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-5 py-6 sm:px-8"
    >
      {tree.data && <Breadcrumbs space={tree.data.space} trail={trail} />}

      <header className="flex flex-wrap items-start gap-3">
        <NodeIcon node={n} className="mt-1.5 !size-8 !text-text-secondary" />
        <div className="min-w-0 flex-1">
          <TitleField
            key={n.id + n.updatedAt}
            title={n.title}
            editable={editable}
            label={t('page.titleLabel')}
            onSave={(title) =>
              m.updateNode.mutate(
                { id: n.id, patch: { title } },
                { onError: (e) => toast.error(errorText(e)) },
              )
            }
          />
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-muted">
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

      {n.kind === 'folder' ? (
        <FolderBody children={children} />
      ) : (
        <motion.div variants={itemPresence} initial="hidden" animate="visible">
          <EmptyState
            icon={<FileText />}
            title={t('page.emptyTitle')}
            description={t('page.emptyDescription')}
            className="rounded-2xl border border-dashed border-border py-16"
          />
        </motion.div>
      )}

      <ShareDialog
        open={share}
        onOpenChange={setShare}
        workspaceId={workspaceId}
        target={{ nodeId: n.id }}
        title={n.title}
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

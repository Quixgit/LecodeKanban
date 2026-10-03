import { motion } from 'framer-motion';
import { FilePlus2, FolderPlus, Settings2, Share2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { pageTransition } from '@/shared/motion';
import { Button, EmptyState, toast } from '@/shared/ui';
import { BookOpen } from 'lucide-react';
import { useTree, useWikiMutations } from '../hooks/useWiki';
import { can } from '../model/permissions';
import { buildIndex } from '../model/tree';
import { FolderBody } from './PageView';
import { ShareDialog } from './ShareDialog';
import { PageSkeleton } from './Skeletons';
import { SpaceDialog } from './SpaceDialog';
import { SpaceTile } from './SpaceTile';
import { VisibilityIcon } from './VisibilityIcon';
import type { WikiOutletContext } from './WikiLayout';

/** A space's landing page: description, who can see it and its top-level pages. */
export function SpaceHome() {
  const { t } = useTranslation('wiki');
  const errorText = useErrorText();
  const navigate = useNavigate();
  const { spaceId } = useParams();
  const { workspaceId } = useOutletContext<WikiOutletContext>();
  const tree = useTree(spaceId);
  const m = useWikiMutations(workspaceId);
  const [share, setShare] = useState(false);
  const [settings, setSettings] = useState(false);
  const index = useMemo(() => buildIndex(tree.data?.nodes ?? []), [tree.data]);

  if (tree.isPending) return <PageSkeleton />;
  if (tree.isError || !tree.data) {
    return (
      <EmptyState
        icon={<BookOpen />}
        title={t('page.errorTitle')}
        description={errorText(tree.error)}
        action={
          <Button variant="secondary" onClick={() => tree.refetch()}>
            {t('common.retry')}
          </Button>
        }
      />
    );
  }

  const { space } = tree.data;
  const writable = can.edit(space.access.role);
  const roots = [...(index.children.get(null) ?? []), ...index.detached];

  const create = (kind: 'page' | 'folder') =>
    m.createNode.mutate(
      {
        spaceId: space.id,
        body: { kind, title: t(kind === 'page' ? 'tree.untitledPage' : 'tree.untitledFolder') },
      },
      {
        onSuccess: (n) => navigate(`/docs/p/${n.id}`),
        onError: (e) => toast.error(errorText(e)),
      },
    );

  return (
    <motion.section
      key={space.id}
      variants={pageTransition}
      initial="hidden"
      animate="visible"
      className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-5 py-6 sm:px-8"
    >
      <header className="flex flex-wrap items-start gap-4">
        <SpaceTile icon={space.icon} color={space.color} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-semibold text-text">{space.name}</h1>
          {space.description && (
            <p className="mt-1 max-w-2xl text-base text-text-secondary">{space.description}</p>
          )}
          <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-text-muted">
            <VisibilityIcon visibility={space.access.visibility} />
            {t(`visibility.${space.visibility}.name`)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setShare(true)}>
            <Share2 />
            {t('menu.share')}
          </Button>
          {can.manage(space.access.role) && (
            <Button variant="secondary" onClick={() => setSettings(true)}>
              <Settings2 />
              {t('space.settings')}
            </Button>
          )}
        </div>
      </header>

      {roots.length === 0 ? (
        <EmptyState
          icon={<FilePlus2 />}
          title={t('space.emptyTitle')}
          description={writable ? t('space.emptyDescription') : t('space.emptyReadOnly')}
          className="rounded-2xl border border-dashed border-border py-16"
          action={
            writable && (
              <div className="flex gap-2">
                <Button onClick={() => create('page')} loading={m.createNode.isPending}>
                  <FilePlus2 />
                  {t('tree.newPage')}
                </Button>
                <Button variant="secondary" onClick={() => create('folder')}>
                  <FolderPlus />
                  {t('tree.newFolder')}
                </Button>
              </div>
            )
          }
        />
      ) : (
        <FolderBody children={roots} />
      )}

      <ShareDialog
        open={share}
        onOpenChange={setShare}
        workspaceId={workspaceId}
        target={{ spaceId: space.id }}
        title={space.name}
      />
      <SpaceDialog
        open={settings}
        onOpenChange={setSettings}
        workspaceId={workspaceId}
        space={space}
        onDeleted={() => navigate('/docs')}
      />
    </motion.section>
  );
}

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  defaultDropAnimationSideEffects,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
  type DropAnimation,
} from '@dnd-kit/core';
import { motion } from 'framer-motion';
import { Download, FilePlus2, FolderPlus, LayoutTemplate, Settings2, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useSession } from '@/features/auth';
import { isApiError, startDownload, wikiExportUrl } from '@/shared/api';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { dragLift, ease, transition } from '@/shared/motion';
import {
  Button,
  ConfirmDialog,
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  DropdownTrigger,
  IconButton,
  Tooltip,
  toast,
} from '@/shared/ui';
import type { WikiSpace } from '../api/wikiApi';
import { useTree, useWikiMutations, type MoveVars } from '../hooks/useWiki';
import { can } from '../model/permissions';
import { useWikiUiStore } from '../store/wikiUiStore';
import {
  ancestors,
  buildIndex,
  checkPlacement,
  placementFor,
  type DropPosition,
  type Placement,
  type WikiNode,
} from '../model/tree';
import { DropContext, SPACE_DROP_PREFIX, type DropState } from './dropContext';
import { NodeIcon } from './NodeIcon';
import { NodeTree, type NodeActions } from './NodeTree';
import { QuickSections } from './QuickSections';
import { ShareDialog } from './ShareDialog';
import { SpaceDialog } from './SpaceDialog';
import { SpaceStrip } from './SpaceStrip';
import { TreeSkeleton } from './Skeletons';
import { TemplateDialog } from './TemplateDialog';

interface Props {
  workspaceId: string;
  spaces: readonly WikiSpace[];
  spaceId?: string;
  selectedId?: string;
  /** Called after a navigation-worthy action (mobile closes the panel). */
  onNavigate?: () => void;
}

/** Same settle as the Kanban board: eased, with the origin fading back in. */
const dropAnimation: DropAnimation = {
  duration: 260,
  easing: `cubic-bezier(${ease.join(',')})`,
  sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }),
};

const HOVER_EXPAND_MS = 700;
const EMPTY_SET: ReadonlySet<string> = new Set();

/** zone of the target row the pointer is in: top and bottom quarters order, the middle nests. */
function zoneOf(y: number, top: number, height: number): DropPosition {
  const rel = (y - top) / height;
  return rel < 0.25 ? 'before' : rel > 0.75 ? 'after' : 'inside';
}

export function TreePanel({ workspaceId, spaces, spaceId, selectedId, onNavigate }: Props) {
  const { t, i18n } = useTranslation('wiki');
  const errorText = useErrorText();
  const navigate = useNavigate();
  const { user } = useSession();
  const userId = user?.id ?? 'anonymous';
  const tree = useTree(spaceId);
  const m = useWikiMutations(workspaceId);

  const nodes = tree.data?.nodes;
  const index = useMemo(() => buildIndex(nodes ?? []), [nodes]);
  const space = tree.data?.space;
  const spaceRole = space?.access.role;

  // --- expanded state, per user and space
  const stored = useWikiUiStore((s) => (spaceId ? s.expanded[userId]?.[spaceId] : undefined));
  const setStoredExpanded = useWikiUiStore((s) => s.setExpanded);
  const expanded = useMemo(() => (stored ? new Set(stored) : EMPTY_SET), [stored]);
  const setExpanded = useCallback(
    (ids: Iterable<string>) => spaceId && setStoredExpanded(userId, spaceId, [...ids]),
    [spaceId, userId, setStoredExpanded],
  );
  const toggle = useCallback(
    (id: string, open?: boolean) => {
      const next = new Set(expanded);
      const want = open ?? !next.has(id);
      if (want) next.add(id);
      else next.delete(id);
      setExpanded(next);
    },
    [expanded, setExpanded],
  );

  // The open page's ancestors are expanded so it is visible in the tree.
  useEffect(() => {
    if (!selectedId || !nodes) return;
    const missing = ancestors(index, selectedId).filter((a) => !expanded.has(a.id));
    if (missing.length) setExpanded([...expanded, ...missing.map((a) => a.id)]);
    // only when the selection or the loaded tree changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, nodes]);

  // --- dialogs and transient state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [shareTarget, setShareTarget] = useState<{ node?: WikiNode } | null>(null);
  const [deleting, setDeleting] = useState<WikiNode | null>(null);
  const [spaceDialog, setSpaceDialog] = useState<'create' | 'edit' | null>(null);
  const [widen, setWiden] = useState<{ vars: MoveVars; destination: string } | null>(null);
  const [live, setLive] = useState('');
  const [templateOpen, setTemplateOpen] = useState(false);

  const placeOf = useCallback(
    (placement: Placement, toSpaceId?: string) => {
      if (toSpaceId && toSpaceId !== spaceId)
        return spaces.find((s) => s.id === toSpaceId)?.name ?? '';
      return placement.parentId
        ? (index.byId.get(placement.parentId)?.title ?? '')
        : (space?.name ?? '');
    },
    [index, space?.name, spaceId, spaces],
  );

  const move = useCallback(
    (node: WikiNode, placement: Placement, toSpaceId?: string, confirmWiden = false) => {
      if (!spaceId) return;
      const vars: MoveVars = {
        id: node.id,
        spaceId,
        placement,
        toSpaceId: toSpaceId && toSpaceId !== spaceId ? toSpaceId : undefined,
        confirmWiden,
      };
      m.moveNode.mutate(vars, {
        onSuccess: () => {
          setWiden(null);
          setLive(t('dnd.moved', { title: node.title, place: placeOf(placement, toSpaceId) }));
          if (placement.parentId) toggle(placement.parentId, true);
        },
        onError: (e) => {
          if (isApiError(e) && e.code === 'wiki.confirm_widening') {
            setWiden({ vars, destination: String(e.meta.destination ?? '') });
          } else {
            toast.error(errorText(e));
          }
        },
      });
    },
    [m.moveNode, spaceId, t, placeOf, toggle, errorText],
  );

  // --- node actions shared by the tree rows
  const create = useCallback(
    (parent: WikiNode | null, kind: 'page' | 'folder') => {
      if (!spaceId) return;
      m.createNode.mutate(
        {
          spaceId,
          body: {
            kind,
            parentId: parent?.id ?? null,
            title: t(kind === 'page' ? 'tree.untitledPage' : 'tree.untitledFolder'),
          },
        },
        {
          onSuccess: (node) => {
            if (parent) toggle(parent.id, true);
            setRenamingId(node.id);
            if (kind === 'page') navigate(`/docs/p/${node.id}`);
          },
          onError: (e) => toast.error(errorText(e)),
        },
      );
    },
    [spaceId, m.createNode, t, toggle, navigate, errorText],
  );

  const createFromTemplate = (templateId: string, name: string) => {
    if (!spaceId) return;
    m.createNode.mutate(
      {
        spaceId,
        body: { kind: 'page', title: name, templateId, lang: i18n.language === 'uk' ? 'uk' : 'en' },
      },
      {
        onSuccess: (node) => {
          setTemplateOpen(false);
          navigate(`/docs/p/${node.id}`);
          onNavigate?.();
        },
        onError: (e) => toast.error(errorText(e)),
      },
    );
  };

  const actions: NodeActions = {
    onOpen: (node) => {
      navigate(`/docs/p/${node.id}`);
      onNavigate?.();
    },
    onCreate: create,
    onRename: (node, title) =>
      m.updateNode.mutate(
        { id: node.id, patch: { title } },
        { onError: (e) => toast.error(errorText(e)) },
      ),
    onDelete: setDeleting,
    onShare: (node) => setShareTarget({ node }),
    onFavorite: (node) =>
      m.favorite.mutate(
        { id: node.id, on: !node.favorite },
        { onError: (e) => toast.error(errorText(e)) },
      ),
    onCopyLink: async (node) => {
      try {
        await navigator.clipboard.writeText(`${window.location.origin}/docs/p/${node.id}`);
        toast.success(t('share.linkCopied'));
      } catch {
        toast.error(t('share.linkCopyFailed'));
      }
    },
    onExport: (node, format) =>
      startDownload(
        wikiExportUrl(
          {
            node: node.id,
            subtree: node.kind === 'folder' || nodes?.some((n) => n.parentId === node.id),
          },
          format,
        ),
      ),
    onKeyboardMove: (node, placement, action) => {
      const check = space ? checkPlacement(index, node, placement, space.maxDepth) : { ok: false };
      if (!check.ok) {
        setLive(t('dnd.cannotMove'));
        return;
      }
      move(node, placement);
      setLive(t(`dnd.keyboard.${action}`, { title: node.title }));
    },
  };

  // --- drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );
  const [dragged, setDragged] = useState<WikiNode | null>(null);
  const [drop, setDrop] = useState<DropState | null>(null);
  const targetRef = useRef<{ placement: Placement; toSpaceId?: string } | null>(null);

  const onDragStart = (e: DragStartEvent) =>
    setDragged((e.active.data.current?.node as WikiNode) ?? null);

  const onDragMove = (e: DragMoveEvent) => {
    const node = e.active.data.current?.node as WikiNode | undefined;
    const over = e.over;
    if (!node || !over || !space) {
      targetRef.current = null;
      setDrop((d) => (d ? null : d));
      return;
    }
    const overId = String(over.id);
    let next: DropState;
    if (overId.startsWith(SPACE_DROP_PREFIX)) {
      const toSpaceId = overId.slice(SPACE_DROP_PREFIX.length);
      const placement: Placement = { parentId: null };
      const same = toSpaceId === space.id;
      const valid = same ? checkPlacement(index, node, placement, space.maxDepth).ok : true;
      targetRef.current = valid ? { placement, toSpaceId } : null;
      next = { overId, position: 'inside', valid };
    } else {
      const target = over.data.current?.node as WikiNode | undefined;
      const pointer = e.activatorEvent as PointerEvent | TouchEvent;
      const clientY =
        'clientY' in pointer ? pointer.clientY : (pointer.touches[0]?.clientY ?? over.rect.top);
      const position = target
        ? zoneOf(clientY + e.delta.y, over.rect.top, over.rect.height)
        : 'inside';
      if (!target || target.detached) {
        targetRef.current = null;
        next = { overId, position, valid: false };
      } else {
        const placement = placementFor(index, target, position);
        const valid = checkPlacement(index, node, placement, space.maxDepth).ok;
        targetRef.current = valid ? { placement } : null;
        next = { overId, position, valid };
      }
    }
    setDrop((d) =>
      d && d.overId === next.overId && d.position === next.position && d.valid === next.valid
        ? d
        : next,
    );
  };

  const endDrag = () => {
    setDragged(null);
    setDrop(null);
    targetRef.current = null;
  };

  const onDragEnd = (e: DragEndEvent) => {
    const node = e.active.data.current?.node as WikiNode | undefined;
    const target = targetRef.current;
    endDrag();
    if (node && target) move(node, target.placement, target.toSpaceId);
  };

  // Hovering a collapsed folder for a moment opens it, so deep drops are possible.
  useEffect(() => {
    if (!drop || drop.position !== 'inside' || !drop.valid) return;
    const row = index.children.get(drop.overId);
    if (!row?.length || expanded.has(drop.overId)) return;
    const timer = window.setTimeout(() => toggle(drop.overId, true), HOVER_EXPAND_MS);
    return () => window.clearTimeout(timer);
  }, [drop, index, expanded, toggle]);

  const canWrite = can.edit(spaceRole);
  const deleteNode = () => {
    if (!deleting) return;
    const node = deleting;
    m.deleteNode.mutate(node.id, {
      onSuccess: () => {
        setDeleting(null);
        toast.success(t('tree.deleted', { title: node.title }));
        if (
          selectedId === node.id ||
          (selectedId &&
            index.byId.has(selectedId) &&
            ancestors(index, selectedId).some((a) => a.id === node.id))
        )
          navigate(spaceId ? `/docs/s/${spaceId}` : '/docs');
      },
      onError: (e) => toast.error(errorText(e)),
    });
  };

  const stripSpaces = useMemo(
    () => (space && !spaces.some((s) => s.id === space.id) ? [...spaces, space] : spaces),
    [spaces, space],
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onDragCancel={endDrag}
    >
      <DropContext.Provider value={drop}>
        <div className="flex h-full min-h-0 flex-col">
          <SpaceStrip
            spaces={stripSpaces}
            activeId={spaceId}
            canCreate
            onCreate={() => setSpaceDialog('create')}
          />
          <QuickSections workspaceId={workspaceId} selectedId={selectedId} />

          {space && (
            <div className="flex items-center gap-1 px-3 pb-1 pt-2">
              <h2 className="min-w-0 flex-1 truncate text-xs font-medium uppercase tracking-wide text-text-muted">
                {space.name}
              </h2>
              {canWrite && (
                <>
                  <Tooltip content={t('tree.newPage')}>
                    <IconButton
                      label={t('tree.newPage')}
                      variant="ghost"
                      size="sm"
                      onClick={() => create(null, 'page')}
                    >
                      <FilePlus2 />
                    </IconButton>
                  </Tooltip>
                  <Tooltip content={t('templates.fromTemplate')}>
                    <IconButton
                      label={t('templates.fromTemplate')}
                      variant="ghost"
                      size="sm"
                      onClick={() => setTemplateOpen(true)}
                    >
                      <LayoutTemplate />
                    </IconButton>
                  </Tooltip>
                  <Tooltip content={t('tree.newFolder')}>
                    <IconButton
                      label={t('tree.newFolder')}
                      variant="ghost"
                      size="sm"
                      onClick={() => create(null, 'folder')}
                    >
                      <FolderPlus />
                    </IconButton>
                  </Tooltip>
                </>
              )}
              {spaceId && (
                <Dropdown>
                  <Tooltip content={t('space.export')}>
                    <DropdownTrigger asChild>
                      <IconButton label={t('space.export')} variant="ghost" size="sm">
                        <Download />
                      </IconButton>
                    </DropdownTrigger>
                  </Tooltip>
                  <DropdownContent align="end" className="min-w-56">
                    <DropdownLabel>{t('space.exportAll')}</DropdownLabel>
                    <DropdownItem
                      onSelect={() => startDownload(wikiExportUrl({ space: spaceId }, 'md'))}
                    >
                      {t('space.exportMarkdown')}
                    </DropdownItem>
                    <DropdownItem
                      onSelect={() => startDownload(wikiExportUrl({ space: spaceId }, 'html'))}
                    >
                      {t('space.exportHtml')}
                    </DropdownItem>
                  </DropdownContent>
                </Dropdown>
              )}
              {can.manage(spaceRole) && (
                <Tooltip content={t('space.settings')}>
                  <IconButton
                    label={t('space.settings')}
                    variant="ghost"
                    size="sm"
                    onClick={() => setSpaceDialog('edit')}
                  >
                    <Settings2 />
                  </IconButton>
                </Tooltip>
              )}
            </div>
          )}

          <div className="flex min-h-0 flex-1 flex-col px-2">
            {!spaceId ? null : tree.isPending ? (
              <TreeSkeleton />
            ) : tree.isError ? (
              <div className="flex flex-col items-start gap-3 p-3" role="alert">
                <p className="text-sm text-text-secondary">{errorText(tree.error)}</p>
                <Button variant="secondary" size="sm" onClick={() => tree.refetch()}>
                  {t('common.retry')}
                </Button>
              </div>
            ) : (
              <NodeTree
                index={index}
                expanded={expanded}
                onToggle={toggle}
                selectedId={selectedId}
                renamingId={renamingId}
                onRenamingChange={setRenamingId}
                label={t('tree.label', { space: space?.name ?? '' })}
                {...actions}
              />
            )}
          </div>

          <div className="border-t border-border-subtle p-2">
            <Link
              to="/docs/trash"
              onClick={onNavigate}
              className="flex h-9 items-center gap-2 rounded-lg px-2.5 text-base text-text-secondary transition-colors duration-micro hover:bg-surface-muted hover:text-text focus-visible:shadow-focus focus-visible:outline-none"
            >
              <Trash2 className="size-4 stroke-[1.6] text-text-muted" aria-hidden />
              {t('trash.link')}
            </Link>
          </div>
        </div>
      </DropContext.Provider>

      {/* The lifted chip: same spring, tilt and shadow as a dragged Kanban card. */}
      <DragOverlay dropAnimation={dropAnimation}>
        {dragged ? (
          <motion.div
            initial={{ scale: 1, rotate: 0 }}
            animate={{ scale: dragLift.scale, rotate: dragLift.rotate }}
            transition={transition.spring}
            className="flex h-9 max-w-64 cursor-grabbing items-center gap-2 rounded-lg border border-border-subtle bg-surface px-3 text-md text-text shadow-drag"
          >
            <NodeIcon node={dragged} />
            <span className="truncate">{dragged.title}</span>
          </motion.div>
        ) : null}
      </DragOverlay>

      <div role="status" aria-live="polite" className="sr-only">
        {live}
      </div>

      {shareTarget && space && (
        <ShareDialog
          open
          onOpenChange={(o) => !o && setShareTarget(null)}
          workspaceId={workspaceId}
          target={shareTarget.node ? { nodeId: shareTarget.node.id } : { spaceId: space.id }}
          title={shareTarget.node?.title ?? space.name}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t('tree.deleteTitle', { title: deleting?.title ?? '' })}
        description={t('tree.deleteDescription')}
        confirmLabel={t('menu.delete')}
        loading={m.deleteNode.isPending}
        onConfirm={deleteNode}
      />

      <ConfirmDialog
        open={!!widen}
        onOpenChange={(o) => !o && setWiden(null)}
        danger={false}
        title={t('dnd.widenTitle')}
        description={t('dnd.widenDescription', { destination: widen?.destination ?? '' })}
        confirmLabel={t('dnd.widenConfirm')}
        loading={m.moveNode.isPending}
        onConfirm={() => {
          if (!widen) return;
          const node = index.byId.get(widen.vars.id);
          if (node) move(node, widen.vars.placement, widen.vars.toSpaceId, true);
        }}
      />

      <TemplateDialog
        open={templateOpen}
        onOpenChange={setTemplateOpen}
        workspaceId={workspaceId}
        busy={m.createNode.isPending}
        onPick={createFromTemplate}
      />

      <SpaceDialog
        open={spaceDialog !== null}
        onOpenChange={(o) => !o && setSpaceDialog(null)}
        workspaceId={workspaceId}
        space={spaceDialog === 'edit' ? space : undefined}
        onSaved={(s) => spaceDialog === 'create' && navigate(`/docs/s/${s.id}`)}
        onDeleted={() => navigate('/docs')}
      />
    </DndContext>
  );
}

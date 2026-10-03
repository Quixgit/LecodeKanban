import { useDraggable, useDroppable } from '@dnd-kit/core';
import { useVirtualizer } from '@tanstack/react-virtual';
import { motion } from 'framer-motion';
import {
  ChevronRight,
  Copy,
  FilePlus2,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Plus,
  Share2,
  Star,
  Trash2,
} from 'lucide-react';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/cn';
import { itemPresence, transition } from '@/shared/motion';
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  DropdownTrigger,
  IconButton,
} from '@/shared/ui';
import { can } from '../model/permissions';
import {
  flatten,
  keyboardPlacement,
  type Placement,
  type Row,
  type TreeIndex,
  type WikiNode,
} from '../model/tree';
import { useDropState } from './dropContext';
import { NodeIcon } from './NodeIcon';
import { VisibilityIcon } from './VisibilityIcon';

export const ROW_HEIGHT = 32;
const INDENT = 16;

export interface NodeActions {
  onOpen: (node: WikiNode) => void;
  onCreate: (parent: WikiNode | null, kind: 'page' | 'folder') => void;
  onRename: (node: WikiNode, title: string) => void;
  onDelete: (node: WikiNode) => void;
  onShare: (node: WikiNode) => void;
  onFavorite: (node: WikiNode) => void;
  onCopyLink: (node: WikiNode) => void;
  onKeyboardMove: (node: WikiNode, placement: Placement, action: string) => void;
}

interface Props extends NodeActions {
  index: TreeIndex;
  expanded: ReadonlySet<string>;
  onToggle: (id: string, open?: boolean) => void;
  selectedId?: string;
  renamingId: string | null;
  onRenamingChange: (id: string | null) => void;
  label: string;
}

const rowDomId = (id: string) => `wn-${id}`;

/**
 * Virtualised ARIA tree. Focus stays on the container (aria-activedescendant), so rows can scroll
 * out of the DOM without losing the keyboard position.
 */
export function NodeTree({
  index,
  expanded,
  onToggle,
  selectedId,
  renamingId,
  onRenamingChange,
  label,
  ...actions
}: Props) {
  const { t } = useTranslation('wiki');
  const rows = useMemo(() => flatten(index, expanded), [index, expanded]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState<string | undefined>(selectedId);
  const [menuId, setMenuId] = useState<string | null>(null);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
    getItemKey: (i) => rows[i]?.node.id ?? i,
  });

  // Rows that were not in the previous list (new pages, an expanded folder's children) slide in like
  // Kanban cards; rows merely scrolled into the virtual window do not.
  const seen = useRef<Set<string>>(new Set());
  const fresh = seen.current.size > 0 ? seen.current : null;
  useEffect(() => {
    seen.current = new Set(rows.map((r) => r.node.id));
  }, [rows]);

  const activeIdx = rows.findIndex((r) => r.node.id === activeId);
  const effective = activeIdx >= 0 ? activeIdx : 0;
  const active = rows[effective];

  // Follow the route: the open page becomes the active row and scrolls into view.
  useEffect(() => {
    if (!selectedId) return;
    setActiveId(selectedId);
    const i = rows.findIndex((r) => r.node.id === selectedId);
    if (i >= 0) virtualizer.scrollToIndex(i, { align: 'auto' });
    // rows deliberately omitted: only re-run when the selection changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const go = useCallback(
    (i: number) => {
      const row = rows[Math.max(0, Math.min(rows.length - 1, i))];
      if (!row) return;
      setActiveId(row.node.id);
      virtualizer.scrollToIndex(rows.indexOf(row), { align: 'auto' });
    },
    [rows, virtualizer],
  );

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!active || renamingId) return;
    const node = active.node;
    const editable = can.edit(node.access.role);
    if (e.altKey && !e.ctrlKey && !e.metaKey) {
      const action = (
        { ArrowUp: 'up', ArrowDown: 'down', ArrowRight: 'indent', ArrowLeft: 'outdent' } as const
      )[e.key as 'ArrowUp'];
      if (action) {
        e.preventDefault();
        const placement =
          editable && !node.detached ? keyboardPlacement(index, node, action) : null;
        if (placement) actions.onKeyboardMove(node, placement, action);
        return;
      }
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        go(effective + 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        go(effective - 1);
        break;
      case 'Home':
        e.preventDefault();
        go(0);
        break;
      case 'End':
        e.preventDefault();
        go(rows.length - 1);
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (active.hasChildren && !active.expanded) onToggle(node.id, true);
        else if (active.expanded) go(effective + 1);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (active.expanded) onToggle(node.id, false);
        else if (node.parentId && !node.detached) {
          const parent = rows.findIndex((r) => r.node.id === node.parentId);
          if (parent >= 0) go(parent);
        }
        break;
      case 'Enter':
        e.preventDefault();
        actions.onOpen(node);
        break;
      case 'F2':
        if (editable) {
          e.preventDefault();
          onRenamingChange(node.id);
        }
        break;
      case 'Delete':
        if (editable) {
          e.preventDefault();
          actions.onDelete(node);
        }
        break;
      case 'ContextMenu':
        e.preventDefault();
        setMenuId(node.id);
        break;
      case 'F10':
        if (e.shiftKey) {
          e.preventDefault();
          setMenuId(node.id);
        }
        break;
    }
  };

  const finishRename = useCallback(
    (node: WikiNode, title: string | null) => {
      onRenamingChange(null);
      const next = title?.trim();
      if (next && next !== node.title) actions.onRename(node, next);
      requestAnimationFrame(() => scrollRef.current?.focus());
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onRenamingChange, actions.onRename],
  );

  return (
    <div
      ref={scrollRef}
      role="tree"
      aria-label={label}
      aria-multiselectable={false}
      tabIndex={0}
      aria-activedescendant={active ? rowDomId(active.node.id) : undefined}
      onKeyDown={onKeyDown}
      onFocus={() => !activeId && active && setActiveId(active.node.id)}
      className="group/tree relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden rounded-lg outline-none focus-visible:!shadow-none"
    >
      {rows.length === 0 ? (
        <p className="px-3 py-4 text-sm text-text-muted">{t('tree.empty')}</p>
      ) : (
        <div style={{ height: virtualizer.getTotalSize() }} className="relative w-full">
          {virtualizer.getVirtualItems().map((v) => {
            const row = rows[v.index]!;
            return (
              <TreeRow
                key={row.node.id}
                row={row}
                top={v.start}
                active={row.node.id === active?.node.id}
                selected={row.node.id === selectedId}
                enter={!!fresh && !fresh.has(row.node.id)}
                renaming={renamingId === row.node.id}
                menuOpen={menuId === row.node.id}
                onMenuChange={(open) => setMenuId(open ? row.node.id : null)}
                onToggle={onToggle}
                onActivate={setActiveId}
                onFinishRename={finishRename}
                onStartRename={onRenamingChange}
                {...actions}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

interface RowProps extends NodeActions {
  row: Row;
  top: number;
  active: boolean;
  selected: boolean;
  /** Slide in on mount (the row is new, not just scrolled into view). */
  enter: boolean;
  renaming: boolean;
  menuOpen: boolean;
  onMenuChange: (open: boolean) => void;
  onToggle: (id: string, open?: boolean) => void;
  onActivate: (id: string) => void;
  onFinishRename: (node: WikiNode, title: string | null) => void;
  onStartRename: (id: string | null) => void;
}

const TreeRow = memo(function TreeRow({
  row,
  top,
  active,
  selected,
  enter,
  renaming,
  menuOpen,
  onMenuChange,
  onToggle,
  onActivate,
  onFinishRename,
  onStartRename,
  onOpen,
  onCreate,
  onDelete,
  onShare,
  onFavorite,
  onCopyLink,
}: RowProps) {
  const { t } = useTranslation('wiki');
  const { node } = row;
  const editable = can.edit(node.access.role);
  const dragging = editable && !node.detached && !renaming;
  const drag = useDraggable({ id: node.id, data: { node }, disabled: !dragging });
  const drop = useDroppable({ id: node.id, data: { node } });
  const dropState = useDropState();
  const hovered = dropState?.overId === node.id ? dropState : null;
  const setRefs = (el: HTMLElement | null) => {
    drag.setNodeRef(el);
    drop.setNodeRef(el);
  };

  const onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    onActivate(node.id);
    onMenuChange(true);
  };

  return (
    <div
      ref={setRefs}
      id={rowDomId(node.id)}
      role="treeitem"
      aria-level={row.level}
      aria-setsize={row.setSize}
      aria-posinset={row.posInSet}
      aria-expanded={row.hasChildren ? row.expanded : undefined}
      aria-selected={selected}
      onContextMenu={onContextMenu}
      {...drag.listeners}
      // A row is exactly one virtual line; the visuals animate inside it.
      style={{ height: ROW_HEIGHT, transform: `translateY(${top}px)` }}
      className="group absolute left-0 top-0 w-full"
      onClick={() => {
        onActivate(node.id);
        onOpen(node);
      }}
    >
      <motion.div
        variants={itemPresence}
        initial={enter ? 'hidden' : false}
        animate="visible"
        style={{ paddingLeft: 6 + (row.level - 1) * INDENT }}
        className={cn(
          'relative flex h-full w-full items-center gap-1 rounded-lg pr-1.5 text-md transition-colors duration-micro',
          selected
            ? 'bg-primary-subtle font-medium text-primary-ink'
            : 'text-text-secondary hover:bg-surface-muted hover:text-text',
          active && 'group-focus-visible/tree:shadow-focus',
          drag.isDragging && 'opacity-40',
          hovered?.position === 'inside' &&
            (hovered.valid ? 'bg-primary-soft ring-1 ring-primary' : 'cursor-not-allowed'),
        )}
      >
        {hovered && hovered.position !== 'inside' && hovered.valid && (
          <motion.span
            aria-hidden
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={transition.micro}
            className={cn(
              'pointer-events-none absolute right-1 h-0.5 origin-left rounded-full bg-primary',
              hovered.position === 'before' ? '-top-px' : '-bottom-px',
            )}
            style={{ left: 6 + (row.level - 1) * INDENT + 20 }}
          />
        )}
        <button
          type="button"
          tabIndex={-1}
          aria-hidden={!row.hasChildren}
          aria-label={
            row.expanded
              ? t('tree.collapse', { title: node.title })
              : t('tree.expand', { title: node.title })
          }
          onClick={(e) => {
            e.stopPropagation();
            if (row.hasChildren) onToggle(node.id);
          }}
          className={cn(
            'flex size-5 shrink-0 items-center justify-center rounded-md text-text-muted transition-colors duration-micro hover:bg-surface-sunken',
            !row.hasChildren && 'invisible',
          )}
        >
          <motion.span
            initial={false}
            animate={{ rotate: row.expanded ? 90 : 0 }}
            transition={{ duration: 0.14 }}
            className="flex"
          >
            <ChevronRight className="size-3.5 stroke-[1.75]" aria-hidden />
          </motion.span>
        </button>
        <NodeIcon node={node} />
        {renaming ? (
          <RenameInput
            initial={node.title}
            label={t('tree.renameLabel')}
            onDone={(title) => onFinishRename(node, title)}
          />
        ) : (
          <span className="min-w-0 flex-1 truncate">{node.title}</span>
        )}
        {!renaming && (
          <>
            {node.favorite && (
              <Star
                className="size-3.5 shrink-0 fill-current stroke-[1.6] text-progress"
                aria-label={t('tree.favorite')}
              />
            )}
            {node.access.visibility !== 'workspace' && (
              <VisibilityIcon
                visibility={node.access.visibility}
                className="shrink-0 text-text-faint"
              />
            )}
            <span
              className={cn(
                // Overlaid, not in the flow, so titles keep the full row width until hovered.
                'absolute right-1 top-1/2 flex -translate-y-1/2 items-center rounded-md pl-1 opacity-0 transition-opacity duration-micro group-hover:opacity-100',
                selected ? 'bg-primary-subtle' : 'bg-surface-muted',
                active && 'group-focus-visible/tree:opacity-100',
                menuOpen && 'opacity-100',
              )}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {editable && (
                <IconButton
                  label={t('tree.newChild', { title: node.title })}
                  variant="ghost"
                  size="sm"
                  tabIndex={-1}
                  className="!size-6"
                  onClick={() => onCreate(node, 'page')}
                >
                  <Plus />
                </IconButton>
              )}
              <Dropdown open={menuOpen} onOpenChange={onMenuChange}>
                <DropdownTrigger asChild>
                  <IconButton
                    label={t('tree.menu', { title: node.title })}
                    variant="ghost"
                    size="sm"
                    tabIndex={-1}
                    className="!size-6"
                  >
                    <MoreHorizontal />
                  </IconButton>
                </DropdownTrigger>
                <DropdownContent align="start" onCloseAutoFocus={(e) => e.preventDefault()}>
                  {editable && (
                    <DropdownItem onSelect={() => onStartRename(node.id)}>
                      <Pencil />
                      {t('menu.rename')}
                    </DropdownItem>
                  )}
                  {editable && (
                    <DropdownItem onSelect={() => onCreate(node, 'page')}>
                      <FilePlus2 />
                      {t('menu.newPage')}
                    </DropdownItem>
                  )}
                  {editable && (
                    <DropdownItem onSelect={() => onCreate(node, 'folder')}>
                      <FolderPlus />
                      {t('menu.newFolder')}
                    </DropdownItem>
                  )}
                  <DropdownItem onSelect={() => onFavorite(node)}>
                    <Star />
                    {node.favorite ? t('menu.unfavorite') : t('menu.favorite')}
                  </DropdownItem>
                  <DropdownItem onSelect={() => onShare(node)}>
                    <Share2 />
                    {t('menu.share')}
                  </DropdownItem>
                  <DropdownItem onSelect={() => onCopyLink(node)}>
                    <Copy />
                    {t('menu.copyLink')}
                  </DropdownItem>
                  {editable && <DropdownSeparator />}
                  {editable && (
                    <DropdownItem danger onSelect={() => onDelete(node)}>
                      <Trash2 />
                      {t('menu.delete')}
                    </DropdownItem>
                  )}
                </DropdownContent>
              </Dropdown>
            </span>
          </>
        )}
      </motion.div>
    </div>
  );
});

function RenameInput({
  initial,
  label,
  onDone,
}: {
  initial: string;
  label: string;
  onDone: (title: string | null) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const finish = (title: string | null) => {
    if (done.current) return;
    done.current = true;
    onDone(title);
  };
  return (
    <input
      ref={ref}
      defaultValue={initial}
      aria-label={label}
      maxLength={200}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') finish(e.currentTarget.value);
        else if (e.key === 'Escape') finish(null);
      }}
      onBlur={(e) => finish(e.currentTarget.value)}
      className="h-6 min-w-0 flex-1 rounded-md border border-primary bg-surface px-1.5 text-md text-text shadow-focus outline-none"
    />
  );
}

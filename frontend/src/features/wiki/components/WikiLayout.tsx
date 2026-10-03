import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { BookOpen, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Outlet, useMatch } from 'react-router-dom';
import { useSession } from '@/features/auth';
import { useCurrentWorkspace } from '@/features/workspaces';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import { transition } from '@/shared/motion';
import { EmptyState, IconButton, Tooltip } from '@/shared/ui';
import { useNode, useSpaces } from '../hooks/useWiki';
import {
  PANEL_DEFAULT,
  PANEL_MAX,
  PANEL_MIN,
  clampWidth,
  useWikiUiStore,
} from '../store/wikiUiStore';
import { TreePanel } from './TreePanel';
import type { WikiSpace } from '../api/wikiApi';

export interface WikiOutletContext {
  workspaceId: string;
  spaces: readonly WikiSpace[];
  spaceId?: string;
}

const STEP = 16;

/** Docs shell: resizable, collapsible tree panel on the left, the open page on the right. */
export function WikiLayout() {
  const { t } = useTranslation('wiki');
  const { workspace, isLoading } = useCurrentWorkspace();
  const ws = workspace?.id;
  const spaces = useSpaces(ws);
  const { user } = useSession();
  const userId = user?.id ?? 'anonymous';
  const desktop = useMediaQuery('(min-width: 1024px)');

  const spaceMatch = useMatch('/docs/s/:spaceId');
  const pageMatch = useMatch('/docs/p/:nodeId');
  const trashMatch = useMatch('/docs/trash');
  const selectedId = pageMatch?.params.nodeId;
  const node = useNode(selectedId);
  const lastSpace = useWikiUiStore((s) => s.lastSpace[userId]);
  const setLastSpace = useWikiUiStore((s) => s.setLastSpace);
  const list = spaces.data ?? [];
  const fallback = list.find((s) => s.id === lastSpace)?.id ?? list[0]?.id;
  // While a page loads its space is unknown for a moment; keep showing the last one so the tree
  // (and any inline rename in it) doesn't unmount between two pages.
  const lastResolved = useRef<string>();
  const resolved = spaceMatch?.params.spaceId ?? node.data?.spaceId;
  if (resolved) lastResolved.current = resolved;
  const spaceId = resolved ?? (selectedId ? lastResolved.current : fallback);

  useEffect(() => {
    if (spaceId) setLastSpace(userId, spaceId);
  }, [spaceId, userId, setLastSpace]);

  const width = useWikiUiStore((s) => s.panelWidth);
  const collapsed = useWikiUiStore((s) => s.panelCollapsed);
  const setWidth = useWikiUiStore((s) => s.setPanelWidth);
  const setCollapsed = useWikiUiStore((s) => s.setPanelCollapsed);
  const [resizing, setResizing] = useState(false);
  const start = useRef({ x: 0, w: 0 });

  if (isLoading || !workspace) return <div className="min-h-[24rem]" aria-busy />;

  const context: WikiOutletContext = { workspaceId: workspace.id, spaces: list, spaceId };
  // Below lg the panel and the page take turns: the tree at /docs and /docs/s/…, the page otherwise.
  const showPanel = desktop ? !collapsed : !selectedId && !trashMatch;
  const showMain = desktop || !showPanel;

  const onPointerDown = (e: PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, w: width };
    setResizing(true);
  };
  const onPointerMove = (e: PointerEvent) => {
    if (resizing) setWidth(start.current.w + e.clientX - start.current.x);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    const step = e.shiftKey ? STEP * 3 : STEP;
    if (e.key === 'ArrowLeft') setWidth(width - step);
    else if (e.key === 'ArrowRight') setWidth(width + step);
    else if (e.key === 'Home') setWidth(PANEL_MIN);
    else if (e.key === 'End') setWidth(PANEL_MAX);
    else if (e.key === 'Enter') setWidth(PANEL_DEFAULT);
    else return;
    e.preventDefault();
  };

  return (
    <div className="flex h-[calc(100dvh-var(--header-h)-3rem)] min-h-[30rem] overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-sm">
      {desktop ? (
        <motion.aside
          initial={false}
          animate={{ width: collapsed ? 0 : width }}
          transition={resizing ? { duration: 0 } : transition.large}
          aria-label={t('panel.label')}
          aria-hidden={collapsed}
          // React 18 has no typed `inert`: keeps a collapsed panel out of tab order and AT.
          {...({ inert: collapsed ? '' : undefined } as object)}
          className="shrink-0 overflow-hidden border-r border-border-subtle bg-surface"
        >
          <div style={{ width }} className="h-full">
            <PanelHeader onCollapse={() => setCollapsed(true)} />
            <div className="h-[calc(100%-2.75rem)]">
              <TreePanel
                workspaceId={workspace.id}
                spaces={list}
                spaceId={spaceId}
                selectedId={selectedId}
              />
            </div>
          </div>
        </motion.aside>
      ) : (
        showPanel && (
          <aside aria-label={t('panel.label')} className="flex w-full min-w-0 flex-col bg-surface">
            <PanelHeader />
            <div className="min-h-0 flex-1">
              <TreePanel
                workspaceId={workspace.id}
                spaces={list}
                spaceId={spaceId}
                selectedId={selectedId}
              />
            </div>
          </aside>
        )
      )}

      {desktop && !collapsed && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={t('panel.resize')}
          aria-valuemin={PANEL_MIN}
          aria-valuemax={PANEL_MAX}
          aria-valuenow={clampWidth(width)}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => setResizing(false)}
          onPointerCancel={() => setResizing(false)}
          onKeyDown={onKeyDown}
          onDoubleClick={() => setWidth(PANEL_DEFAULT)}
          className="group relative -ml-px w-1.5 shrink-0 cursor-col-resize outline-none"
        >
          <span
            className={`absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 rounded-full transition-colors duration-micro group-hover:bg-primary group-focus-visible:bg-primary ${resizing ? 'bg-primary' : 'bg-transparent'}`}
          />
        </div>
      )}

      {desktop && collapsed && (
        <div className="flex w-12 shrink-0 flex-col items-center border-r border-border-subtle py-3">
          <Tooltip content={t('panel.expand')} side="right">
            <IconButton
              label={t('panel.expand')}
              variant="ghost"
              size="sm"
              onClick={() => setCollapsed(false)}
            >
              <PanelLeftOpen />
            </IconButton>
          </Tooltip>
        </div>
      )}

      {showMain && (
        <div className="min-w-0 flex-1 overflow-y-auto">
          {!desktop && (
            <Link
              to="/docs"
              className="m-3 inline-flex h-8 items-center gap-2 rounded-lg px-2.5 text-sm text-text-secondary hover:bg-surface-muted focus-visible:shadow-focus focus-visible:outline-none"
            >
              <PanelLeftOpen className="size-4" aria-hidden />
              {t('panel.pages')}
            </Link>
          )}
          <Outlet context={context} />
        </div>
      )}
    </div>
  );
}

function PanelHeader({ onCollapse }: { onCollapse?: () => void }) {
  const { t } = useTranslation('wiki');
  return (
    <div className="flex h-11 items-center gap-2 px-3">
      <BookOpen className="size-4 stroke-[1.6] text-primary-ink" aria-hidden />
      <span className="flex-1 text-md font-semibold text-text">{t('panel.title')}</span>
      {onCollapse && (
        <Tooltip content={t('panel.collapse')}>
          <IconButton label={t('panel.collapse')} variant="ghost" size="sm" onClick={onCollapse}>
            <PanelLeftClose />
          </IconButton>
        </Tooltip>
      )}
    </div>
  );
}

export function NoSpaces({ action }: { action?: ReactNode }) {
  const { t } = useTranslation('wiki');
  return (
    <EmptyState
      icon={<BookOpen />}
      title={t('empty.noSpacesTitle')}
      description={t('empty.noSpacesDescription')}
      action={action}
    />
  );
}

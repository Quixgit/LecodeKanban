import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useCardCounts } from '@/features/cards';
import { useCurrentWorkspace } from '@/features/workspaces';
import { cn } from '@/shared/lib/cn';
import { scaleIn, transition } from '@/shared/motion';
import { statusTone, toneClasses, type TaskStatus } from '@/shared/ui';
import type { NavItem } from '../navigation';

const ACTIVE_LAYOUT_ID = 'sidebar-active-item';
const CLOSE_DELAY_MS = 120;

/**
 * Collapsed-rail entry for a group: a square icon button (same slot and highlight as every other
 * item) that opens its sub-items as a flyout on hover or focus. Enter/Space/ArrowRight open it,
 * Esc closes and returns focus to the button.
 */
export function CollapsedFlyout({ item, label }: { item: NavItem; label: string }) {
  const { t } = useTranslation('nav');
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { workspace } = useCurrentWorkspace();
  const counts = useCardCounts(workspace?.id, {}).data;
  const [open, setOpen] = useState(false);
  const [top, setTop] = useState(0);
  const [left, setLeft] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number>();
  const menuId = useId();
  const Icon = item.icon;
  const active = pathname.startsWith(item.to);

  const show = useCallback(() => {
    window.clearTimeout(closeTimer.current);
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      setTop(rect.top);
      setLeft(rect.right + 8);
    }
    setOpen(true);
  }, []);
  const hideSoon = useCallback(() => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  }, []);
  const close = useCallback((restoreFocus: boolean) => {
    window.clearTimeout(closeTimer.current);
    setOpen(false);
    if (restoreFocus) buttonRef.current?.focus();
  }, []);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close(true);
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, close]);

  const focusItem = (delta: 1 | -1 | 0 | 'last') => {
    const links = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('a') ?? []);
    if (!links.length) return;
    const i = links.indexOf(document.activeElement as HTMLElement);
    const next =
      delta === 0
        ? 0
        : delta === 'last'
          ? links.length - 1
          : (i + delta + links.length) % links.length;
    links[next]?.focus();
  };

  return (
    <div className="relative" onMouseEnter={show} onMouseLeave={hideSoon}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        onClick={() => navigate(item.to)}
        onFocus={show}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault();
            show();
            requestAnimationFrame(() => focusItem(0));
          }
        }}
        className={cn(
          'relative grid h-11 w-full place-items-center rounded-lg outline-none transition-colors duration-micro focus-visible:shadow-focus',
          active
            ? 'font-medium text-primary-ink'
            : 'text-text-secondary hover:bg-surface-muted hover:text-text',
        )}
      >
        {active && (
          <motion.span
            layoutId={ACTIVE_LAYOUT_ID}
            transition={transition.spring}
            aria-hidden
            className="absolute inset-0 rounded-lg border border-primary-border bg-primary-subtle"
          />
        )}
        <span className="relative grid size-5 place-items-center">
          <Icon className="size-5 stroke-[1.6]" aria-hidden />
        </span>
      </button>
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={panelRef}
              id={menuId}
              role="menu"
              aria-label={label}
              variants={scaleIn}
              initial="hidden"
              animate="visible"
              exit="exit"
              style={{ top, left }}
              onMouseEnter={show}
              onMouseLeave={hideSoon}
              onBlur={(e) => {
                if (
                  !e.currentTarget.contains(e.relatedTarget) &&
                  e.relatedTarget !== buttonRef.current
                )
                  hideSoon();
              }}
              onKeyDown={(e) => {
                const move: Record<string, () => void> = {
                  ArrowDown: () => focusItem(1),
                  ArrowUp: () => focusItem(-1),
                  Home: () => focusItem(0),
                  End: () => focusItem('last'),
                  ArrowLeft: () => close(true),
                };
                const handler = move[e.key];
                if (handler) {
                  e.preventDefault();
                  handler();
                }
              }}
              className="fixed z-50 min-w-48 origin-left rounded-xl border border-border bg-surface p-1.5 shadow-lg"
            >
              <p className="px-2.5 pb-1 pt-1 text-xs font-medium uppercase tracking-wide text-text-muted">
                {label}
              </p>
              {item.children?.map((child) => {
                const status = child.key as TaskStatus;
                const count = counts?.[status];
                return (
                  <NavLink
                    key={child.key}
                    to={child.to}
                    role="menuitem"
                    className={({ isActive }) =>
                      cn(
                        'flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-md outline-none transition-colors duration-micro focus-visible:shadow-focus',
                        isActive
                          ? 'bg-primary-subtle font-medium text-primary-ink'
                          : 'text-text-secondary hover:bg-surface-muted hover:text-text',
                      )
                    }
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'size-2 shrink-0 rounded-full',
                        toneClasses[statusTone[status]].fill,
                      )}
                    />
                    <span className="flex-1 truncate">{t(`tasks.${child.key}`)}</span>
                    {count !== undefined && (
                      <span className="tabular rounded-full bg-surface-sunken px-1.5 text-xs text-text-muted">
                        {count}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}

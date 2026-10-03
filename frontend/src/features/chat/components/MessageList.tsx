import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown } from 'lucide-react';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fade, transition } from '@/shared/motion';
import { Skeleton } from '@/shared/ui';
import type { ChatMessage } from '../api/chatApi';
import { buildFeed, dayLabel } from '../model/group';
import { MessageItem, type MessageActions } from './MessageItem';

const NEAR_BOTTOM = 96;
const NEAR_TOP = 120;

interface Props {
  /** Identifies the conversation; switching it scrolls to the newest message. */
  scopeKey: string;
  messages: readonly ChatMessage[];
  loading: boolean;
  hasOlder: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
  actions: MessageActions;
  me: string;
  canModerate: boolean;
  readOnly?: boolean;
  highlightId?: string;
  /** Shown when there is nothing yet. */
  empty: React.ReactNode;
}

/** Scrolling feed: sticks to the bottom for new messages, loads history when you reach the top. */
export function MessageList({
  scopeKey,
  messages,
  loading,
  hasOlder,
  loadingOlder,
  onLoadOlder,
  actions,
  me,
  canModerate,
  readOnly,
  highlightId,
  empty,
}: Props) {
  const { t, i18n } = useTranslation('chat');
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const prev = useRef({ scope: '', first: '', last: '', height: 0 });
  const [unseen, setUnseen] = useState(0);
  const feed = useMemo(() => buildFeed(messages), [messages]);
  const now = new Date();

  const toBottom = useCallback((smooth: boolean) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    setUnseen(0);
  }, []);

  useLayoutEffect(() => {
    const el = scroller.current;
    const first = messages[0]?.id ?? '';
    const last = messages[messages.length - 1]?.id ?? '';
    const p = prev.current;
    if (!el || (loading && messages.length === 0)) return;
    if (p.scope !== scopeKey) {
      stick.current = true;
      toBottom(false);
    } else if (first !== p.first && last === p.last && p.first) {
      el.scrollTop += el.scrollHeight - p.height; // history was prepended: keep the view still
    } else if (last !== p.last) {
      const own = messages[messages.length - 1]?.author?.id === me;
      if (stick.current || own) toBottom(true);
      else setUnseen((n) => n + 1);
    }
    prev.current = { scope: scopeKey, first, last, height: el.scrollHeight };
  }, [messages, scopeKey, loading, me, toBottom]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM;
    if (stick.current && unseen) setUnseen(0);
    if (el.scrollTop < NEAR_TOP && hasOlder && !loadingOlder) onLoadOlder();
  };

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scroller}
        onScroll={onScroll}
        role="log"
        aria-label={t('list.label')}
        aria-live="polite"
        aria-relevant="additions"
        tabIndex={0}
        className="h-full overflow-y-auto overscroll-contain pb-3 pt-4 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
      >
        {loading && messages.length === 0 ? (
          <FeedSkeleton />
        ) : messages.length === 0 ? (
          empty
        ) : (
          <>
            {loadingOlder && (
              <div className="px-5 py-2" aria-busy>
                <Skeleton className="h-9 w-2/3" />
              </div>
            )}
            {!hasOlder && (
              <p className="px-5 pb-2 text-center text-xs text-text-muted">{t('list.start')}</p>
            )}
            <ul>
              {feed.map((item) =>
                item.type === 'day' ? (
                  <li key={item.key} className="sticky top-0 z-[5] my-2 flex justify-center">
                    <span className="rounded-full border border-border bg-surface px-3 py-0.5 text-xs font-medium text-text-secondary shadow-xs">
                      {dayLabel(
                        item.date,
                        now,
                        i18n.language,
                        t('list.today'),
                        t('list.yesterday'),
                      )}
                    </span>
                  </li>
                ) : (
                  <MessageItem
                    key={item.key}
                    message={item.message}
                    compact={item.compact}
                    me={me}
                    canModerate={canModerate}
                    readOnly={readOnly}
                    highlighted={item.message.id === highlightId}
                    actions={actions}
                  />
                ),
              )}
            </ul>
          </>
        )}
      </div>
      <AnimatePresence>
        {unseen > 0 && (
          <motion.button
            type="button"
            variants={fade}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0, transition: transition.ui }}
            exit="exit"
            onClick={() => toBottom(true)}
            className="absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-primary-solid px-3.5 py-1.5 text-xs font-medium text-on-primary shadow-primary outline-none hover:bg-primary-solid-hover focus-visible:shadow-focus"
          >
            <ArrowDown className="size-3.5" aria-hidden />
            {t('list.newMessages', { count: unseen })}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="space-y-5 px-5" aria-busy>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3.5" style={{ width: `${55 + ((i * 17) % 35)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

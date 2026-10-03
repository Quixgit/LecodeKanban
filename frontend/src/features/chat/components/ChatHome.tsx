import { useEffect } from 'react';
import { Navigate, useOutletContext } from 'react-router-dom';
import { useChatUiStore } from '../store/chatUiStore';
import { groupChannels } from '../model/channels';
import { NoChannels, type ChatOutletContext } from './ChatLayout';

/** /chat: reopen the last conversation, else #general (or the first channel), else invite to create one. */
export function ChatHome() {
  const ctx = useOutletContext<ChatOutletContext>();
  const last = useChatUiStore((s) => s.lastChannel[ctx.me]);
  const setLast = useChatUiStore((s) => s.setLastChannel);

  const g = groupChannels(ctx.channels);
  const visible = ctx.channels.filter((c) => c.joined || c.kind === 'public');
  const target =
    visible.find((c) => c.id === last) ??
    g.channels.find((c) => c.name === 'general') ??
    g.channels[0] ??
    g.direct[0] ??
    g.browsable[0];

  // A stored channel that no longer exists should not be retried.
  useEffect(() => {
    if (last && !ctx.channelsLoading && !visible.some((c) => c.id === last)) setLast(ctx.me, '');
  }, [last, ctx.channelsLoading, ctx.me, visible, setLast]);

  if (ctx.channelsLoading) return <div className="min-h-[24rem]" aria-busy />;
  if (target) return <Navigate to={`/chat/${target.id}`} replace />;
  return (
    <NoChannels onCreate={ctx.openCreate} onBrowse={ctx.openBrowse} canCreate={ctx.canWrite} />
  );
}

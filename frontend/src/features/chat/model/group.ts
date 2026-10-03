import type { ChatMessage } from '../api/chatApi';

/** Follow-up messages from one author within this window collapse under the first. */
export const GROUP_WINDOW_MS = 5 * 60 * 1000;

export type FeedItem =
  | { type: 'day'; key: string; date: Date }
  | { type: 'message'; key: string; message: ChatMessage; compact: boolean };

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** Interleaves day dividers and marks which messages continue the previous author's run. */
export function buildFeed(messages: readonly ChatMessage[]): FeedItem[] {
  const out: FeedItem[] = [];
  let prev: ChatMessage | null = null;
  let prevDay = '';
  for (const message of messages) {
    const at = new Date(message.createdAt);
    const day = dayKey(at);
    if (day !== prevDay) {
      out.push({ type: 'day', key: `day-${day}`, date: at });
      prevDay = day;
      prev = null;
    }
    const compact =
      !!prev &&
      !!message.author &&
      prev.author?.id === message.author.id &&
      !prev.deleted &&
      !message.deleted &&
      at.getTime() - new Date(prev.createdAt).getTime() < GROUP_WINDOW_MS;
    out.push({ type: 'message', key: message.id, message, compact });
    prev = message;
  }
  return out;
}

/** "Today", "Yesterday" or a weekday and date, in the UI language. */
export function dayLabel(date: Date, now: Date, locale: string, today: string, yesterday: string) {
  const diff = Math.round(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() -
      new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()) /
      86_400_000,
  );
  if (diff === 0) return today;
  if (diff === 1) return yesterday;
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  }).format(date);
}

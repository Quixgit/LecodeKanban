import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useTypingStore } from '../store/typingStore';

interface Person {
  id: string;
  name: string;
}

/** "Anna is typing…" above the composer, with three bouncing dots. */
export function TypingIndicator({
  channelId,
  people,
}: {
  channelId: string;
  people: readonly Person[];
}) {
  const { t } = useTranslation('chat');
  const typing = useTypingStore((s) => s.typing[channelId]);
  const names = people.filter((p) => typing?.[p.id]).map((p) => p.name.split(' ')[0] ?? p.name);
  const text =
    names.length === 0
      ? ''
      : names.length === 1
        ? t('typing.one', { name: names[0] })
        : names.length === 2
          ? t('typing.two', { a: names[0], b: names[1] })
          : t('typing.many');
  return (
    <div className="h-5 px-5 text-xs text-text-muted" role="status" aria-live="polite">
      {text && (
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex gap-0.5" aria-hidden>
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="size-1 rounded-full bg-text-muted"
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
              />
            ))}
          </span>
          {text}
        </span>
      )}
    </div>
  );
}

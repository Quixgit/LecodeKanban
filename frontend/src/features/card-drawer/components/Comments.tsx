import { AnimatePresence, motion } from 'framer-motion';
import { MessageSquare, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Member } from '@/shared/api';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { useLanguage } from '@/shared/i18n';
import { formatRelative } from '@/shared/lib/format';
import { fadeUp } from '@/shared/motion';
import { Avatar, Button, IconButton, Markdown, Skeleton, toast } from '@/shared/ui';
import type { Comment } from '../api/drawerApi';
import { useComments } from '../hooks/useDrawerData';
import { MentionTextarea } from './MentionTextarea';

interface Props {
  cardId: string;
  workspaceId: string;
  members: Member[];
  currentUserId: string;
  canComment: boolean;
  isAdmin: boolean;
}

/** Discussion on a card, oldest first; Ctrl/⌘+Enter posts, "@" mentions teammates. */
export function Comments({
  cardId,
  workspaceId,
  members,
  currentUserId,
  canComment,
  isAdmin,
}: Props) {
  const { t } = useTranslation('card');
  const { language } = useLanguage();
  const errorText = useErrorText();
  const { list, add, edit, remove } = useComments(cardId, workspaceId);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  const fail = (e: unknown) => toast.error(errorText(e));

  const post = () => {
    if (!draft.trim()) return;
    add.mutate(draft, { onSuccess: () => setDraft(''), onError: fail });
  };
  const saveEdit = () => {
    if (!editing?.body.trim()) return;
    edit.mutate(editing, { onSuccess: () => setEditing(null), onError: fail });
  };

  const own = (c: Comment) => c.author?.id === currentUserId;
  return (
    <div className="flex flex-col gap-4">
      {list.isPending ? (
        <Skeleton className="h-16 rounded-lg" />
      ) : (list.data ?? []).length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-text-muted">
          <MessageSquare className="size-4" aria-hidden />
          {t('comments.empty')}
        </p>
      ) : (
        <ol className="flex flex-col gap-4">
          <AnimatePresence initial={false}>
            {(list.data ?? []).map((c) => (
              <motion.li
                key={c.id}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="group/comment flex gap-3"
              >
                <Avatar size="sm" name={c.author?.name ?? '?'} src={c.author?.avatarUrl} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium text-text">
                      {c.author?.name ?? t('someone')}
                    </span>
                    <time
                      dateTime={c.createdAt}
                      className="text-xs text-text-muted"
                      title={new Date(c.createdAt).toLocaleString(language)}
                    >
                      {formatRelative(c.createdAt, language)}
                    </time>
                    {c.editedAt && (
                      <span className="text-xs text-text-faint">{t('comments.edited')}</span>
                    )}
                    <div className="ml-auto flex opacity-0 transition-opacity focus-within:opacity-100 group-hover/comment:opacity-100">
                      {own(c) && canComment && (
                        <IconButton
                          variant="ghost"
                          size="sm"
                          label={t('comments.edit')}
                          onClick={() => setEditing({ id: c.id, body: c.body })}
                        >
                          <Pencil />
                        </IconButton>
                      )}
                      {(own(c) || isAdmin) && canComment && (
                        <IconButton
                          variant="ghost"
                          size="sm"
                          label={t('comments.delete')}
                          onClick={() => remove.mutate(c.id, { onError: fail })}
                        >
                          <Trash2 />
                        </IconButton>
                      )}
                    </div>
                  </div>
                  {editing?.id === c.id ? (
                    <div className="mt-1 flex flex-col gap-2">
                      <MentionTextarea
                        autoFocus
                        value={editing.body}
                        onChange={(body) => setEditing({ id: c.id, body })}
                        members={members}
                        label={t('comments.edit')}
                        placeholder={t('comments.placeholder')}
                        onSubmit={saveEdit}
                        onCancel={() => setEditing(null)}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" loading={edit.isPending} onClick={saveEdit}>
                          {t('save')}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                          {t('cancel')}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-0.5 rounded-lg bg-surface-muted/60 px-3 py-2">
                      <Markdown source={c.body} />
                    </div>
                  )}
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      )}
      {canComment && (
        <div className="flex flex-col gap-2">
          <MentionTextarea
            value={draft}
            onChange={setDraft}
            members={members}
            label={t('comments.new')}
            placeholder={t('comments.placeholder')}
            onSubmit={post}
          />
          <div className="flex items-center gap-2">
            <Button size="sm" loading={add.isPending} disabled={!draft.trim()} onClick={post}>
              {t('comments.post')}
            </Button>
            <span className="text-2xs text-text-faint">{t('comments.hint')}</span>
          </div>
        </div>
      )}
    </div>
  );
}

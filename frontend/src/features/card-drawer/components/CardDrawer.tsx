import {
  CheckSquare,
  Clock,
  FileText,
  Link2,
  ListTree,
  Paperclip,
  SearchX,
  Trash2,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useCard } from '@/features/cards';
import { TimeTracker } from '@/features/time-tracking';
import { useCurrentWorkspace, useWorkspaceMembers } from '@/features/workspaces';
import {
  ConfirmDialog,
  Drawer,
  EmptyState,
  IconButton,
  SegmentedControl,
  Skeleton,
  toast,
} from '@/shared/ui';
import { useCardEditor } from '../hooks/useCardEditor';
import { ActivityFeed } from './ActivityFeed';
import { Attachments } from './Attachments';
import { CardFields } from './CardFields';
import { Checklist } from './Checklist';
import { Comments } from './Comments';
import { DescriptionEditor } from './DescriptionEditor';
import { Subtasks } from './Subtasks';
import { TitleEditor } from './TitleEditor';

function Section({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-text [&_svg]:size-4 [&_svg]:text-text-muted">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

type Tab = 'comments' | 'activity';

/** Slide-in card detail, opened from any view through ?card=<id> (shareable links). */
export function CardDrawer({ currentUserId }: { currentUserId: string }) {
  const { t } = useTranslation(['card', 'time']);
  const [params, setParams] = useSearchParams();
  const id = params.get('card') ?? undefined;
  const { workspace } = useCurrentWorkspace();
  const ws = workspace?.id ?? '';
  const members = useWorkspaceMembers(workspace?.id).data ?? [];
  const query = useCard(id);
  const card = query.data;
  const editor = useCardEditor(card, ws);
  const [tab, setTab] = useState<Tab>('comments');
  const [confirm, setConfirm] = useState(false);
  const editable = !!workspace && workspace.role !== 'viewer';
  const isAdmin = workspace?.role === 'owner' || workspace?.role === 'admin';

  const open = (cardId: string) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('card', cardId);
      return next;
    });
  const close = () =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('card');
        return next;
      },
      { replace: true },
    );

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success(t('linkCopied'));
    } catch {
      toast.error(t('linkFailed'));
    }
  };

  return (
    <>
      <Drawer
        open={!!id}
        onOpenChange={(o) => !o && close()}
        width="xl"
        title={card ? card.key : t('loading')}
        description={card ? card.project.name : undefined}
        actions={
          card && (
            <>
              <IconButton
                variant="ghost"
                size="sm"
                label={t('copyLink')}
                onClick={() => void copyLink()}
              >
                <Link2 />
              </IconButton>
              {editable && (
                <IconButton
                  variant="ghost"
                  size="sm"
                  label={t('delete')}
                  onClick={() => setConfirm(true)}
                >
                  <Trash2 />
                </IconButton>
              )}
            </>
          )
        }
      >
        {query.isPending ? (
          <div className="flex flex-col gap-4" aria-busy>
            <Skeleton className="h-8 w-3/4 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-40 rounded-lg" />
          </div>
        ) : !card ? (
          <EmptyState icon={<SearchX />} title={t('notFound')} description={t('notFoundHint')} />
        ) : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_15rem]">
            <div className="flex min-w-0 flex-col gap-7">
              {card.parent && (
                <button
                  type="button"
                  onClick={() => open(card.parent!.id)}
                  className="-mb-4 flex w-fit items-center gap-1.5 text-sm text-text-secondary hover:text-text"
                >
                  <ListTree className="size-4" aria-hidden />
                  <span className="tabular">{card.parent.key}</span>
                  <span className="max-w-[24rem] truncate">{card.parent.title}</span>
                </button>
              )}
              <TitleEditor
                value={card.title}
                editable={editable}
                onSave={(title) => editor.update.mutate({ title })}
              />
              <Section icon={<FileText />} title={t('description.title')}>
                <DescriptionEditor
                  value={card.description}
                  editable={editable}
                  saving={editor.update.isPending}
                  onSave={(description) => editor.update.mutateAsync({ description })}
                />
              </Section>
              {!card.parent && (
                <Section icon={<ListTree />} title={t('subtasks.title')}>
                  <Subtasks card={card} workspaceId={ws} editable={editable} />
                </Section>
              )}
              <Section icon={<CheckSquare />} title={t('checklist.title')}>
                <Checklist cardId={card.id} workspaceId={ws} editable={editable} />
              </Section>
              <Section icon={<Clock />} title={t('time:title')}>
                <TimeTracker
                  cardId={card.id}
                  editable={editable}
                  currentUserId={currentUserId}
                  isAdmin={isAdmin}
                />
              </Section>
              <Section icon={<Paperclip />} title={t('attachments.title')}>
                <Attachments
                  cardId={card.id}
                  workspaceId={ws}
                  editable={editable}
                  canDelete={(a) => editable && (isAdmin || a.uploadedBy?.id === currentUserId)}
                />
              </Section>
              <section className="flex flex-col gap-4">
                <SegmentedControl<Tab>
                  label={t('tabs.label')}
                  value={tab}
                  onChange={setTab}
                  className="w-fit"
                  options={[
                    { value: 'comments', label: t('tabs.comments', { count: card.commentCount }) },
                    { value: 'activity', label: t('tabs.activity') },
                  ]}
                />
                {tab === 'comments' ? (
                  <Comments
                    cardId={card.id}
                    workspaceId={ws}
                    members={members}
                    currentUserId={currentUserId}
                    canComment={editable}
                    isAdmin={isAdmin}
                  />
                ) : (
                  <ActivityFeed cardId={card.id} workspaceId={ws} members={members} />
                )}
              </section>
            </div>
            <aside className="lg:border-l lg:border-border-subtle lg:pl-6">
              <CardFields
                card={card}
                workspaceId={ws}
                members={members}
                editable={editable}
                editor={editor}
              />
            </aside>
          </div>
        )}
      </Drawer>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        danger
        title={t('deleteTitle', { key: card?.key })}
        description={t('deleteBody')}
        confirmLabel={t('delete')}
        loading={editor.remove.isPending}
        onConfirm={() =>
          editor.remove.mutate(undefined, {
            onSuccess: () => {
              toast.info(t('deleted', { key: card?.key }));
              setConfirm(false);
              close();
            },
          })
        }
      />
    </>
  );
}

import { copyText } from '@/shared/lib/clipboard';
import {
  CheckSquare,
  FileText,
  Link2,
  ListTree,
  Maximize2,
  Minimize2,
  Paperclip,
  SearchX,
  Trash2,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useCard } from '@/features/cards';
import { GithubCardPanel } from '@/features/integrations';
import { useFeatureEnabled } from '@/features/settings';
import { TimeTracker } from '@/features/time-tracking';
import { can, useCurrentWorkspace, useWorkspaceMembers } from '@/features/workspaces';
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
import { useCardDrawerStore } from '../store/drawerStore';
import { ActivityFeed } from './ActivityFeed';
import { Attachments } from './Attachments';
import { CardFields } from './CardFields';
import { Checklist } from './Checklist';
import { CardChat } from '@/features/chat';
import { DescriptionEditor } from './DescriptionEditor';
import { Subtasks } from './Subtasks';
import { TitleEditor } from './TitleEditor';

function Section({
  icon,
  title,
  children,
  boxed = true,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  /** A soft frame around the block; the description stays open on the page. */
  boxed?: boolean;
}) {
  return (
    <section
      className={cn(
        'flex flex-col gap-3',
        boxed && 'rounded-xl border border-border-subtle bg-surface-muted/50 p-4',
      )}
    >
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
  const timeOn = useFeatureEnabled('time');
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
  const { expanded, setExpanded } = useCardDrawerStore();
  const editable = can(workspace, 'content.edit');
  const isAdmin = can(workspace, 'time.manage');

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
      if (!(await copyText(window.location.href))) throw new Error('copy failed');
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
        expanded={expanded}
        title={card ? card.key : t('loading')}
        description={card ? card.project.name : undefined}
        actions={
          card && (
            <>
              <IconButton
                variant="ghost"
                size="sm"
                label={expanded ? t('collapse') : t('expand')}
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? <Minimize2 /> : <Maximize2 />}
              </IconButton>
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
          <div
            className={cn(
              'mx-auto grid w-full grid-cols-1 gap-x-8 gap-y-7',
              expanded
                ? 'max-w-[110rem] lg:grid-cols-[minmax(0,1fr)_17rem] xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_17rem]'
                : 'lg:grid-cols-[minmax(0,1fr)_17rem]',
            )}
          >
            <div className="flex min-w-0 flex-col gap-6">
              {card.parent && (
                <button
                  type="button"
                  onClick={() => open(card.parent!.id)}
                  className="-mb-3 flex w-fit items-center gap-1.5 text-sm text-text-secondary hover:text-text"
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
              <Section boxed={false} icon={<FileText />} title={t('description.title')}>
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
              <GithubCardPanel cardId={card.id} />
              <Section icon={<Paperclip />} title={t('attachments.title')}>
                <Attachments
                  cardId={card.id}
                  workspaceId={ws}
                  editable={editable}
                  canDelete={(a) => editable && (isAdmin || a.uploadedBy?.id === currentUserId)}
                />
              </Section>
            </div>
            <section
              className={cn(
                'flex min-w-0 flex-col gap-4 lg:col-start-1',
                expanded &&
                  'xl:sticky xl:top-0 xl:col-start-2 xl:row-start-1 xl:h-[calc(100dvh-9rem)] xl:self-start',
              )}
            >
              <SegmentedControl<Tab>
                label={t('tabs.label')}
                value={tab}
                onChange={setTab}
                className="w-fit"
                options={[
                  { value: 'comments', label: t('tabs.comments') },
                  { value: 'activity', label: t('tabs.activity') },
                ]}
              />
              {tab === 'comments' ? (
                <div
                  className={cn(
                    'overflow-hidden rounded-xl border border-border-subtle',
                    expanded ? 'h-[32rem] xl:h-auto xl:min-h-0 xl:flex-1' : 'h-[28rem]',
                  )}
                >
                  <CardChat cardId={card.id} />
                </div>
              ) : (
                <div
                  className={cn(
                    expanded && 'xl:scroll-quiet xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-1',
                  )}
                >
                  <ActivityFeed cardId={card.id} workspaceId={ws} members={members} />
                </div>
              )}
            </section>
            <aside
              className={cn(
                'flex flex-col gap-6 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:border-l lg:border-border-subtle lg:pl-6',
                expanded && 'xl:col-start-3 xl:row-span-1',
              )}
            >
              {timeOn && (
                <TimeTracker
                  cardId={card.id}
                  editable={editable}
                  currentUserId={currentUserId}
                  isAdmin={isAdmin}
                />
              )}
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

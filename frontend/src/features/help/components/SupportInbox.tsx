import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  Bug,
  ChevronDown,
  ExternalLink,
  Inbox,
  Lightbulb,
  MessageCircleQuestion,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCurrentWorkspace } from '@/features/workspaces';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { useLanguage } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { formatRelative } from '@/shared/lib/format';
import { collapse } from '@/shared/motion/presets';
import {
  Avatar,
  Button,
  Card,
  CardHeader,
  CardTitle,
  EmptyState,
  Modal,
  SegmentedControl,
  toast,
} from '@/shared/ui';
import { screenshotUrl, type SupportRequest, type SupportStatus } from '../api/supportApi';
import { useSupportList, useSupportMutations } from '../hooks/useSupport';
import { StatusChip } from './StatusChip';

type Filter = 'all' | SupportStatus;
const KIND_ICON = { problem: Bug, idea: Lightbulb, question: MessageCircleQuestion } as const;
/** What a request can be moved to from where it is. */
const NEXT: Record<SupportStatus, SupportStatus[]> = {
  new: ['in_progress', 'resolved'],
  in_progress: ['resolved', 'new'],
  resolved: ['in_progress'],
};

function Row({ r }: { r: SupportRequest }) {
  const { t } = useTranslation('help');
  const { language } = useLanguage();
  const errorText = useErrorText();
  const reduce = useReducedMotion();
  const { workspace } = useCurrentWorkspace();
  const { setStatus } = useSupportMutations(workspace?.id ?? '');
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(false);
  const Icon = KIND_ICON[r.kind];
  return (
    <li className="rounded-xl border border-border-subtle bg-surface">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary/30"
      >
        <Icon className="size-4 shrink-0 text-text-muted" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-text">{r.subject}</span>
          <span className="flex items-center gap-1.5 text-xs text-text-muted">
            {r.author && <Avatar name={r.author.name} src={r.author.avatarUrl} size="xs" />}
            {r.author?.name ?? t('support.someone')} · {formatRelative(r.createdAt, language)}
          </span>
        </span>
        <StatusChip status={r.status} />
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-text-muted transition-transform',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            variants={reduce ? undefined : collapse}
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-3 border-t border-border-subtle px-4 py-3">
              <p className="whitespace-pre-wrap text-sm text-text">{r.message}</p>
              {r.hasScreenshot && (
                <button
                  type="button"
                  onClick={() => setZoom(true)}
                  className="w-fit overflow-hidden rounded-lg border border-border outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                >
                  <img
                    src={screenshotUrl(r.id)}
                    alt={t('support.screenshotOf', { subject: r.subject })}
                    className="max-h-40 object-cover"
                    loading="lazy"
                  />
                </button>
              )}
              {(r.pageUrl || r.userAgent) && (
                <dl className="grid gap-1 text-xs text-text-muted">
                  {r.pageUrl && (
                    <div className="flex gap-2">
                      <dt className="shrink-0 font-medium">{t('support.page')}</dt>
                      <dd className="min-w-0 truncate">{r.pageUrl}</dd>
                    </div>
                  )}
                  {r.userAgent && (
                    <div className="flex gap-2">
                      <dt className="shrink-0 font-medium">{t('support.browser')}</dt>
                      <dd className="min-w-0 truncate">{r.userAgent}</dd>
                    </div>
                  )}
                </dl>
              )}
              <div className="flex flex-wrap items-center gap-2">
                {NEXT[r.status].map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={s === 'resolved' ? 'primary' : 'secondary'}
                    loading={setStatus.isPending && setStatus.variables?.status === s}
                    onClick={() =>
                      setStatus.mutate(
                        { id: r.id, status: s },
                        { onError: (e) => toast.error(errorText(e)) },
                      )
                    }
                  >
                    {t(`support.action.${s}`)}
                  </Button>
                ))}
                {r.author && (
                  <span className="ml-auto flex items-center gap-1 text-xs text-text-muted">
                    <ExternalLink className="size-3" aria-hidden />
                    {t('support.replyByEmail')}
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {r.hasScreenshot && (
        <Modal open={zoom} onOpenChange={setZoom} size="lg" title={r.subject}>
          <img
            src={screenshotUrl(r.id)}
            alt={t('support.screenshotOf', { subject: r.subject })}
            className="w-full rounded-lg"
          />
        </Modal>
      )}
    </li>
  );
}

/** The inbox of whoever handles support: every request of the workspace, with its status. */
export function SupportInbox() {
  const { t } = useTranslation('help');
  const { workspace } = useCurrentWorkspace();
  const all = useSupportList(workspace?.id, 'all');
  const [filter, setFilter] = useState<Filter>('all');
  const list = useMemo(() => all.data ?? [], [all.data]);
  const counts = useMemo(
    () => ({
      new: list.filter((r) => r.status === 'new').length,
      in_progress: list.filter((r) => r.status === 'in_progress').length,
      resolved: list.filter((r) => r.status === 'resolved').length,
    }),
    [list],
  );
  const shown = filter === 'all' ? list : list.filter((r) => r.status === filter);
  return (
    <Card className="p-5" id="support-inbox">
      <CardHeader className="flex-wrap">
        <div>
          <CardTitle className="flex items-center gap-2">
            {t('inbox.title')}
            {counts.new > 0 && (
              <span className="tabular rounded-full bg-review-soft px-2 py-0.5 text-xs font-medium text-review-ink">
                {t('inbox.newCount', { count: counts.new })}
              </span>
            )}
          </CardTitle>
          <p className="text-sm text-text-muted">{t('inbox.subtitle')}</p>
        </div>
        <SegmentedControl<Filter>
          label={t('inbox.filter')}
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: t('inbox.all') },
            { value: 'new', label: `${t('support.status.new')} ${counts.new}` },
            {
              value: 'in_progress',
              label: `${t('support.status.in_progress')} ${counts.in_progress}`,
            },
            { value: 'resolved', label: t('support.status.resolved') },
          ]}
        />
      </CardHeader>
      {shown.length === 0 ? (
        <EmptyState className="py-8" icon={<Inbox />} title={t('inbox.empty')} />
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((r) => (
            <Row key={r.id} r={r} />
          ))}
        </ul>
      )}
    </Card>
  );
}

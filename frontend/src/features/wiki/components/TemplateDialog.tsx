import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { cn } from '@/shared/lib/cn';
import { Button, EmptyState, Modal, Skeleton } from '@/shared/ui';
import { useTemplates } from '../hooks/useWiki';
import { iconFor } from '../model/icons';
import { FileText } from 'lucide-react';

/** "New from template": built-in layouts (uk/en) and the workspace's own. */
export function TemplateDialog({
  open,
  onOpenChange,
  workspaceId,
  busy,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  busy?: boolean;
  /** Called with the chosen template id; the caller creates the page. */
  onPick: (templateId: string, name: string) => void;
}) {
  const { t, i18n } = useTranslation('wiki');
  const errorText = useErrorText();
  const lang = i18n.language === 'uk' ? 'uk' : 'en';
  const templates = useTemplates(workspaceId, lang, open);
  const [chosen, setChosen] = useState<string | null>(null);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={t('templates.title')}
      description={t('templates.description')}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            loading={busy}
            disabled={!chosen}
            onClick={() => {
              const tpl = templates.data?.find((x) => x.id === chosen);
              if (tpl) onPick(tpl.id, tpl.name);
            }}
          >
            {t('templates.use')}
          </Button>
        </>
      }
    >
      {templates.isPending ? (
        <div className="grid gap-2 sm:grid-cols-2" role="status" aria-busy>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : templates.isError ? (
        <EmptyState
          title={t('page.errorTitle')}
          description={errorText(templates.error)}
          action={
            <Button variant="secondary" onClick={() => templates.refetch()}>
              {t('common.retry')}
            </Button>
          }
        />
      ) : (
        <div
          role="radiogroup"
          aria-label={t('templates.title')}
          className="grid max-h-[26rem] gap-2 overflow-y-auto sm:grid-cols-2"
        >
          {templates.data.map((tpl) => {
            const Icon = iconFor(tpl.icon) ?? FileText;
            return (
              <button
                key={tpl.id}
                type="button"
                role="radio"
                aria-checked={chosen === tpl.id}
                onClick={() => setChosen(tpl.id)}
                onDoubleClick={() => onPick(tpl.id, tpl.name)}
                className={cn(
                  'flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors duration-micro focus-visible:shadow-focus focus-visible:outline-none',
                  chosen === tpl.id
                    ? 'border-primary-border bg-primary-subtle'
                    : 'border-border bg-surface hover:border-border-strong hover:bg-surface-muted',
                )}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-ink">
                  <Icon className="size-[18px] stroke-[1.6]" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-base font-medium text-text">{tpl.name}</span>
                  <span className="block text-sm text-text-muted">
                    {tpl.description || (tpl.builtin ? '' : t('templates.custom'))}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

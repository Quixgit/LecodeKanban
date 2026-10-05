import { Bug, ImagePlus, Lightbulb, MessageCircleQuestion, Send, X } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useCurrentWorkspace } from '@/features/workspaces';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { useLanguage } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { formatRelative } from '@/shared/lib/format';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  Checkbox,
  Field,
  Input,
  SegmentedControl,
  Textarea,
  toast,
} from '@/shared/ui';
import type { SupportKind } from '../api/supportApi';
import { useSupportList, useSupportMutations } from '../hooks/useSupport';
import { checkScreenshot, toBase64, type ScreenshotProblem } from '../model/screenshot';
import { StatusChip } from './StatusChip';

const KINDS = [
  { value: 'problem', icon: <Bug /> },
  { value: 'idea', icon: <Lightbulb /> },
  { value: 'question', icon: <MessageCircleQuestion /> },
] as const;

/** "Report a problem or suggest an idea": goes to the people who run the workspace, who are told by email. */
export function SupportCard() {
  const { t } = useTranslation('help');
  const { language } = useLanguage();
  const errorText = useErrorText();
  const { workspace } = useCurrentWorkspace();
  const { create } = useSupportMutations(workspace?.id ?? '');
  const mine = useSupportList(workspace?.id, 'mine');
  const input = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<SupportKind>('problem');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [attachPage, setAttachPage] = useState(true);
  const [shot, setShot] = useState<{ file: File; url: string } | null>(null);
  const [problem, setProblem] = useState<ScreenshotProblem | null>(null);
  const [errors, setErrors] = useState<{ subject?: boolean; message?: boolean }>({});

  const pick = (file: File | undefined) => {
    if (!file) return;
    const p = checkScreenshot(file);
    setProblem(p);
    if (p) return;
    if (shot) URL.revokeObjectURL(shot.url);
    setShot({ file, url: URL.createObjectURL(file) });
  };
  const clearShot = () => {
    if (shot) URL.revokeObjectURL(shot.url);
    setShot(null);
    if (input.current) input.current.value = '';
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const bad = { subject: !subject.trim(), message: !message.trim() };
    setErrors(bad);
    if (bad.subject || bad.message || !workspace) return;
    try {
      await create.mutateAsync({
        kind,
        subject: subject.trim(),
        message: message.trim(),
        pageUrl: attachPage ? window.location.href : undefined,
        userAgent: attachPage ? navigator.userAgent : undefined,
        screenshot: shot
          ? { contentType: shot.file.type as 'image/png', data: await toBase64(shot.file) }
          : undefined,
      });
      toast.success(t('support.sent'));
      setSubject('');
      setMessage('');
      clearShot();
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  const list = mine.data ?? [];
  return (
    <Card className="p-5" id="support">
      <CardHeader>
        <div>
          <CardTitle>{t('support.title')}</CardTitle>
          <p className="text-sm text-text-muted">{t('support.subtitle')}</p>
        </div>
      </CardHeader>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <SegmentedControl<SupportKind>
            label={t('support.kind.label')}
            value={kind}
            onChange={setKind}
            options={KINDS.map((k) => ({
              value: k.value,
              label: t(`support.kind.${k.value}`),
              icon: k.icon,
            }))}
          />
          <Field
            label={t('support.subject')}
            error={errors.subject ? t('support.required') : undefined}
          >
            <Input
              value={subject}
              maxLength={120}
              placeholder={t(`support.placeholder.${kind}`)}
              onChange={(e) => setSubject(e.target.value)}
            />
          </Field>
          <Field
            label={t('support.message')}
            error={errors.message ? t('support.required') : undefined}
            hint={t('support.messageHint')}
          >
            <Textarea
              rows={5}
              value={message}
              maxLength={5000}
              onChange={(e) => setMessage(e.target.value)}
            />
          </Field>
          <div className="flex flex-col gap-2">
            <input
              ref={input}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              aria-label={t('support.screenshot')}
              onChange={(e) => pick(e.target.files?.[0])}
            />
            {shot ? (
              <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-muted p-2">
                <img src={shot.url} alt="" className="h-14 w-20 rounded-md object-cover" />
                <span className="min-w-0 flex-1 truncate text-sm text-text">{shot.file.name}</span>
                <Button type="button" variant="ghost" size="sm" onClick={clearShot}>
                  <X />
                  {t('support.removeScreenshot')}
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="secondary"
                className="w-fit"
                onClick={() => input.current?.click()}
              >
                <ImagePlus />
                {t('support.screenshot')}
              </Button>
            )}
            {problem && (
              <p role="alert" className="text-xs text-danger-ink">
                {t(`support.screenshotProblem.${problem}`)}
              </p>
            )}
          </div>
          <label className="flex items-start gap-2.5 text-sm text-text-secondary">
            <Checkbox
              checked={attachPage}
              onCheckedChange={(v) => setAttachPage(v === true)}
              className="mt-0.5"
            />
            <span>
              {t('support.attachPage')}
              <span className="block text-xs text-text-muted">{t('support.attachPageHint')}</span>
            </span>
          </label>
          <Button type="submit" loading={create.isPending} className="w-fit">
            <Send />
            {t('support.send')}
          </Button>
        </form>

        <section aria-labelledby="support-mine">
          <h3 id="support-mine" className="mb-2 text-sm font-medium text-text">
            {t('support.mine')}
          </h3>
          {list.length === 0 ? (
            <p className="rounded-lg bg-surface-muted p-4 text-sm text-text-secondary">
              {t('support.noneYet')}
            </p>
          ) : (
            <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto">
              {list.map((r) => (
                <li key={r.id} className="rounded-lg border border-border-subtle p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn('min-w-0 text-sm font-medium text-text')}>{r.subject}</p>
                    <StatusChip status={r.status} />
                  </div>
                  <p className="mt-1 text-xs text-text-muted">
                    {t(`support.kind.${r.kind}`)} · {formatRelative(r.createdAt, language)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Card>
  );
}

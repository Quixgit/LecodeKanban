import { Check, Copy, Download, ShieldCheck, ShieldOff } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from '@/features/auth';
import { useErrorText } from '@/shared/hooks/useErrorText';
import {
  Button,
  Field,
  FormAlert,
  Input,
  Modal,
  PasswordInput,
  Pill,
  SettingsCard,
  Skeleton,
  toast,
} from '@/shared/ui';
import { useTwoFactor, useTwoFactorMutations } from '../hooks/useProfile';

type Step =
  | { kind: 'idle' }
  | { kind: 'scan'; secret: string; uri: string }
  | { kind: 'codes'; codes: string[] }
  | { kind: 'disable' }
  | { kind: 'regenerate' };

function Qr({ value, label }: { value: string; label: string }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let live = true;
    void QRCode.toDataURL(value, { margin: 1, width: 192 }).then((u) => live && setSrc(u));
    return () => {
      live = false;
    };
  }, [value]);
  // The code image stays black on white: scanners need the contrast whatever the theme.
  return src ? (
    <img
      src={src}
      alt={label}
      width={192}
      height={192}
      className="rounded-lg border border-border"
    />
  ) : (
    <Skeleton className="size-48 rounded-lg" />
  );
}

function ScanDialog({
  secret,
  uri,
  onDone,
  onClose,
}: {
  secret: string;
  uri: string;
  onDone: (codes: string[]) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation('profile');
  const errorText = useErrorText();
  const m = useTwoFactorMutations();
  const [code, setCode] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    m.enable.mutate(code.trim(), { onSuccess: (r) => onDone(r.codes) });
  };
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={t('twoFactor.setupTitle')}
      description={t('twoFactor.setupDescription')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('twoFactor.cancel')}
          </Button>
          <Button
            type="submit"
            form="two-factor-enable"
            loading={m.enable.isPending}
            disabled={code.trim().length < 6}
          >
            {t('twoFactor.turnOn')}
          </Button>
        </>
      }
    >
      <form id="two-factor-enable" onSubmit={submit} noValidate className="flex flex-col gap-4">
        <FormAlert>{m.enable.error ? errorText(m.enable.error) : null}</FormAlert>
        <div className="flex flex-wrap items-center gap-5">
          <Qr value={uri} label={t('twoFactor.qrAlt')} />
          <div className="min-w-0 flex-1 text-sm text-text-secondary">
            <p>{t('twoFactor.scan')}</p>
            <p className="mt-3 text-xs text-text-muted">{t('twoFactor.manual')}</p>
            <code className="mt-1 block select-all break-all rounded-md bg-surface-sunken px-2 py-1.5 font-mono text-xs text-text">
              {secret}
            </code>
          </div>
        </div>
        <Field label={t('twoFactor.code')}>
          <Input
            autoFocus
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123 456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </Field>
      </form>
    </Modal>
  );
}

function CodesDialog({ codes, onClose }: { codes: string[]; onClose: () => void }) {
  const { t } = useTranslation('profile');
  const [copied, setCopied] = useState(false);
  const text = codes.join('\n');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked: the codes are selectable.
    }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([text + '\n'], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lecodekanban-recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={t('twoFactor.codesTitle')}
      description={t('twoFactor.codesDescription')}
      footer={<Button onClick={onClose}>{t('twoFactor.savedThem')}</Button>}
    >
      <ul
        aria-label={t('twoFactor.codesTitle')}
        className="grid grid-cols-2 gap-2 rounded-lg bg-surface-muted p-4 font-mono text-sm text-text"
      >
        {codes.map((c) => (
          <li key={c} className="select-all">
            {c}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <Button variant="secondary" size="sm" onClick={() => void copy()}>
          {copied ? <Check /> : <Copy />}
          {copied ? t('twoFactor.copied') : t('twoFactor.copy')}
        </Button>
        <Button variant="secondary" size="sm" onClick={download}>
          <Download />
          {t('twoFactor.download')}
        </Button>
      </div>
    </Modal>
  );
}

/** Asks for the code (and the password when the account has one), then runs `act`. */
function ConfirmDialog({
  mode,
  hasPassword,
  onClose,
  onCodes,
}: {
  mode: 'disable' | 'regenerate';
  hasPassword: boolean;
  onClose: () => void;
  onCodes: (codes: string[]) => void;
}) {
  const { t } = useTranslation('profile');
  const errorText = useErrorText();
  const m = useTwoFactorMutations();
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const pending = mode === 'disable' ? m.disable.isPending : m.regenerate.isPending;
  const error = mode === 'disable' ? m.disable.error : m.regenerate.error;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (mode === 'disable') {
      m.disable.mutate(
        { code: code.trim(), password: hasPassword ? password : undefined },
        {
          onSuccess: () => {
            toast.success(t('twoFactor.turnedOff'));
            onClose();
          },
        },
      );
    } else {
      m.regenerate.mutate(code.trim(), { onSuccess: (r) => onCodes(r.codes) });
    }
  };
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={t(mode === 'disable' ? 'twoFactor.disableTitle' : 'twoFactor.regenerateTitle')}
      description={t(
        mode === 'disable' ? 'twoFactor.disableDescription' : 'twoFactor.regenerateDescription',
      )}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('twoFactor.cancel')}
          </Button>
          <Button
            type="submit"
            form="two-factor-confirm"
            variant={mode === 'disable' ? 'danger' : 'primary'}
            loading={pending}
            disabled={!code.trim() || (mode === 'disable' && hasPassword && !password)}
          >
            {t(mode === 'disable' ? 'twoFactor.turnOff' : 'twoFactor.regenerate')}
          </Button>
        </>
      }
    >
      <form id="two-factor-confirm" onSubmit={submit} noValidate className="flex flex-col gap-4">
        <FormAlert>{error ? errorText(error) : null}</FormAlert>
        {mode === 'disable' && hasPassword && (
          <Field label={t('twoFactor.password')}>
            <PasswordInput
              autoComplete="current-password"
              showLabel={t('twoFactor.show')}
              hideLabel={t('twoFactor.hide')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
        )}
        <Field label={t('twoFactor.codeOrRecovery')}>
          <Input
            autoFocus
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </Field>
      </form>
    </Modal>
  );
}

/** Two-step verification: turn it on with an authenticator app, keep recovery codes, turn it off. */
export function TwoFactorCard() {
  const { t } = useTranslation('profile');
  const errorText = useErrorText();
  const { user } = useSession();
  const status = useTwoFactor();
  const m = useTwoFactorMutations();
  const [step, setStep] = useState<Step>({ kind: 'idle' });
  const on = !!status.data?.enabled;

  const start = () =>
    m.setup.mutate(undefined, {
      onSuccess: (s) => setStep({ kind: 'scan', secret: s.secret, uri: s.uri }),
      onError: (e) => toast.error(errorText(e)),
    });
  const close = () => setStep({ kind: 'idle' });

  return (
    <>
      <SettingsCard title={t('twoFactor.title')} description={t('twoFactor.description')}>
        {status.isPending ? (
          <Skeleton className="h-16" />
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span
                className={
                  on
                    ? 'grid size-10 place-items-center rounded-xl bg-done-soft text-done-ink'
                    : 'grid size-10 place-items-center rounded-xl bg-surface-sunken text-text-muted'
                }
              >
                {on ? <ShieldCheck className="size-5" /> : <ShieldOff className="size-5" />}
              </span>
              <div>
                <p className="flex items-center gap-2 text-sm font-medium text-text">
                  {t(on ? 'twoFactor.on' : 'twoFactor.off')}
                  <Pill size="sm" tone={on ? 'teal' : 'neutral'}>
                    {t(on ? 'twoFactor.statusOn' : 'twoFactor.statusOff')}
                  </Pill>
                </p>
                <p className="text-xs text-text-muted">
                  {on
                    ? t('twoFactor.recoveryLeft', { count: status.data?.recoveryRemaining ?? 0 })
                    : t('twoFactor.offHint')}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {on ? (
                <>
                  <Button variant="secondary" onClick={() => setStep({ kind: 'regenerate' })}>
                    {t('twoFactor.newCodes')}
                  </Button>
                  <Button variant="ghost" onClick={() => setStep({ kind: 'disable' })}>
                    {t('twoFactor.turnOff')}
                  </Button>
                </>
              ) : (
                <Button onClick={start} loading={m.setup.isPending}>
                  <ShieldCheck />
                  {t('twoFactor.turnOn')}
                </Button>
              )}
            </div>
          </div>
        )}
      </SettingsCard>
      {step.kind === 'scan' && (
        <ScanDialog
          secret={step.secret}
          uri={step.uri}
          onClose={close}
          onDone={(codes) => setStep({ kind: 'codes', codes })}
        />
      )}
      {step.kind === 'codes' && <CodesDialog codes={step.codes} onClose={close} />}
      {(step.kind === 'disable' || step.kind === 'regenerate') && (
        <ConfirmDialog
          mode={step.kind}
          hasPassword={!!user?.hasPassword}
          onClose={close}
          onCodes={(codes) => setStep({ kind: 'codes', codes })}
        />
      )}
    </>
  );
}

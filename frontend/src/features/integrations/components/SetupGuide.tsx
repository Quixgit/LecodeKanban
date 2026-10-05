import { copyText } from '@/shared/lib/clipboard';
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, toast } from '@/shared/ui';
import type { IntegrationEntry } from '../api/integrationsApi';
import { PROVIDERS } from '../model/providers';

function Copyable({ value, label }: { value: string; label: string }) {
  const { t } = useTranslation('integrations');
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      if (!(await copyText(value))) throw new Error('copy failed');
      setDone(true);
      window.setTimeout(() => setDone(false), 1800);
    } catch {
      toast.error(t('setup.copyFailed'));
    }
  };
  return (
    <div className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-surface-muted py-1.5 pl-3 pr-1.5">
      <code className="min-w-0 flex-1 select-all break-all font-mono text-xs text-text">
        {value}
      </code>
      <Button size="sm" variant="secondary" onClick={() => void copy()} aria-label={label}>
        {done ? <Check /> : <Copy />}
        {done ? t('setup.copied') : t('setup.copy')}
      </Button>
    </div>
  );
}

/** The one-time server setup for a provider, with the exact values to paste. */
export function SetupGuide({ entry }: { entry: IntegrationEntry }) {
  const { t } = useTranslation('integrations');
  const key = entry.provider;
  const steps = t(`setup.${key}.steps`, { returnObjects: true }) as string[];
  return (
    <section aria-label={t(`setup.${key}.title`)}>
      <h2 className="text-md font-semibold text-text">{t(`setup.${key}.title`)}</h2>
      <p className="mt-1 text-sm text-text-muted">{t('setup.intro')}</p>
      <ol className="mt-5 flex flex-col gap-4">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-semibold text-primary-ink">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1 text-sm text-text-secondary">
              <p>{step}</p>
              {i === PROVIDERS[key].redirectStep && (
                <Copyable value={entry.redirectUri} label={t('setup.copyRedirect')} />
              )}
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-5 rounded-lg bg-surface-muted p-3 text-xs text-text-muted">
        {t('setup.docs')}
      </p>
    </section>
  );
}

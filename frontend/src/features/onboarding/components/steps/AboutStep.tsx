import { UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/cn';
import { Field, Input } from '@/shared/ui';
import { StepHead } from '../StepHead';

export function AboutStep({
  name,
  jobTitle,
  errors,
  onChange,
}: {
  name: string;
  jobTitle: string;
  errors: { name?: string };
  onChange: (patch: { name?: string; jobTitle?: string }) => void;
}) {
  const { t } = useTranslation('onboarding');
  const roles = t('about.roles', { returnObjects: true }) as string[];
  return (
    <div>
      <StepHead icon={UserRound} title={t('about.title')} subtitle={t('about.subtitle')} />
      <div className="flex flex-col gap-4">
        <Field label={t('about.name')} error={errors.name}>
          <Input
            value={name}
            maxLength={100}
            autoFocus
            autoComplete="name"
            placeholder={t('about.namePlaceholder')}
            onChange={(e) => onChange({ name: e.target.value })}
          />
        </Field>
        <div>
          <Field label={t('about.job')}>
            <Input
              value={jobTitle}
              maxLength={100}
              autoComplete="organization-title"
              placeholder={t('about.jobPlaceholder')}
              onChange={(e) => onChange({ jobTitle: e.target.value })}
            />
          </Field>
          <div
            className="mt-2.5 flex flex-wrap gap-1.5"
            role="group"
            aria-label={t('about.jobIdeas')}
          >
            {roles.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onChange({ jobTitle: r })}
                className={cn(
                  'h-7 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                  jobTitle === r
                    ? 'border-primary-border bg-primary-subtle text-primary-ink'
                    : 'border-border text-text-secondary hover:bg-surface-sunken',
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

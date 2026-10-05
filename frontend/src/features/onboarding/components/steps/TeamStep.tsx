import { UsersRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { TagInput } from '@/shared/ui';
import { StepHead } from '../StepHead';

export function TeamStep({
  emails,
  error,
  onChange,
}: {
  emails: string[];
  error?: string;
  onChange: (emails: string[]) => void;
}) {
  const { t } = useTranslation('onboarding');
  return (
    <div>
      <StepHead icon={UsersRound} title={t('team.title')} subtitle={t('team.subtitle')} />
      <label htmlFor="onboarding-emails" className="mb-1.5 block text-sm font-medium text-text">
        {t('team.label')}
      </label>
      <TagInput
        id="onboarding-emails"
        value={emails}
        onChange={onChange}
        max={10}
        maxLength={120}
        invalid={!!error}
        placeholder={t('team.placeholder')}
        removeLabel={(email) => t('team.remove', { email })}
      />
      {error ? (
        <p role="alert" className="mt-1.5 text-xs text-danger-ink">
          {error}
        </p>
      ) : (
        <p className="mt-1.5 text-xs text-text-muted">{t('team.hint')}</p>
      )}
    </div>
  );
}

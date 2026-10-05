import { AtSign, MessageCircle, Phone, ContactRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { TIMEZONES } from '@/features/profile';
import { Button, Field, Input } from '@/shared/ui';
import type { Draft } from '../../model/draft';
import { StepHead } from '../StepHead';

type Patch = Partial<
  Pick<Draft, 'phone' | 'telegram' | 'whatsapp' | 'timezone' | 'workStart' | 'workEnd'>
>;

export function ContactsStep({
  draft,
  errors,
  onChange,
}: {
  draft: Draft;
  errors: { telegram?: string; whatsapp?: string };
  onChange: (p: Patch) => void;
}) {
  const { t } = useTranslation('onboarding');
  return (
    <div>
      <StepHead icon={ContactRound} title={t('contacts.title')} subtitle={t('contacts.subtitle')} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('contacts.phone')}>
          <Input
            type="tel"
            value={draft.phone}
            maxLength={40}
            autoFocus
            autoComplete="tel"
            leadingIcon={<Phone />}
            placeholder={t('contacts.phonePlaceholder')}
            onChange={(e) => onChange({ phone: e.target.value })}
          />
        </Field>
        <Field label={t('contacts.telegram')} error={errors.telegram}>
          <Input
            value={draft.telegram}
            maxLength={40}
            leadingIcon={<AtSign />}
            placeholder={t('contacts.telegramPlaceholder')}
            onChange={(e) => onChange({ telegram: e.target.value })}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label={t('contacts.whatsapp')} error={errors.whatsapp}>
            <Input
              type="tel"
              value={draft.whatsapp}
              maxLength={40}
              leadingIcon={<MessageCircle />}
              placeholder={t('contacts.whatsappPlaceholder')}
              trailing={
                draft.phone.trim() && draft.whatsapp !== draft.phone ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => onChange({ whatsapp: draft.phone })}
                  >
                    {t('contacts.sameAsPhone')}
                  </Button>
                ) : null
              }
              onChange={(e) => onChange({ whatsapp: e.target.value })}
            />
          </Field>
        </div>
        <Field
          label={t('contacts.timezone')}
          hint={draft.timezone ? t('contacts.timezoneHint') : undefined}
        >
          <>
            <Input
              value={draft.timezone}
              list="onboarding-timezones"
              maxLength={64}
              autoComplete="off"
              onChange={(e) => onChange({ timezone: e.target.value })}
            />
            <datalist id="onboarding-timezones">
              {TIMEZONES.map((z) => (
                <option key={z} value={z} />
              ))}
            </datalist>
          </>
        </Field>
        <div>
          <p className="mb-1.5 text-sm font-medium text-text">{t('contacts.workHours')}</p>
          <div className="flex items-center gap-2">
            <Input
              type="time"
              aria-label={`${t('contacts.workHours')} ↑`}
              value={draft.workStart}
              onChange={(e) => onChange({ workStart: e.target.value })}
            />
            <span className="text-sm text-text-muted">{t('contacts.to')}</span>
            <Input
              type="time"
              aria-label={`${t('contacts.workHours')} ↓`}
              value={draft.workEnd}
              onChange={(e) => onChange({ workEnd: e.target.value })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

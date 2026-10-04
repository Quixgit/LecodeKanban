import { useTranslation } from 'react-i18next';
import type { Role } from '@/shared/api';
import { Pill, type Tone } from '@/shared/ui';

const tones: Record<Role, Tone> = {
  owner: 'teal',
  admin: 'purple',
  member: 'neutral',
  viewer: 'amber',
};

/** A role as a pill; a person with a custom role shows its name, tinted like the role it ranks as. */
export function RolePill({ role, label }: { role: Role; label?: string }) {
  const { t } = useTranslation('team');
  return (
    <Pill tone={tones[role]} size="sm">
      {label ?? t(`roles.${role}`)}
    </Pill>
  );
}

import { useTranslation } from 'react-i18next';
import type { Role } from '@/shared/api';
import { Pill, type Tone } from '@/shared/ui';

const tones: Record<Role, Tone> = {
  owner: 'teal',
  admin: 'purple',
  member: 'neutral',
  viewer: 'amber',
};

export function RolePill({ role }: { role: Role }) {
  const { t } = useTranslation('team');
  return (
    <Pill tone={tones[role]} size="sm">
      {t(`roles.${role}`)}
    </Pill>
  );
}

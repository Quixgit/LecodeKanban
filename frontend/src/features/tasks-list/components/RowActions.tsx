import { ArrowRightLeft, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { STATUSES, type Card, type TaskStatus } from '@/features/cards';
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  DropdownSub,
  DropdownSubContent,
  DropdownSubTrigger,
  DropdownTrigger,
  IconButton,
} from '@/shared/ui';

interface Props {
  card: Card;
  canEdit: boolean;
  onEdit: (c: Card) => void;
  onMove: (c: Card, s: TaskStatus) => void;
  onDelete: (c: Card) => void;
}

export function RowActions({ card, canEdit, onEdit, onMove, onDelete }: Props) {
  const { t } = useTranslation(['tasks', 'common']);
  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <IconButton size="sm" label={t('row.actions', { key: card.key })}>
          <MoreHorizontal />
        </IconButton>
      </DropdownTrigger>
      <DropdownContent>
        <DropdownItem onSelect={() => onEdit(card)}>
          <Pencil />
          {t('row.edit')}
        </DropdownItem>
        {canEdit && (
          <>
            <DropdownSub>
              <DropdownSubTrigger>
                <ArrowRightLeft />
                {t('row.moveTo')}
              </DropdownSubTrigger>
              <DropdownSubContent>
                {STATUSES.filter((s) => s !== card.status).map((s) => (
                  <DropdownItem key={s} onSelect={() => onMove(card, s)}>
                    {t(`common:status.${s}`)}
                  </DropdownItem>
                ))}
              </DropdownSubContent>
            </DropdownSub>
            <DropdownSeparator />
            <DropdownItem danger onSelect={() => onDelete(card)}>
              <Trash2 />
              {t('row.delete')}
            </DropdownItem>
          </>
        )}
      </DropdownContent>
    </Dropdown>
  );
}

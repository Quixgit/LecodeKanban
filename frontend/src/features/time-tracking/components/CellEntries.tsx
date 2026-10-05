import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { Button, IconButton, Modal, toast } from '@/shared/ui';
import type { TimesheetEntry } from '../api/timeApi';
import { useTimeMutations } from '../hooks/useTime';
import { Duration } from './Duration';
import { LogTimeDialog } from './LogTimeDialog';

/** What was logged on one task on one day: edit or remove each entry, or add another. */
export function CellEntries({
  open,
  onOpenChange,
  title,
  card,
  day,
  entries,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  card: TimesheetEntry['card'];
  day: Date;
  entries: TimesheetEntry[];
}) {
  const { t } = useTranslation('time');
  const errorText = useErrorText();
  const { remove } = useTimeMutations();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<TimesheetEntry['entry'] | null>(null);
  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        size="sm"
        title={title}
        footer={
          <Button variant="secondary" onClick={() => setAdding(true)}>
            <Plus />
            {t('sheet.addEntry')}
          </Button>
        }
      >
        <ul className="flex flex-col gap-1">
          {entries.map(({ entry }) => (
            <li
              key={entry.id}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-muted"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-text">{entry.note || card.title}</p>
                {entry.running && <p className="text-xs text-primary-ink">{t('sheet.running')}</p>}
              </div>
              <span className="tabular text-sm font-medium text-text">
                <Duration seconds={entry.seconds} />
              </span>
              {!entry.running && (
                <>
                  <IconButton
                    variant="ghost"
                    size="sm"
                    label={t('panel.edit')}
                    onClick={() => setEditing(entry)}
                  >
                    <Pencil />
                  </IconButton>
                  <IconButton
                    variant="ghost"
                    size="sm"
                    label={t('delete')}
                    onClick={() =>
                      remove.mutate(entry.id, { onError: (e) => toast.error(errorText(e)) })
                    }
                  >
                    <Trash2 />
                  </IconButton>
                </>
              )}
            </li>
          ))}
        </ul>
      </Modal>
      <LogTimeDialog open={adding} onOpenChange={setAdding} task={card} day={day} />
      <LogTimeDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        task={card}
        entry={editing ?? undefined}
      />
    </>
  );
}

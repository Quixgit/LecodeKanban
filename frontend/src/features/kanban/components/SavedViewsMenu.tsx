import { Bookmark, BookmarkPlus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useErrorText } from '@/shared/hooks/useErrorText';
import {
  Button,
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
  DropdownTrigger,
  Field,
  IconButton,
  Input,
  Modal,
  Tooltip,
  toast,
} from '@/shared/ui';
import { useSavedViews } from '../hooks/useSavedViews';
import { SWIMLANES, type Swimlane } from '../model/board';

/** What a saved view restores: URL filters plus the swimlane. */
export interface ViewConfig {
  filters: Record<string, string | undefined>;
  swimlane: Swimlane;
}

function parseConfig(raw: Record<string, unknown>): ViewConfig {
  const filters: Record<string, string | undefined> = {};
  const f = (raw.filters ?? {}) as Record<string, unknown>;
  for (const [k, v] of Object.entries(f)) if (typeof v === 'string') filters[k] = v;
  const swimlane = SWIMLANES.includes(raw.swimlane as Swimlane)
    ? (raw.swimlane as Swimlane)
    : 'none';
  return { filters, swimlane };
}

interface Props {
  workspaceId: string;
  current: ViewConfig;
  onApply: (config: ViewConfig) => void;
}

export function SavedViewsMenu({ workspaceId, current, onApply }: Props) {
  const { t } = useTranslation(['kanban', 'common']);
  const errorText = useErrorText();
  const { list, create, remove } = useSavedViews(workspaceId);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    create.mutate(
      { name: name.trim(), config: { filters: current.filters, swimlane: current.swimlane } },
      {
        onSuccess: (v) => {
          toast.success(t('views.saved', { name: v.name }));
          setSaving(false);
          setName('');
        },
        onError: (err) => toast.error(errorText(err)),
      },
    );
  };

  return (
    <>
      <Dropdown>
        <Tooltip content={t('views.title')}>
          <DropdownTrigger asChild>
            <IconButton label={t('views.title')}>
              <Bookmark />
            </IconButton>
          </DropdownTrigger>
        </Tooltip>
        <DropdownContent align="end" className="w-64">
          <DropdownLabel>{t('views.title')}</DropdownLabel>
          {(list.data ?? []).length === 0 && (
            <p className="px-2.5 py-1.5 text-sm text-text-muted">{t('views.empty')}</p>
          )}
          {(list.data ?? []).map((v) => (
            <div key={v.id} className="flex items-center">
              <DropdownItem className="flex-1" onSelect={() => onApply(parseConfig(v.config))}>
                <span className="truncate">{v.name}</span>
              </DropdownItem>
              <IconButton
                variant="ghost"
                size="sm"
                label={t('views.delete', { name: v.name })}
                onClick={() =>
                  remove.mutate(v.id, { onError: (err) => toast.error(errorText(err)) })
                }
              >
                <Trash2 />
              </IconButton>
            </div>
          ))}
          <DropdownSeparator />
          <DropdownItem onSelect={() => setSaving(true)}>
            <BookmarkPlus />
            {t('views.saveCurrent')}
          </DropdownItem>
        </DropdownContent>
      </Dropdown>
      <Modal
        open={saving}
        onOpenChange={setSaving}
        size="sm"
        title={t('views.saveTitle')}
        description={t('views.saveHint')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSaving(false)}>
              {t('common:actions.cancel')}
            </Button>
            <Button
              type="submit"
              form="save-view"
              loading={create.isPending}
              disabled={!name.trim()}
            >
              {t('common:actions.save')}
            </Button>
          </>
        }
      >
        <form id="save-view" onSubmit={save}>
          <Field label={t('views.name')}>
            <Input
              autoFocus
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
        </form>
      </Modal>
    </>
  );
}

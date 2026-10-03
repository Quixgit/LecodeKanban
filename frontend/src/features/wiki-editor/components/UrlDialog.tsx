import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Field, Input, Modal } from '@/shared/ui';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  label: string;
  placeholder?: string;
  initial?: string;
  /** Returns an error message to keep the dialog open, or null when the value was accepted. */
  onSubmit: (value: string) => string | null;
  /** Shown when set: removes the value (e.g. unlink). */
  onRemove?: () => void;
}

/** A one-field dialog for a link or video URL. */
export function UrlDialog(props: Props) {
  // Remount per opening so the field starts from the current value.
  return props.open ? <Form {...props} /> : null;
}

function Form({
  open,
  onOpenChange,
  title,
  label,
  placeholder,
  initial = '',
  onSubmit,
  onRemove,
}: Props) {
  const { t } = useTranslation('wikiEditor');
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const err = onSubmit(value.trim());
    if (err) setError(err);
    else onOpenChange(false);
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} size="sm" title={title}>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Field label={label} error={error ?? undefined}>
          <Input
            value={value}
            autoFocus
            inputMode="url"
            placeholder={placeholder}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
          />
        </Field>
        <div className="flex items-center justify-between gap-2">
          {onRemove ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                onRemove();
                onOpenChange(false);
              }}
            >
              {t('dialog.remove')}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {t('dialog.cancel')}
            </Button>
            <Button type="submit">{t('dialog.apply')}</Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { Button, Field, Input, Modal, Textarea, toast } from '@/shared/ui';
import { useWikiMutations } from '../hooks/useWiki';

/** Saves the open page as a workspace template (admins). */
export function SaveTemplateDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  nodeId: string;
  defaultName: string;
}) {
  return props.open ? <Form {...props} /> : null;
}

function Form({
  open,
  onOpenChange,
  workspaceId,
  nodeId,
  defaultName,
}: Parameters<typeof SaveTemplateDialog>[0]) {
  const { t } = useTranslation('wiki');
  const errorText = useErrorText();
  const m = useWikiMutations(workspaceId);
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    m.createTemplate.mutate(
      { name, description, nodeId },
      {
        onSuccess: () => {
          toast.success(t('templates.saved', { name }));
          onOpenChange(false);
        },
        onError: (err) => toast.error(errorText(err)),
      },
    );
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('templates.saveTitle')}
      description={t('templates.saveDescription')}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label={t('templates.name')}>
          <Input value={name} maxLength={80} autoFocus onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={t('templates.descriptionLabel')}>
          <Textarea
            value={description}
            maxLength={300}
            rows={3}
            className="min-h-20"
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={m.createTemplate.isPending} disabled={!name.trim()}>
            {t('templates.save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

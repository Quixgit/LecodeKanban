import { AlertTriangle, CircleCheck, FileUp, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAllProjects } from '@/features/projects';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { Button, Select, SettingsCard, toast } from '@/shared/ui';
import { settingsApi, type ImportResult } from '../api/settingsApi';
import { SettingRow } from './SettingRow';

/** Bring tasks in from a spreadsheet: check the file first (nothing is written), then import. */
export function ImportCard({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation('settings');
  const errorText = useErrorText();
  const qc = useQueryClient();
  const projects = useAllProjects(workspaceId);
  const input = useRef<HTMLInputElement>(null);
  const [project, setProject] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportResult | null>(null);

  const target = project || projects.data?.items[0]?.id || '';
  const run = useMutation({
    mutationFn: (dryRun: boolean) =>
      settingsApi.importTasks(workspaceId, target, file as File, dryRun),
    onSuccess: (res) => {
      if (res.dryRun) {
        setPreview(res);
        return;
      }
      toast.success(t('import.done', { count: res.created }));
      setFile(null);
      setPreview(null);
      void qc.invalidateQueries({ queryKey: ['cards', workspaceId] });
      void qc.invalidateQueries({ queryKey: ['projects', workspaceId] });
    },
    onError: (e) => toast.error(errorText(e)),
  });

  const pick = (f: File | undefined) => {
    setFile(f ?? null);
    setPreview(null);
  };
  const problems = preview?.rows.filter((r) => r.error || r.warnings.length > 0) ?? [];

  return (
    <SettingsCard title={t('import.title')} description={t('import.description')}>
      <SettingRow
        icon={<FileUp />}
        title={t('import.project.title')}
        description={t('import.project.description')}
      >
        <Select
          label={t('import.project.title')}
          value={target}
          onValueChange={(v) => {
            setProject(v);
            setPreview(null);
          }}
          options={(projects.data?.items ?? []).map((p) => ({ value: p.id, label: p.name }))}
        />
      </SettingRow>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <input
          ref={input}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          aria-label={t('import.file')}
          onChange={(e) => pick(e.target.files?.[0])}
        />
        <Button variant="secondary" onClick={() => input.current?.click()}>
          <Upload />
          {file ? file.name : t('import.choose')}
        </Button>
        <Button
          variant="primary"
          disabled={!file || !target}
          loading={run.isPending && run.variables === true}
          onClick={() => run.mutate(true)}
        >
          {t('import.check')}
        </Button>
        <p className="text-xs text-text-muted">{t('import.hint')}</p>
      </div>

      {preview && (
        <div className="mt-5 flex flex-col gap-3" role="status">
          <p className="text-text-primary flex items-center gap-2 text-base">
            <CircleCheck className="text-success size-4" aria-hidden />
            {t('import.summary', { created: preview.created, skipped: preview.skipped })}
          </p>
          {problems.length > 0 && (
            <ul className="flex max-h-56 flex-col gap-1 overflow-auto rounded-md border border-border p-3 text-sm">
              {problems.slice(0, 50).map((r) => (
                <li key={r.line} className="flex items-start gap-2 text-text-secondary">
                  <AlertTriangle className="text-warning mt-0.5 size-3.5 shrink-0" aria-hidden />
                  <span>
                    {t('import.line', { line: r.line })}
                    {r.title ? ` · ${r.title}` : ''} —{' '}
                    {[...(r.error ? [r.error] : []), ...r.warnings]
                      .map((c) => t(`import.codes.${c}`, { defaultValue: c }))
                      .join(', ')}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div>
            <Button
              variant="primary"
              disabled={preview.created === 0}
              loading={run.isPending && run.variables === false}
              onClick={() => run.mutate(false)}
            >
              {t('import.run', { count: preview.created })}
            </Button>
          </div>
        </div>
      )}
    </SettingsCard>
  );
}

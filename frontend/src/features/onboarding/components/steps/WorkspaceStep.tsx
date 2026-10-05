import { motion, useReducedMotion } from 'framer-motion';
import { Building2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { WorkspaceGlyph } from '@/features/settings';
import { cn } from '@/shared/lib/cn';
import { transition } from '@/shared/motion';
import { Field, Input } from '@/shared/ui';
import { suggestWorkspaceName } from '../../model/validators';
import { StepHead } from '../StepHead';

export function WorkspaceStep({
  value,
  person,
  error,
  onChange,
}: {
  value: string;
  person: string;
  error?: string;
  onChange: (v: string) => void;
}) {
  const { t } = useTranslation('onboarding');
  const reduce = useReducedMotion();
  const ideas = [
    suggestWorkspaceName(person, (name) => t('workspace.suggestPersonal', { name })),
    t('workspace.suggestTeam'),
    t('workspace.suggestCompany'),
  ].filter(Boolean);
  const shown = value.trim() || t('workspace.placeholder');
  return (
    <div>
      <StepHead icon={Building2} title={t('workspace.title')} subtitle={t('workspace.subtitle')} />
      <Field label={t('workspace.label')} error={error}>
        <Input
          value={value}
          maxLength={100}
          autoFocus
          autoComplete="organization"
          placeholder={t('workspace.placeholder')}
          onChange={(e) => onChange(e.target.value)}
        />
      </Field>
      <div
        className="mt-3 flex flex-wrap items-center gap-2"
        role="group"
        aria-label={t('workspace.suggestions')}
      >
        {ideas.map((idea) => (
          <button
            key={idea}
            type="button"
            onClick={() => onChange(idea)}
            className={cn(
              'h-7 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
              value === idea
                ? 'border-primary-border bg-primary-subtle text-primary-ink'
                : 'border-border text-text-secondary hover:bg-surface-sunken',
            )}
          >
            {idea}
          </button>
        ))}
      </div>
      <div className="mt-7">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">
          {t('workspace.preview')}
        </p>
        <div
          aria-hidden
          className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm"
        >
          <motion.div
            key={value.trim().length > 0 ? 'named' : 'empty'}
            initial={reduce ? false : { scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={transition.spring}
          >
            <WorkspaceGlyph icon="building" size="md" />
          </motion.div>
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                'truncate text-sm font-semibold',
                value.trim() ? 'text-text' : 'text-text-faint',
              )}
            >
              {shown}
            </p>
            <div className="mt-2 flex gap-2">
              {(['a', 'b', 'c'] as const).map((k, i) => (
                <motion.span
                  key={k}
                  className="rounded-md bg-surface-sunken px-2 py-1 text-2xs text-text-muted"
                  initial={reduce ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...transition.ui, delay: 0.2 + i * 0.07 }}
                >
                  {t(`workspace.previewItems.${k}`)}
                </motion.span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

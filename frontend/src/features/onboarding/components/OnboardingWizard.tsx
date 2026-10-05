import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Rocket } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { deviceTimezone, useProfileMutations } from '@/features/profile';
import { useCreateWorkspace, useWorkspaceMutations } from '@/features/workspaces';
import type { User, Workspace } from '@/shared/api';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { transition } from '@/shared/motion';
import { Button, FormAlert, GridBackdrop } from '@/shared/ui';
import { initialDraft, type Draft } from '../model/draft';
import { isOptional, progress, stepsFor, type Mode, type StepId } from '../model/steps';
import { cleanTelegram, cleanWhatsApp, isEmail } from '../model/validators';
import { useCompleteOnboarding } from '../hooks/useCompleteOnboarding';
import { Rail } from './Rail';
import { AboutStep } from './steps/AboutStep';
import { ContactsStep } from './steps/ContactsStep';
import { DoneStep } from './steps/DoneStep';
import { PhotoStep } from './steps/PhotoStep';
import { TeamStep } from './steps/TeamStep';
import { WelcomeStep } from './steps/WelcomeStep';
import { WorkspaceStep } from './steps/WorkspaceStep';

interface Props {
  mode: Mode;
  user: User;
  /** The workspace the person has joined (join mode). */
  joined: Workspace | null;
  /** The workspace made for them when they registered (create mode): the wizard names it. */
  owned: Workspace | null;
  logo: ReactNode;
  /** Called when the wizard is finished or skipped, to leave the screen. */
  onClose: () => void;
}

type Errors = Partial<
  Record<'workspace' | 'name' | 'telegram' | 'whatsapp' | 'team' | 'form', string>
>;

/**
 * A guided, animated setup: for someone with no workspace it creates one and asks who they are; for someone who
 * was invited it only introduces them to the team. Each step saves as it goes, so closing it keeps what was done.
 */
export function OnboardingWizard({ mode, user, joined, owned, logo, onClose }: Props) {
  const { t } = useTranslation('onboarding');
  const errorText = useErrorText();
  const reduce = useReducedMotion();
  const steps = stepsFor(mode);
  const [step, setStep] = useState<StepId>('welcome');
  const [dir, setDir] = useState(1);
  const [draft, setDraft] = useState<Draft>(() => ({
    ...initialDraft(user, deviceTimezone()),
    workspaceId: owned?.id ?? null,
    workspaceName: owned?.name ?? '',
  }));
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const body = useRef<HTMLDivElement>(null);

  const { update } = useProfileMutations();
  const createWorkspace = useCreateWorkspace();
  const workspaceId = draft.workspaceId ?? joined?.id ?? owned?.id ?? '';
  const { rename, invite } = useWorkspaceMutations(workspaceId);
  const complete = useCompleteOnboarding();

  const patch = (p: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...p }));
    setErrors({});
  };
  const workspaceName = draft.workspaceName.trim() || joined?.name || '';

  // A new screen takes focus on its title, so keyboard and screen-reader users start at the top of it.
  useEffect(() => {
    const el = body.current?.querySelector<HTMLElement>(
      '[data-autofocus], [autofocus], input, textarea',
    );
    const title = body.current?.querySelector<HTMLElement>('[data-step-title]');
    (el ?? title)?.focus({ preventScroll: true });
  }, [step]);

  const go = (to: StepId) => {
    setDir(steps.indexOf(to) >= steps.indexOf(step) ? 1 : -1);
    setStep(to);
    setErrors({});
  };
  const next = () => go(steps[Math.min(steps.indexOf(step) + 1, steps.length - 1)]!);
  const back = () => go(steps[Math.max(steps.indexOf(step) - 1, 0)]!);

  /** Validates this step and saves what it asked for; resolves true when the person may move on. */
  const save = async (): Promise<boolean> => {
    switch (step) {
      case 'workspace': {
        const name = draft.workspaceName.trim();
        if (!name) {
          setErrors({ workspace: t('workspace.errorRequired') });
          return false;
        }
        if (!draft.workspaceId) {
          const ws = await createWorkspace.mutateAsync(name);
          setDraft((d) => ({ ...d, workspaceId: ws.id }));
        } else if (name !== owned?.name) {
          await rename.mutateAsync(name);
        }
        return true;
      }
      case 'about': {
        const name = draft.name.trim();
        if (!name) {
          setErrors({ name: t('about.errorName') });
          return false;
        }
        await update.mutateAsync({ name, jobTitle: draft.jobTitle.trim() });
        return true;
      }
      case 'contacts': {
        const telegram = cleanTelegram(draft.telegram);
        const whatsapp = cleanWhatsApp(draft.whatsapp);
        if (telegram === null || whatsapp === null) {
          setErrors({
            telegram: telegram === null ? t('contacts.errors.telegram') : undefined,
            whatsapp: whatsapp === null ? t('contacts.errors.whatsapp') : undefined,
          });
          return false;
        }
        await update.mutateAsync({
          phone: draft.phone.trim(),
          telegram,
          whatsapp,
          timezone: draft.timezone.trim(),
          workStart: draft.workStart && draft.workEnd ? draft.workStart : '',
          workEnd: draft.workStart && draft.workEnd ? draft.workEnd : '',
        });
        return true;
      }
      case 'team': {
        const bad = draft.emails.find((e) => !isEmail(e));
        if (bad) {
          setErrors({ team: t('team.invalid', { email: bad }) });
          return false;
        }
        const failed: string[] = [];
        let sent = 0;
        for (const email of draft.emails) {
          try {
            await invite.mutateAsync({ email, role: 'member' });
            sent++;
          } catch {
            failed.push(email);
          }
        }
        setDraft((d) => ({ ...d, emails: failed, invited: d.invited + sent }));
        if (failed.length > 0) {
          setErrors({ team: t('team.failed', { email: failed.join(', ') }) });
          return false;
        }
        return true;
      }
      default:
        return true;
    }
  };

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    if (step === 'done') {
      await finish();
      return;
    }
    setBusy(true);
    try {
      if (await save()) next();
    } catch (err) {
      setErrors({ form: errorText(err) });
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    setBusy(true);
    try {
      await complete.mutateAsync();
      onClose();
    } catch (err) {
      setErrors({ form: errorText(err) });
    } finally {
      setBusy(false);
    }
  };

  const index = steps.indexOf(step);
  const last = step === 'done';
  const slide = {
    enter: (d: number) => ({ opacity: 0, x: reduce ? 0 : 36 * d }),
    center: { opacity: 1, x: 0 },
    exit: (d: number) => ({ opacity: 0, x: reduce ? 0 : -36 * d }),
  };

  return (
    <Dialog.Root open>
      <Dialog.Portal>
        <Dialog.Content
          aria-describedby={undefined}
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          className="fixed inset-0 z-[60] overflow-y-auto bg-bg outline-none"
        >
          <Dialog.Title className="sr-only">{t('rail.title')}</Dialog.Title>
          <GridBackdrop />
          <div className="mx-auto grid min-h-dvh max-w-[1100px] grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)]">
            <Rail steps={steps} current={step} logo={logo} />
            <main className="flex flex-col justify-center px-4 py-8 sm:px-8 lg:px-12">
              <div className="mb-4 flex items-center justify-between gap-3 lg:hidden">
                {logo}
                <span className="text-xs text-text-muted">
                  {t('stepOf', { current: index + 1, total: steps.length })}
                </span>
              </div>

              <div className="mx-auto w-full max-w-[580px] overflow-hidden rounded-3xl border border-border bg-surface/90 shadow-lg backdrop-blur-sm">
                <div
                  role="progressbar"
                  aria-label={t('progress')}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress(mode, step)}
                  className="h-1 w-full bg-surface-sunken"
                >
                  <motion.div
                    className="h-full bg-primary"
                    initial={false}
                    animate={{ width: `${Math.max(6, progress(mode, step))}%` }}
                    transition={reduce ? { duration: 0 } : transition.softSpring}
                  />
                </div>
                <form onSubmit={submit} noValidate>
                  <div ref={body} className="relative min-h-[430px] p-6 sm:p-9">
                    <AnimatePresence mode="wait" custom={dir} initial={false}>
                      <motion.div
                        key={step}
                        custom={dir}
                        variants={slide}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={transition.large}
                      >
                        {step === 'welcome' && (
                          <WelcomeStep
                            mode={mode}
                            name={draft.name}
                            workspace={joined?.name ?? ''}
                          />
                        )}
                        {step === 'workspace' && (
                          <WorkspaceStep
                            value={draft.workspaceName}
                            person={draft.name}
                            error={errors.workspace}
                            onChange={(v) => patch({ workspaceName: v })}
                          />
                        )}
                        {step === 'about' && (
                          <AboutStep
                            name={draft.name}
                            jobTitle={draft.jobTitle}
                            errors={{ name: errors.name }}
                            onChange={patch}
                          />
                        )}
                        {step === 'photo' && (
                          <PhotoStep name={draft.name} avatarUrl={user.avatarUrl} />
                        )}
                        {step === 'contacts' && (
                          <ContactsStep draft={draft} errors={errors} onChange={patch} />
                        )}
                        {step === 'team' && (
                          <TeamStep
                            emails={draft.emails}
                            error={errors.team}
                            onChange={(emails) => patch({ emails })}
                          />
                        )}
                        {step === 'done' && (
                          <DoneStep
                            mode={mode}
                            workspace={workspaceName}
                            name={draft.name}
                            jobTitle={draft.jobTitle}
                            avatarUrl={user.avatarUrl}
                          />
                        )}
                      </motion.div>
                    </AnimatePresence>
                  </div>

                  <div className="flex flex-col gap-3 border-t border-border-subtle bg-surface-muted/60 px-6 py-4 sm:px-9">
                    <FormAlert>{errors.form ?? null}</FormAlert>
                    <div className="flex items-center justify-between gap-3">
                      {index > 0 && !last ? (
                        <Button type="button" variant="ghost" onClick={back} disabled={busy}>
                          <ArrowLeft />
                          {t('back')}
                        </Button>
                      ) : (
                        <span />
                      )}
                      <div className="flex items-center gap-2">
                        {isOptional(step) && (
                          <Button type="button" variant="ghost" disabled={busy} onClick={next}>
                            {t('skipStep')}
                          </Button>
                        )}
                        <Button type="submit" size="lg" loading={busy}>
                          {last ? (
                            <>
                              <Rocket />
                              {t('finish')}
                            </>
                          ) : (
                            <>
                              {step === 'welcome' ? t('welcome.start') : t('next')}
                              <ArrowRight />
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </form>
              </div>

              {!last && (
                <div className="mx-auto mt-4 w-full max-w-[580px] text-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => void finish()}
                  >
                    {t('skip')}
                  </Button>
                </div>
              )}
            </main>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

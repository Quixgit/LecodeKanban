import { Check, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/cn';
import { Button, Modal } from '@/shared/ui';
import { PRESETS, isDefault, isHex } from '../model/theme';
import { useChatThemeStore } from '../store/chatThemeStore';

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle px-3 py-2">
      <span className="text-sm font-medium text-text">{label}</span>
      <span className="flex items-center gap-2">
        <code className="font-mono text-xs uppercase text-text-muted">{value}</code>
        <input
          type="color"
          aria-label={label}
          value={isHex(value) ? value : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="size-8 cursor-pointer rounded-md border border-border bg-transparent p-0.5"
        />
      </span>
    </label>
  );
}

/** Colours of the chat: pick a ready-made look or set the sidebar and accent yourself. Changes show at once. */
export function ChatAppearanceDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation('chat');
  const { sidebar, accent, set, reset } = useChatThemeStore();
  const theme = { sidebar, accent };
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title={t('appearance.title')}
      description={t('appearance.description')}
      footer={
        <>
          <Button variant="ghost" onClick={reset} disabled={isDefault(theme)}>
            <RotateCcw />
            {t('appearance.reset')}
          </Button>
          <Button onClick={() => onOpenChange(false)}>{t('appearance.done')}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div
          role="radiogroup"
          aria-label={t('appearance.themes')}
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          {PRESETS.map((p) => {
            const on =
              p.sidebar.toLowerCase() === sidebar.toLowerCase() &&
              p.accent.toLowerCase() === accent.toLowerCase();
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => set({ sidebar: p.sidebar, accent: p.accent })}
                className={cn(
                  'group flex flex-col gap-2 rounded-xl border p-2 text-left outline-none transition-[border-color,box-shadow,transform] duration-micro focus-visible:shadow-focus active:scale-[0.97]',
                  on ? 'border-primary bg-primary-subtle' : 'border-border hover:border-primary/40',
                )}
              >
                <span
                  aria-hidden
                  className="relative flex h-14 overflow-hidden rounded-lg border border-border-subtle"
                >
                  <span className="w-1/3" style={{ background: p.sidebar }}>
                    <span
                      className="mx-1.5 mt-2 block h-2 rounded-sm"
                      style={{ background: p.accent }}
                    />
                    <span className="mx-1.5 mt-1.5 block h-1.5 rounded-sm bg-current opacity-20" />
                  </span>
                  <span className="flex-1 bg-white p-1.5">
                    <span className="block h-1.5 w-2/3 rounded-sm bg-black/10" />
                    <span className="mt-1 block h-1.5 w-1/2 rounded-sm bg-black/10" />
                    <span
                      className="ml-auto mt-3 block h-2.5 w-1/3 rounded-sm"
                      style={{ background: p.accent }}
                    />
                  </span>
                  {on && (
                    <span className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-primary-solid text-on-primary">
                      <Check className="size-3" />
                    </span>
                  )}
                </span>
                <span className="px-0.5 text-xs font-medium text-text">
                  {t(`appearance.presets.${p.id}`)}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-text">{t('appearance.custom')}</p>
          <ColorField
            label={t('appearance.sidebar')}
            value={sidebar}
            onChange={(v) => set({ sidebar: v })}
          />
          <ColorField
            label={t('appearance.accent')}
            value={accent}
            onChange={(v) => set({ accent: v })}
          />
        </div>
      </div>
    </Modal>
  );
}

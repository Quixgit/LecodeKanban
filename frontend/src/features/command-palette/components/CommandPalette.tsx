import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { CornerDownLeft, Search } from 'lucide-react';
import { useMemo, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useHotkey } from '@/shared/hooks/useHotkey';
import { useRestoreFocus } from '@/shared/hooks/useRestoreFocus';
import { cn } from '@/shared/lib/cn';
import { backdrop, scaleIn } from '@/shared/motion';
import { EmptyState, Kbd } from '@/shared/ui';
import { filterCommands } from '../model/filter';
import type { Command } from '../model/types';
import { useCommandPalette } from '../store/paletteStore';

export function CommandPalette({ commands }: { commands: Command[] }) {
  const { t } = useTranslation();
  const { isOpen, setOpen, close } = useCommandPalette();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const restoreFocus = useRestoreFocus(isOpen);

  useHotkey('k', () => setOpen(!useCommandPalette.getState().isOpen), {
    mod: true,
    allowInInputs: true,
  });

  const results = useMemo(() => filterCommands(commands, query), [commands, query]);
  const groups = useMemo(() => {
    const map = new Map<string, Command[]>();
    results.forEach((c) => map.set(c.group, [...(map.get(c.group) ?? []), c]));
    return [...map.entries()];
  }, [results]);

  const run = (cmd: Command | undefined) => {
    if (!cmd) return;
    setQuery('');
    setActive(0);
    close();
    cmd.run();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const d = e.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (results.length ? (i + d + results.length) % results.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      run(results[active]);
    }
  };

  const onOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) {
      setQuery('');
      setActive(0);
    }
  };

  let index = -1;
  return (
    <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {isOpen && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay forceMount asChild>
              <motion.div
                variants={backdrop}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="fixed inset-0 z-40 bg-overlay/25 backdrop-blur-[3px]"
              />
            </Dialog.Overlay>
            <div className="fixed inset-x-0 top-[12vh] z-50 flex justify-center px-4">
              <Dialog.Content
                forceMount
                asChild
                onCloseAutoFocus={restoreFocus}
                aria-describedby={undefined}
              >
                <motion.div
                  variants={scaleIn}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-surface shadow-lg"
                >
                  <Dialog.Title className="sr-only">{t('commandPalette.title')}</Dialog.Title>
                  <div className="flex items-center gap-3 border-b border-border-subtle px-4">
                    <Search className="size-5 stroke-[1.6] text-text-muted" aria-hidden />
                    <input
                      autoFocus
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setActive(0);
                      }}
                      onKeyDown={onKeyDown}
                      placeholder={t('commandPalette.placeholder')}
                      role="combobox"
                      aria-expanded
                      aria-controls="lk-command-list"
                      aria-activedescendant={
                        results[active] ? `cmd-${results[active].id}` : undefined
                      }
                      className="h-14 flex-1 bg-transparent text-md text-text outline-none placeholder:text-text-faint focus-visible:shadow-none"
                    />
                    <Kbd>Esc</Kbd>
                  </div>
                  <ul
                    id="lk-command-list"
                    role="listbox"
                    className="max-h-[360px] overflow-y-auto p-2"
                  >
                    {results.length === 0 && (
                      <EmptyState className="py-10" title={t('commandPalette.empty', { query })} />
                    )}
                    {groups.map(([group, items]) => (
                      <li key={group} role="presentation">
                        <p className="px-2.5 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-text-muted">
                          {group}
                        </p>
                        <ul role="group" aria-label={group}>
                          {items.map((cmd) => {
                            index += 1;
                            const i = index;
                            const Icon = cmd.icon;
                            return (
                              <li
                                key={cmd.id}
                                id={`cmd-${cmd.id}`}
                                role="option"
                                aria-selected={i === active}
                                onMouseMove={() => setActive(i)}
                                onClick={() => run(cmd)}
                                className={cn(
                                  'flex h-10 cursor-pointer items-center gap-3 rounded-lg px-2.5 text-base text-text',
                                  i === active && 'bg-surface-muted',
                                )}
                              >
                                <Icon
                                  className="size-[18px] stroke-[1.6] text-text-muted"
                                  aria-hidden
                                />
                                <span className="flex-1 truncate">{cmd.label}</span>
                                {cmd.shortcut && <Kbd>{cmd.shortcut}</Kbd>}
                                {i === active && (
                                  <CornerDownLeft className="size-4 text-text-faint" aria-hidden />
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              </Dialog.Content>
            </div>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

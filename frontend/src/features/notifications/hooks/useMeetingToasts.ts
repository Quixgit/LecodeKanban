import type { InfiniteData } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { components } from '@/shared/api';
import { useLanguage } from '@/shared/i18n';
import { useToastStore } from '@/shared/ui';
import { freshIds } from '../model/describe';

/** A pop-up when a meeting reminder arrives, a little longer than an ordinary toast. */
export function useMeetingToasts(me: string | undefined, ws: string | undefined) {
  const qc = useQueryClient();
  const { t } = useTranslation('integrations');
  const { language } = useLanguage();

  useEffect(() => {
    if (!me || !ws) return;
    let seen: Set<string> | null = null;
    return qc.getQueryCache().subscribe((event) => {
      const key = event.query.queryKey;
      if (key[0] !== 'notifications' || key[1] !== ws || key[2] !== me) return;
      if (event.type !== 'updated' || event.action.type !== 'success') return;
      const first = (
        event.query.state.data as
          InfiniteData<components['schemas']['NotificationPage']> | undefined
      )?.pages[0]?.items;
      if (!first) return;
      const fresh = new Set(freshIds(seen, first));
      for (const n of first) {
        if (n.kind !== 'meeting' || !fresh.has(n.id)) continue;
        const time = new Intl.DateTimeFormat(language, {
          hour: '2-digit',
          minute: '2-digit',
        }).format(new Date(n.body));
        useToastStore.getState().push({
          title: t('reminderToast.title'),
          description: t('reminderToast.body', { title: n.title, time }),
          durationMs: 12_000,
        });
      }
      seen = new Set(first.map((n) => n.id));
    });
  }, [qc, me, ws, t, language]);
}

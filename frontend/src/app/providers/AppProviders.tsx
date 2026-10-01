import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { useState, type ReactNode } from 'react';
import { useApplyTheme } from '@/shared/theme';
import { Toaster, TooltipProvider } from '@/shared/ui';

function ThemeSync() {
  useApplyTheme();
  return null;
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {/* "user" = honour prefers-reduced-motion for every framer animation. */}
      <MotionConfig reducedMotion="user">
        <TooltipProvider delayDuration={250} skipDelayDuration={100}>
          <ThemeSync />
          {children}
          <Toaster />
        </TooltipProvider>
      </MotionConfig>
    </QueryClientProvider>
  );
}

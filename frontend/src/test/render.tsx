import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { TooltipProvider } from '@/shared/ui';

export function renderWithProviders(
  ui: ReactElement,
  { route = '/', ...opts }: RenderOptions & { route?: string } = {},
) {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter
      initialEntries={[route]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <TooltipProvider>{children}</TooltipProvider>
    </MemoryRouter>
  );
  return render(ui, { wrapper: Wrapper, ...opts });
}

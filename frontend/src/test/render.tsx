import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TooltipProvider } from '@/shared/ui';

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
}

interface Options extends RenderOptions {
  route?: string;
  /** Route pattern for the element (e.g. "/invite/:token"); extra paths render their name for assertions. */
  path?: string;
  extraPaths?: string[];
  queryClient?: QueryClient;
}

export function renderWithProviders(
  ui: ReactElement,
  { route = '/', path, extraPaths = [], queryClient, ...opts }: Options = {},
) {
  const qc = queryClient ?? createTestQueryClient();
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter
        initialEntries={[route]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <TooltipProvider>
          {path ? (
            <Routes>
              <Route path={path} element={children} />
              {extraPaths.map((p) => (
                <Route key={p} path={p} element={<div data-testid="route">{p}</div>} />
              ))}
            </Routes>
          ) : (
            children
          )}
        </TooltipProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
  return { ...render(ui, { wrapper: Wrapper, ...opts }), queryClient: qc };
}

/** Minimal JSON Response helper for fetch mocks. */
export function json(status: number, body?: unknown, headers: Record<string, string> = {}) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

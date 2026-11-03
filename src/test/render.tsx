import type { ReactElement, ReactNode } from 'react';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

interface Options extends Omit<RenderOptions, 'wrapper'> {
  /** Initial history entry, so a test can render a route as if navigated to. */
  route?: string;
}

/**
 * Renders with the providers every component in this app assumes: a router and
 * a query client. Retries are off so a failing query fails the test promptly
 * instead of being retried into a timeout.
 */
export function renderWithProviders(
  ui: ReactElement,
  options: Options = {},
): RenderResult {
  const { route = '/', ...renderOptions } = options;

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

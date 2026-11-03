import type { ReactElement, ReactNode } from 'react';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DataProviderScope } from '../data/ProviderContext';
import type { DataProvider } from '../data/provider';

interface Options extends Omit<RenderOptions, 'wrapper'> {
  /** Initial history entry, so a test can render a route as if navigated to. */
  route?: string;
  /** Route pattern to mount under, when the component reads URL params. */
  path?: string;
  /** Stub provider. Components get this instead of the real one. */
  provider?: DataProvider;
}

/**
 * Renders with the providers every component in this app assumes: a router, a
 * query client, and a data provider. Query retries are off so a failing query
 * fails the test promptly instead of being retried into a timeout.
 */
export function renderWithProviders(
  ui: ReactElement,
  options: Options = {},
): RenderResult {
  const { route = '/', path, provider, ...renderOptions } = options;

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <DataProviderScope {...(provider ? { provider } : {})}>
          <MemoryRouter initialEntries={[route]}>
            {path ? (
              <Routes>
                <Route path={path} element={children} />
              </Routes>
            ) : (
              children
            )}
          </MemoryRouter>
        </DataProviderScope>
      </QueryClientProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

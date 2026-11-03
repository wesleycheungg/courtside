import { QueryClient } from '@tanstack/react-query';

/**
 * Defaults tuned for scores: data is stale almost immediately, but we do not
 * want a refetch storm on every window focus. Per-query polling for live games
 * arrives with the feed in M2.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10_000,
        gcTime: 5 * 60_000,
        retry: 1,
        refetchOnWindowFocus: true,
      },
    },
  });
}

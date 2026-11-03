import { useState } from 'react';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { DataProviderScope } from '../data/ProviderContext';
import { createQueryClient } from './queryClient';
import { routes } from './routes';

const router = createBrowserRouter(routes);

export function App() {
  // One client for the app's lifetime, created lazily so tests get a fresh one.
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <DataProviderScope>
        <RouterProvider router={router} />
      </DataProviderScope>
    </QueryClientProvider>
  );
}

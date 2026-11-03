import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { getProvider } from './provider';
import type { DataProvider } from './provider';

const ProviderContext = createContext<DataProvider | null>(null);

interface DataProviderScopeProps {
  /** Overridden in tests; defaults to whatever VITE_DATA_PROVIDER selects. */
  provider?: DataProvider;
  children: ReactNode;
}

/**
 * Makes the data provider injectable.
 *
 * Component tests pass a stub here rather than mocking the network or the
 * module graph, so what they exercise is the same code path production runs.
 */
export function DataProviderScope({ provider, children }: DataProviderScopeProps) {
  const value = useMemo(() => provider ?? getProvider(), [provider]);
  return <ProviderContext.Provider value={value}>{children}</ProviderContext.Provider>;
}

// A context plus its hook is the idiomatic pairing; splitting them across two
// files to satisfy fast-refresh would be worse than the warning.
// eslint-disable-next-line react-refresh/only-export-components
export function useDataProvider(): DataProvider {
  const provider = useContext(ProviderContext);
  if (!provider) {
    throw new Error('useDataProvider must be used inside a DataProviderScope');
  }
  return provider;
}

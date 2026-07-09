import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            gcTime: 5 * 60 * 1000,
            refetchOnWindowFocus: false,
            retry: (failureCount, error) => {
              // Don't retry on 4xx client errors — retry only on network / 5xx.
              const status = (error as { response?: { status?: number } })?.response?.status;
              if (status && status >= 400 && status < 500) return false;
              return failureCount < 2;
            },
          },
          mutations: {
            retry: false,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

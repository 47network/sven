'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useEffect, useState, type ReactNode } from 'react';
import { RealtimeProvider } from '@/components/RealtimeProvider';
import { setRuntimeReporter } from '@/lib/api';
import { setRuntimeHealth } from '@/lib/store';

export default function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  useEffect(() => {
    setRuntimeReporter((next) => setRuntimeHealth(next));
    setRuntimeHealth({ health: 'degraded', source: 'boot', message: 'Canvas UI connected; waiting for first API response.' });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <RealtimeProvider>
        {children}
      </RealtimeProvider>
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}

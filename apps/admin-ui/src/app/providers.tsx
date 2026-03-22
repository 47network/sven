'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useEffect, useState, type ReactNode } from 'react';
import { RealtimeProvider } from '@/components/RealtimeProvider';
import { GlobalSearch } from '@/components/GlobalSearch';
import { setRuntimeReporter } from '@/lib/api';
import { setRuntimeHealth } from '@/lib/store';

const ADMIN_REALTIME_ENABLED =
  process.env.NEXT_PUBLIC_ADMIN_REALTIME_ENABLED === '1'
  || process.env.ADMIN_REALTIME_ENABLED === '1';

export default function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  useEffect(() => {
    setRuntimeReporter((next) => setRuntimeHealth(next));
    setRuntimeHealth({ health: 'degraded', source: 'boot', message: 'Admin UI connected; waiting for first API response.' });
  }, []);

  const content = ADMIN_REALTIME_ENABLED ? (
    <RealtimeProvider>
      {children}
    </RealtimeProvider>
  ) : (
    children
  );

  return (
    <QueryClientProvider client={queryClient}>
      {content}
      <GlobalSearch />
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}

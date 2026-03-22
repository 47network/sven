'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMe } from '@/lib/hooks';

export default function HomePage() {
  const router = useRouter();
  const { data: me, isLoading } = useMe();

  useEffect(() => {
    if (isLoading || !me) return;
    const role = String(me.role || '').toLowerCase();
    if (role === 'admin' || role === 'operator') {
      router.replace('/overview');
      return;
    }
    if (typeof window !== 'undefined') {
      window.location.replace('/');
    }
  }, [isLoading, me, router]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-400">
      Routing to your workspace...
    </div>
  );
}

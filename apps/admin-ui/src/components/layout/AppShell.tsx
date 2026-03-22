'use client';

import { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import { useSidebar } from '@/lib/store';
import RuntimeBanner from '@/components/RuntimeBanner';

/** Pages that render without the chrome (sidebar + header). */
const BARE_PAGES = ['/login', '/setup', '/community-public'];
const ADMIN_BASE_PATH = process.env.NEXT_PUBLIC_ADMIN_BASE_PATH || process.env.ADMIN_BASE_PATH || '/admin47';

function normalizePath(pathname: string): string {
  if (!ADMIN_BASE_PATH || ADMIN_BASE_PATH === '/') return pathname;
  if (pathname === ADMIN_BASE_PATH) return '/';
  if (pathname.startsWith(`${ADMIN_BASE_PATH}/`)) {
    return pathname.slice(ADMIN_BASE_PATH.length) || '/';
  }
  return pathname;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { collapsed, mobileOpen, closeMobile } = useSidebar();
  const [pathname, setPathname] = useState(() => {
    if (typeof window === 'undefined') return '/';
    return window.location.pathname || '/';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sync = () => setPathname(window.location.pathname || '/');
    sync();
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('hashchange', sync);
    };
  }, []);

  const appPath = normalizePath(pathname || '/');
  const bare = BARE_PAGES.some((p) => appPath.startsWith(p));

  if (bare) return <>{children}</>;

  return (
    <>
      <Sidebar />
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={closeMobile}
          className="fixed inset-0 z-20 bg-slate-950/60 backdrop-blur-sm md:hidden"
        />
      )}
      <div
        className={`min-h-screen transition-[margin] duration-[var(--dur-base)] ${collapsed ? 'md:ml-[var(--sidebar-w-sm)]' : 'md:ml-[var(--sidebar-w)]'
          }`}
      >
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute -left-24 top-16 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
          <div className="absolute right-0 top-0 h-80 w-80 rounded-full bg-emerald-400/10 blur-3xl" />
        </div>
        <Header />
        <RuntimeBanner />
        <main className="p-4 sm:p-6">{children}</main>
      </div>
    </>
  );
}

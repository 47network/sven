'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  MessageSquare, Search, Shield, Moon, Sun, LogOut,
  Menu, ChevronLeft, Bot, PanelTopOpen, Sparkles, Cpu, User, PawPrint, Orbit
} from 'lucide-react';
import { useTheme, useSidebar } from '@/lib/store';
import { useMe } from '@/lib/hooks';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import PwaControls from '@/components/PwaControls';
import RuntimeBanner from '@/components/RuntimeBanner';

const NAV_ITEMS = [
  { label: 'Chats', href: '/', icon: MessageSquare },
  { label: 'Approvals', href: '/approvals', icon: Shield, roles: ['admin', 'operator'] },
  { label: 'Search', href: '/search', icon: Search },
];

type SvenAvatarMode = 'orb' | 'robot' | 'human' | 'animal';
type SvenVisualMode = 'futuristic' | 'classic';

const AVATAR_ORDER: SvenAvatarMode[] = ['orb', 'robot', 'human', 'animal'];
const AVATAR_META: Record<SvenAvatarMode, { label: string; icon: typeof Bot }> = {
  orb: { label: 'Orb', icon: Orbit },
  robot: { label: 'Robot', icon: Cpu },
  human: { label: 'Human', icon: User },
  animal: { label: 'Animal', icon: PawPrint },
};

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { dark, toggle: toggleTheme } = useTheme();
  const { collapsed, toggle: toggleSidebar } = useSidebar();
  const { data: me } = useMe();
  const [avatarMode, setAvatarMode] = useState<SvenAvatarMode>('orb');
  const [visualMode, setVisualMode] = useState<SvenVisualMode>('futuristic');
  const [motionEnabled, setMotionEnabled] = useState(true);
  const role = me?.role || '';
  const visibleNav = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedAvatar = window.localStorage.getItem('sven.avatar_mode') as SvenAvatarMode | null;
    const storedVisual = window.localStorage.getItem('sven.visual_mode') as SvenVisualMode | null;
    const storedMotion = window.localStorage.getItem('sven.motion_enabled');
    if (storedAvatar && AVATAR_ORDER.includes(storedAvatar)) setAvatarMode(storedAvatar);
    if (storedVisual === 'classic' || storedVisual === 'futuristic') setVisualMode(storedVisual);
    if (storedMotion === '0') setMotionEnabled(false);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-sven-visual', visualMode);
    document.documentElement.setAttribute('data-sven-motion', motionEnabled ? 'on' : 'off');
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('sven.avatar_mode', avatarMode);
      window.localStorage.setItem('sven.visual_mode', visualMode);
      window.localStorage.setItem('sven.motion_enabled', motionEnabled ? '1' : '0');
    }
  }, [avatarMode, visualMode, motionEnabled]);

  // Bare pages — no chrome
  if (pathname === '/login') {
    return <>{children}</>;
  }

  async function handleLogout() {
    await api.auth.logout();
    router.push('/login');
  }

  function goToAdmin() {
    if (typeof window !== 'undefined') {
      window.location.assign('/');
    }
  }

  function cycleAvatar() {
    const idx = AVATAR_ORDER.indexOf(avatarMode);
    setAvatarMode(AVATAR_ORDER[(idx + 1) % AVATAR_ORDER.length]);
  }

  const AvatarIcon = AVATAR_META[avatarMode].icon;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside
        className={cn(
          'flex flex-col border-r border-cyan-300/10 bg-slate-950/65 backdrop-blur-xl transition-[width] duration-200',
          collapsed ? 'w-[var(--sidebar-w-sm)]' : 'w-[var(--sidebar-w)]',
        )}
      >
        {/* Brand */}
        <div className="flex h-14 items-center gap-3 border-b border-[var(--border)] px-4">
          <img
            src="/icon-192.png"
            alt="Sven logo"
            className="h-7 w-7 shrink-0 rounded-lg object-cover shadow-[0_0_18px_rgba(255,67,199,0.42)]"
          />
          {!collapsed && (
            <div className="min-w-0">
              <span className="block truncate text-lg font-bold tracking-tight">Sven Canvas</span>
              <span className="block truncate text-[11px] text-cyan-300/80">Form: {AVATAR_META[avatarMode].label}</span>
            </div>
          )}
          <button
            onClick={toggleSidebar}
            className="ml-auto rounded p-1 text-[var(--fg-muted)] hover:bg-slate-200 dark:hover:bg-slate-700"
          >
            {collapsed ? <Menu className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
          {visibleNav.map((item) => {
            const active = item.href === '/'
              ? pathname === '/' || pathname.startsWith('/c/')
              : pathname.startsWith(item.href);
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  active
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-400'
                    : 'text-[var(--fg-muted)] hover:bg-slate-100 dark:hover:bg-slate-800',
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-[var(--border)] p-3 space-y-2">
          <PwaControls compact={collapsed} />
          <button
            onClick={goToAdmin}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--fg-muted)] hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Open Admin Console"
          >
            <PanelTopOpen className="h-4 w-4" />
            {!collapsed && <span>Admin Console</span>}
          </button>

          <button
            onClick={cycleAvatar}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--fg-muted)] hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <AvatarIcon className="h-4 w-4" />
            {!collapsed && <span>Sven Form: {AVATAR_META[avatarMode].label}</span>}
          </button>

          <button
            onClick={() => setVisualMode((v) => (v === 'futuristic' ? 'classic' : 'futuristic'))}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--fg-muted)] hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Sparkles className="h-4 w-4" />
            {!collapsed && <span>Visual: {visualMode === 'futuristic' ? 'Futuristic' : 'Classic'}</span>}
          </button>

          <button
            onClick={() => setMotionEnabled((v) => !v)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--fg-muted)] hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Sparkles className="h-4 w-4" />
            {!collapsed && <span>Motion: {motionEnabled ? 'On' : 'Off'}</span>}
          </button>

          <button
            onClick={toggleTheme}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--fg-muted)] hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {!collapsed && <span>{dark ? 'Light mode' : 'Dark mode'}</span>}
          </button>

          {me && (
            <div className="flex items-center gap-3 px-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-medium text-brand-700 dark:bg-brand-900 dark:text-brand-300">
                {me.username?.charAt(0).toUpperCase() ?? '?'}
              </div>
              {!collapsed && (
                <span className="flex-1 truncate text-sm text-[var(--fg)]">
                  {me.username}
                </span>
              )}
              <button
                onClick={handleLogout}
                className="rounded p-1 text-[var(--fg-muted)] hover:text-red-500"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="relative flex-1 overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-28 bg-gradient-to-b from-cyan-400/10 to-transparent" />
        <div className="relative z-10 flex items-center justify-between border-b border-cyan-300/10 px-4 py-2 text-xs text-[var(--fg-muted)]">
          <span className="premium-kicker"><Sparkles className="mr-1 h-3 w-3" /> Premium Session</span>
          <span>Encrypted transport • Account scoped</span>
        </div>
        <RuntimeBanner />
        {children}
      </main>
    </div>
  );
}

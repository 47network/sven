'use client';

import { useTheme, useSidebar } from '@/lib/store';
import { useActivateAccount, useAccounts, useMe, useUpdateCheckerDismiss, useUpdateCheckerStatus } from '@/lib/hooks';
import { Sun, Moon, Search, LogOut, Sparkles, Menu, ArrowUpRight } from 'lucide-react';
import { api, type UpdateCheckerStatus } from '@/lib/api';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import Avatar from './header/Avatar';
import AccountSelect from './header/AccountSelect';
import SearchPalette from './header/SearchPalette';

type AccountRow = {
  id: string;
  name: string;
  slug: string;
};

type CommandItem = {
  href: string;
  title: string;
  hint: string;
  roles?: string[];
};

const COMMANDS: CommandItem[] = [
  { href: '/overview', title: 'Overview', hint: 'System status and pulse' },
  { href: '/pairing', title: 'Pairing', hint: 'Device approvals queue', roles: ['admin', 'operator'] },
  { href: '/devices', title: 'Devices', hint: 'Device fleet, pairing, and command delivery', roles: ['admin', 'operator'] },
  { href: '/approvals', title: 'Approvals', hint: 'High-risk confirmations' },
  { href: '/runs', title: 'Tool Runs', hint: 'Execution telemetry' },
  { href: '/agent-analytics', title: 'Agent Analytics', hint: 'Per-agent success, latency, cost, alerts' },
  { href: '/users', title: 'Users', hint: 'Account access control', roles: ['admin'] },
  { href: '/integrations', title: 'Integrations', hint: 'External services and tokens' },
  { href: '/devices', title: 'Devices', hint: 'Register, pair, and control edge devices', roles: ['admin', 'operator'] },
  { href: '/deployment', title: 'Deployment', hint: 'Release, rollback, and runtime operations', roles: ['admin', 'operator'] },
  { href: '/widget', title: 'Widget', hint: 'Embeddable chat setup and snippets' },
  { href: '/incidents', title: 'Incidents', hint: 'Kill switch and lockdown', roles: ['admin', 'operator'] },
  { href: '/scheduler', title: 'Scheduler', hint: 'User-facing scheduled tasks', roles: ['admin', 'operator'] },
  { href: '/settings', title: 'Settings', hint: 'Runtime and policy defaults', roles: ['admin'] },
];

export default function Header() {
  const { dark, toggle } = useTheme();
  const { collapsed, openMobile } = useSidebar();
  const { data: me } = useMe();
  const isAuthenticated = Boolean(me?.id);
  const { data: accounts = [] } = useAccounts(isAuthenticated);
  const { data: updateStatus } = useUpdateCheckerStatus(isAuthenticated);
  const dismissUpdate = useUpdateCheckerDismiss();
  const activateAccount = useActivateAccount();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [updateOpen, setUpdateOpen] = useState(false);
  const activeOrgId = me?.active_organization_id || '';
  const role = String(me?.role || '');
  const update = (updateStatus as { data?: UpdateCheckerStatus } | undefined)?.data;
  const showUpdate = Boolean(update?.updateAvailable && update?.latestVersion);
  const latestNotes = String(update?.latestNotes || '').trim();
  const latestUrl = String(update?.latestUrl || '').trim();
  const publishedAt = update?.latestPublishedAt ? new Date(update.latestPublishedAt).toLocaleString() : null;
  const canvasUrl = process.env.NEXT_PUBLIC_CANVAS_URL || '/';

  const accountRows = accounts as AccountRow[];
  const allowed = (roles?: string[]) => !roles || roles.includes(role);
  const filteredCommands = useMemo(() => {
    const visibleCommands = COMMANDS.filter((command) => allowed(command.roles));
    const q = query.trim().toLowerCase();
    if (!q) return visibleCommands;
    return visibleCommands.filter((cmd) => {
      return cmd.title.toLowerCase().includes(q) || cmd.hint.toLowerCase().includes(q) || cmd.href.toLowerCase().includes(q);
    });
  }, [query, role]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!searchOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [searchOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!searchOpen) return;
    function onPaletteKey(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (filteredCommands.length ? (prev + 1) % filteredCommands.length : 0));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          filteredCommands.length ? (prev - 1 + filteredCommands.length) % filteredCommands.length : 0,
        );
        return;
      }
      if (e.key === 'Enter') {
        if (!filteredCommands.length) return;
        e.preventDefault();
        const selected = filteredCommands[Math.min(selectedIndex, filteredCommands.length - 1)];
        if (selected) handleOpenCommand(selected.href);
      }
    }
    window.addEventListener('keydown', onPaletteKey);
    return () => window.removeEventListener('keydown', onPaletteKey);
  }, [searchOpen, filteredCommands, selectedIndex]);

  async function handleLogout() {
    await api.auth.logout();
    if (typeof window !== 'undefined') {
      window.location.assign('/admin47/login');
    }
  }

  async function handleSwitchAccount(nextAccountId: string) {
    if (!nextAccountId || nextAccountId === activeOrgId) return;
    try {
      await activateAccount.mutateAsync(nextAccountId);
      toast.success('Active account updated');
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    } catch {
      toast.error('Failed to switch account');
    }
  }

  function handleOpenCommand(href: string) {
    setSearchOpen(false);
    setQuery('');
    if (typeof window !== 'undefined') {
      window.location.assign(`/admin47${href}`);
    }
  }

  return (
    <>
      <header
        className={`sticky top-0 z-20 flex items-center justify-between border-b border-slate-800/80 bg-slate-950/70 backdrop-blur transition-[padding] duration-[var(--dur-base)] px-4 md:px-6 h-[var(--header-h)] ${collapsed ? 'md:pl-[calc(var(--sidebar-w-sm)+1.5rem)]' : 'md:pl-[calc(var(--sidebar-w)+1.5rem)]'
          }`}
      >
        {/* Search */}
        <div className="flex items-center gap-2">
          <button
            onClick={openMobile}
            className="inline-flex md:hidden rounded-md border border-slate-700 p-2 text-slate-300 hover:border-cyan-400 hover:text-cyan-300"
            aria-label="Open navigation"
          >
            <Menu className="h-4 w-4" />
          </button>
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm text-slate-400 border-slate-700 hover:border-cyan-400"
          >
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">Search commands…</span>
            <kbd className="ml-6 hidden rounded border px-1.5 py-0.5 text-[10px] text-slate-400 sm:inline">Ctrl/⌘K</kbd>
          </button>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {showUpdate && (
            <div className="relative">
              <button
                onClick={() => setUpdateOpen((prev) => !prev)}
                className="hidden items-center gap-2 rounded-full border border-amber-400/60 bg-amber-500/10 px-3 py-1 text-xs text-amber-200 hover:bg-amber-500/20 sm:inline-flex"
              >
                Update available: {update?.latestVersion}
              </button>
              {updateOpen && (
                <div className="absolute right-0 mt-2 w-72 rounded-lg border border-slate-700 bg-slate-950/95 p-3 text-xs text-slate-200 shadow-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Update {update?.latestVersion}</span>
                    <span className="text-[10px] text-slate-500">{publishedAt || 'unknown date'}</span>
                  </div>
                  <div className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-slate-400">
                    {latestNotes || 'No release notes available.'}
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => update?.latestVersion && dismissUpdate.mutate(update.latestVersion)}
                      disabled={dismissUpdate.isPending}
                    >
                      Dismiss
                    </button>
                    {latestUrl && (
                      <a
                        href={latestUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-primary btn-sm inline-flex items-center gap-1"
                      >
                        View
                        <ArrowUpRight className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            onClick={toggle}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Toggle theme"
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <button
            onClick={() => (typeof window !== 'undefined' ? window.location.assign(canvasUrl) : null)}
            className="hidden items-center gap-1.5 rounded-md border border-cyan-500/40 px-2.5 py-1.5 text-xs text-cyan-300 hover:bg-cyan-500/10 sm:inline-flex"
            title="Open Sven Canvas"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Canvas
          </button>

          <AccountSelect
            accounts={accountRows}
            activeOrgId={activeOrgId}
            onSwitch={handleSwitchAccount}
            activatePending={activateAccount.isPending}
          />

          <Avatar me={me} />

          <button
            onClick={handleLogout}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-500 dark:hover:bg-slate-800"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <SearchPalette
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        query={query}
        setQuery={setQuery}
        filteredCommands={filteredCommands}
        selectedIndex={selectedIndex}
        onOpenCommand={handleOpenCommand}
      />
    </>
  );
}

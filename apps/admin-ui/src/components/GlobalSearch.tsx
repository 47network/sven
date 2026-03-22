'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { useMe } from '@/lib/hooks';

interface SearchResult {
  type: 'page' | 'approval' | 'run' | 'user' | 'chat' | 'workflow';
  title: string;
  description?: string;
  href: string;
  roles?: string[];
}

const PAGES: SearchResult[] = [
  { type: 'page', title: 'Overview', href: '/overview' },
  { type: 'page', title: 'Pairing', href: '/pairing', roles: ['admin', 'operator'] },
  { type: 'page', title: 'Devices', href: '/devices', roles: ['admin', 'operator'] },
  { type: 'page', title: 'Channels', href: '/channels', roles: ['admin', 'operator'] },
  { type: 'page', title: 'Users', href: '/users', roles: ['admin'] },
  { type: 'page', title: 'Chats', href: '/chats' },
  { type: 'page', title: 'Skills', href: '/skills' },
  { type: 'page', title: 'Registry', href: '/registry' },
  { type: 'page', title: 'SOULs', href: '/souls' },
  { type: 'page', title: 'Approvals', href: '/approvals' },
  { type: 'page', title: 'Tool Runs', href: '/runs' },
  { type: 'page', title: 'Memories', href: '/memories' },
  { type: 'page', title: 'Knowledge Graph', href: '/knowledge-graph' },
  { type: 'page', title: 'RAG', href: '/rag' },
  { type: 'page', title: 'LLM', href: '/llm' },
  { type: 'page', title: 'Agent Analytics', href: '/agent-analytics' },
  { type: 'page', title: 'Agent Routing', href: '/agent-routing' },
  { type: 'page', title: 'Setup Center', href: '/setup' },
  { type: 'page', title: 'Integrations', href: '/integrations' },
  { type: 'page', title: 'Widget', href: '/widget' },
  { type: 'page', title: 'Search Settings', href: '/search-settings' },
  { type: 'page', title: 'MCP Servers', href: '/mcp-servers' },
  { type: 'page', title: 'Accounts', href: '/accounts', roles: ['admin'] },
  { type: 'page', title: 'Community Hub', href: '/community', roles: ['admin', 'operator'] },
  { type: 'page', title: 'Secrets', href: '/secrets', roles: ['admin'] },
  { type: 'page', title: 'SSO', href: '/sso', roles: ['admin'] },
  { type: 'page', title: 'Backups', href: '/backup-restore', roles: ['admin', 'operator'] },
  { type: 'page', title: 'Devices', href: '/devices', roles: ['admin', 'operator'] },
  { type: 'page', title: 'Deployment', href: '/deployment', roles: ['admin', 'operator'] },
  { type: 'page', title: 'Editor', href: '/editor', roles: ['admin', 'operator'] },
  { type: 'page', title: 'Discovery', href: '/discovery', roles: ['admin', 'operator'] },
  { type: 'page', title: 'Scheduler', href: '/scheduler', roles: ['admin', 'operator'] },
  { type: 'page', title: 'Cron', href: '/cron', roles: ['admin', 'operator'] },
  { type: 'page', title: 'Email', href: '/email', roles: ['admin', 'operator'] },
  { type: 'page', title: 'Webhooks', href: '/webhooks', roles: ['admin', 'operator'] },
  { type: 'page', title: 'Improvements', href: '/improvements' },
  { type: 'page', title: 'Settings', href: '/settings', roles: ['admin'] },
  { type: 'page', title: 'Incidents', href: '/incidents', roles: ['admin', 'operator'] },
  { type: 'page', title: 'Policy Simulator', href: '/policy-simulator', roles: ['admin'] },
  { type: 'page', title: 'Trace View', href: '/trace-view', roles: ['admin'] },
  { type: 'page', title: 'Audit Verifier', href: '/audit-verifier', roles: ['admin'] },
  { type: 'page', title: 'Model Registry', href: '/model-registry', roles: ['admin'] },
  { type: 'page', title: 'Canary Rollouts', href: '/canary-rollouts', roles: ['admin'] },
  { type: 'page', title: 'Workflow Builder', href: '/workflow-builder', roles: ['admin'] },
  { type: 'page', title: 'Workflow Runs', href: '/workflow-runs', roles: ['admin'] },
];

function normalizeSearchType(raw: string): SearchResult['type'] {
  if (raw === 'approval' || raw === 'run' || raw === 'user' || raw === 'chat' || raw === 'workflow' || raw === 'page') {
    return raw;
  }
  return 'page';
}

export function GlobalSearch() {
  const [pathname, setPathname] = useState(() => {
    if (typeof window === 'undefined') return '/';
    return window.location.pathname || '/';
  });
  const normalizedPath = String(pathname || '').replace(/^\/admin47/, '') || '/';
  const isPublicRoute = normalizedPath === '/login' || normalizedPath === '/setup' || normalizedPath === '/community-public';
  const { data: me } = useMe(!isPublicRoute);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const [remoteResults, setRemoteResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const role = String(me?.role || '');
  const allowed = useCallback((roles?: string[]) => !roles || roles.includes(role), [role]);

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

  useEffect(() => {
    if (isPublicRoute && open) {
      setOpen(false);
    }
  }, [isPublicRoute, open]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelected(0);
      setRemoteResults([]);
    }
  }, [open]);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setRemoteResults([]);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    setIsSearching(true);
    const handle = window.setTimeout(async () => {
      try {
        const response = await api.globalSearch.query(term, 16);
        if (cancelled) return;
        const mapped = Array.isArray(response?.data)
          ? response.data
              .filter((row) => row && typeof row === 'object')
              .map((row) => ({
                type: normalizeSearchType(String(row.type || '')),
                title: String(row.title || ''),
                description: typeof row.description === 'string' ? row.description : undefined,
                href: String(row.href || '/'),
              }))
              .filter((row) => row.title.length > 0)
          : [];
        setRemoteResults(mapped);
      } catch {
        if (!cancelled) setRemoteResults([]);
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [query]);

  const availablePages = PAGES.filter((page) => allowed(page.roles));
  const pageResults = query.trim()
    ? availablePages.filter((p) => p.title.toLowerCase().includes(query.toLowerCase()))
    : availablePages;
  const results = query.trim().length >= 2 ? [...remoteResults, ...pageResults] : pageResults;

  const handleSelect = useCallback(
    (result: SearchResult) => {
      if (typeof window !== 'undefined') {
        const adminBasePath = '/admin47';
        const href = result.href.startsWith(adminBasePath)
          ? result.href
          : `${adminBasePath}${result.href}`;
        window.location.assign(href);
      }
      setOpen(false);
    },
    [],
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === 'Enter' && results[selected]) {
      handleSelect(results[selected]);
    }
  }

  if (isPublicRoute || !open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />

      <div className="relative w-full max-w-lg rounded-xl bg-white shadow-2xl dark:bg-slate-900">
        <div className="flex items-center gap-3 border-b px-4">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            ref={inputRef}
            className="flex-1 bg-transparent py-4 text-sm outline-none placeholder:text-slate-400"
            placeholder="Search pages, approvals, runs, users, chats…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(0);
            }}
            onKeyDown={handleKeyDown}
          />
          <button
            onClick={() => setOpen(false)}
            className="rounded-md border px-1.5 py-0.5 text-xs text-slate-400 hover:text-slate-600"
          >
            ESC
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {results.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-slate-400">
              No results for &ldquo;{query}&rdquo;
            </div>
          ) : (
            <>
              {query.trim().length >= 2 ? (
                <div className="px-3 pb-2 text-[11px] text-slate-400">
                  {isSearching ? 'Searching runs, approvals, users, chats…' : `Showing ${remoteResults.length} data results + page shortcuts`}
                </div>
              ) : null}
              <ul>
                {results.map((result, i) => (
                  <li key={`${result.type}:${result.href}:${result.title}`}>
                    <button
                      onClick={() => handleSelect(result)}
                      onMouseEnter={() => setSelected(i)}
                      className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors ${
                        i === selected
                          ? 'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-400'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <span className="text-left">
                        <span className="block">{result.title}</span>
                        {result.description ? <span className="block text-xs text-slate-400">{result.description}</span> : null}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 opacity-50" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

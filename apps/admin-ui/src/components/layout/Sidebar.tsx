'use client';

import { useEffect, useState } from 'react';
import { useSidebar } from '@/lib/store';
import { useMe, usePairingRequests } from '@/lib/hooks';
import {
  LayoutDashboard,
  Smartphone,
  Radio,
  Users,
  MessageSquare,
  Puzzle,
  Package,
  Sparkles,
  ShieldCheck,
  Play,
  Database,
  Cpu,
  Plug,
  Building2,
  KeyRound,
  HardDrive,
  Lightbulb,
  Settings,
  AlertTriangle,
  FlaskConical,
  ScanSearch,
  Globe,
  Link2,
  MessageCircleMore,
  Users2,
  Boxes,
  Network,
  GitBranch,
  Workflow,
  ListChecks,
  Clock3,
  Calendar,
  Mail,
  PanelLeftClose,
  PanelLeft,
  Radar,
  FileText,
  LineChart,
  MonitorSmartphone,
  BrainCircuit,
  Bot,
  Shield,
  BarChart3,
  Server,
  Gauge,
  Dna,
  Film,
  Video,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import SidebarBrand from './sidebar/SidebarBrand';
import SidebarStatus from './sidebar/SidebarStatus';
import NavItem from './sidebar/NavItem';

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles?: string[];
};

type NavGroup = {
  label: string;
  roles?: string[];
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Dashboard',
    items: [
      { href: '/overview', label: 'Overview', icon: LayoutDashboard },
      { href: '/analytics', label: 'Analytics', icon: BarChart3 },
    ],
  },
  {
    label: 'Communication',
    items: [
      { href: '/pairing', label: 'Pairing', icon: Smartphone, roles: ['admin', 'operator'] },
      { href: '/devices', label: 'Devices', icon: MonitorSmartphone, roles: ['admin', 'operator'] },
      { href: '/channels', label: 'Channels', icon: Radio, roles: ['admin', 'operator'] },
      { href: '/users', label: 'Users', icon: Users, roles: ['admin'] },
      { href: '/chats', label: 'Chats', icon: MessageSquare },
    ],
  },
  {
    label: 'Skills & Tools',
    items: [
      { href: '/skills', label: 'Skills', icon: Puzzle },
      { href: '/registry', label: 'Registry', icon: Package },
      { href: '/souls', label: 'SOULs', icon: Sparkles },
      { href: '/approvals', label: 'Approvals', icon: ShieldCheck },
      { href: '/runs', label: 'Tool Runs', icon: Play },
    ],
  },
  {
    label: 'Data & AI',
    items: [
      { href: '/memories', label: 'Memories', icon: Database },
      { href: '/rag', label: 'RAG', icon: Database },
      { href: '/knowledge-graph', label: 'Knowledge Graph', icon: Network },
      { href: '/llm', label: 'LLM', icon: Cpu },
      { href: '/council', label: 'LLM Council', icon: Users, roles: ['admin'] },
      { href: '/gpu-fleet', label: 'GPU Fleet', icon: Gauge, roles: ['admin'] },
      { href: '/agent-analytics', label: 'Agent Analytics', icon: LineChart },
      { href: '/agent-routing', label: 'Agent Routing', icon: Users },
      { href: '/ai-pipelines', label: 'AI Pipelines', icon: BrainCircuit },
      { href: '/brain', label: 'Brain Admin', icon: BrainCircuit },
      { href: '/improvements', label: 'Improvements', icon: Lightbulb },
    ],
  },
  {
    label: 'Community Agents',
    roles: ['admin', 'operator'],
    items: [
      { href: '/community-agents', label: 'Agent Management', icon: Bot, roles: ['admin', 'operator'] },
    ],
  },
  {
    label: 'Federation',
    roles: ['admin'],
    items: [
      { href: '/federation', label: 'Federation Hub', icon: Globe, roles: ['admin'] },
    ],
  },
  {
    label: 'Integrations',
    items: [
      { href: '/setup', label: 'Setup Center', icon: Sparkles },
      { href: '/integrations', label: 'Integrations', icon: Plug },
      { href: '/widget', label: 'Widget', icon: MessageCircleMore },
      { href: '/search-settings', label: 'Search Settings', icon: Globe },
      { href: '/mcp-servers', label: 'MCP Servers', icon: Link2 },
    ],
  },
  {
    label: 'Accounts',
    roles: ['admin'],
    items: [{ href: '/accounts', label: 'Accounts', icon: Building2, roles: ['admin'] }],
  },
  {
    label: 'Community',
    roles: ['admin', 'operator'],
    items: [{ href: '/community', label: 'Community Hub', icon: Users2, roles: ['admin', 'operator'] }],
  },
  {
    label: 'Security',
    roles: ['admin', 'operator'],
    items: [
      { href: '/secrets', label: 'Secrets', icon: KeyRound, roles: ['admin'] },
      { href: '/sso', label: 'SSO', icon: KeyRound, roles: ['admin'] },
      { href: '/incidents', label: 'Incidents', icon: AlertTriangle, roles: ['admin', 'operator'] },
    ],
  },
  {
    label: 'Operations',
    roles: ['admin', 'operator'],
    items: [
      { href: '/devices', label: 'Devices', icon: Smartphone, roles: ['admin', 'operator'] },
      { href: '/backup-restore', label: 'Backup & Restore', icon: HardDrive, roles: ['admin', 'operator'] },
      { href: '/deployment', label: 'Deployment', icon: Boxes, roles: ['admin', 'operator'] },
      { href: '/editor', label: 'Editor', icon: FileText, roles: ['admin', 'operator'] },
      { href: '/discovery', label: 'Discovery', icon: Radar, roles: ['admin', 'operator'] },
      { href: '/scheduler', label: 'Scheduler', icon: Calendar, roles: ['admin', 'operator'] },
      { href: '/cron', label: 'Cron', icon: Clock3, roles: ['admin', 'operator'] },
      { href: '/email', label: 'Email', icon: Mail, roles: ['admin', 'operator'] },
      { href: '/webhooks', label: 'Webhooks', icon: Link2, roles: ['admin', 'operator'] },
      { href: '/infrastructure', label: 'Infrastructure', icon: Server, roles: ['admin', 'operator'] },
      { href: '/settings', label: 'Settings', icon: Settings, roles: ['admin'] },
    ],
  },
  {
    label: 'Content',
    roles: ['admin', 'operator'],
    items: [
      { href: '/video-templates', label: 'Video Templates', icon: Film, roles: ['admin', 'operator'] },
      { href: '/render-queue', label: 'Render Queue', icon: Video, roles: ['admin', 'operator'] },
    ],
  },
  {
    label: 'Power',
    roles: ['admin'],
    items: [
      { href: '/policy-simulator', label: 'Policy Sim', icon: FlaskConical },
      { href: '/trace-view', label: 'Trace View', icon: ScanSearch },
      { href: '/audit-verifier', label: 'Audit Verifier', icon: Link2 },
      { href: '/model-registry', label: 'Model Registry', icon: Boxes },
      { href: '/canary-rollouts', label: 'Canary Rollouts', icon: GitBranch },
      { href: '/evolution', label: 'ASI-Evolve', icon: Dna, roles: ['admin'] },
      { href: '/workflow-builder', label: 'Workflow Builder', icon: Workflow },
      { href: '/workflow-runs', label: 'Workflow Runs', icon: ListChecks },
    ],
  },
];

export default function Sidebar() {
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
  const currentPath = pathname ?? '';
  const { collapsed, toggle, mobileOpen, closeMobile } = useSidebar();
  const { data: me } = useMe();
  const role = me?.role || '';
  const isAuthenticated = Boolean(me?.id);
  const pairing = usePairingRequests({ status: 'pending', limit: 200 }, isAuthenticated);
  const pendingPairings = Number(pairing.data?.data?.length || 0);
  const pairingUnavailable = Boolean(pairing.isError);

  const allowed = (roles?: string[]) => !roles || roles.includes(role);
  const visibleGroups = NAV_GROUPS.filter((g) => allowed(g.roles)).map((g) => ({
    ...g,
    items: g.items.filter((i) => allowed(i.roles)),
  })).filter((g) => g.items.length > 0);

  function matchesNavItem(href: string) {
    return currentPath === href || currentPath.startsWith(`${href}/`);
  }

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-30 flex flex-col border-r border-slate-800/80 bg-slate-950/90 backdrop-blur transition-transform duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 ${collapsed ? 'md:w-[var(--sidebar-w-sm)]' : 'md:w-[var(--sidebar-w)]'} w-72`}
      onKeyDown={(e) => {
        if (e.key === 'Escape') closeMobile();
      }}
    >
      <SidebarBrand collapsed={collapsed} />

      <SidebarStatus collapsed={collapsed} pairingUnavailable={pairingUnavailable} />

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2">
        {visibleGroups.map((group) => (
          <div key={group.label} className="mb-1">
            {!collapsed && (
              <div className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {group.label}
              </div>
            )}
            {group.items.map((item) => {
              const active = matchesNavItem(item.href);
              return (
                <NavItem
                  key={item.href}
                  item={item}
                  active={active}
                  collapsed={collapsed}
                  onClick={() => closeMobile()}
                  badge={item.href === '/pairing' ? pendingPairings : undefined}
                />
              );
            })}
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={toggle}
        className="hidden md:flex h-10 items-center justify-center border-t border-slate-800/80 text-slate-400 hover:bg-slate-900 hover:text-cyan-300"
      >
        {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
      </button>
    </aside>
  );
}

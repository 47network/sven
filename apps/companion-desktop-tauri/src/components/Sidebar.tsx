// src/components/Sidebar.tsx
import type { ReactNode } from 'react';
import {
    MessageSquare,
    ShieldCheck,
    Settings,
    Terminal,
    Activity,
    Cpu,
    BrainCircuit,
    Bot,
    Globe,
    UserCircle,
    Palette,
    Building2,
    Search,
} from 'lucide-react';
import svenIconUrl from '../../src-tauri/icons/icon.png';

export type NavTab = 'chat' | 'approvals' | 'inference' | 'ai-dashboard' | 'brain' | 'community-agents' | 'federation' | 'profile' | 'theme' | 'workspaces' | 'activity' | 'search' | 'settings' | 'log';

interface SidebarProps {
    active: NavTab;
    onNavigate: (tab: NavTab) => void;
    pendingApprovals: number;
    status: 'online' | 'degraded' | 'offline';
}

interface NavItem {
    id: NavTab;
    label: string;
    icon: ReactNode;
    badge?: number;
}

export function Sidebar({ active, onNavigate, pendingApprovals, status }: SidebarProps) {
    const items: NavItem[] = [
        { id: 'chat', label: 'Chat', icon: <MessageSquare size={18} /> },
        { id: 'approvals', label: 'Approvals', icon: <ShieldCheck size={18} />, badge: pendingApprovals },
        { id: 'inference', label: 'Local AI', icon: <Cpu size={18} /> },
        { id: 'ai-dashboard', label: 'AI Hub', icon: <BrainCircuit size={18} /> },
        { id: 'brain', label: 'Brain', icon: <BrainCircuit size={18} /> },
        { id: 'community-agents', label: 'Agents', icon: <Bot size={18} /> },
        { id: 'federation', label: 'Federation', icon: <Globe size={18} /> },
        { id: 'profile', label: 'Profile', icon: <UserCircle size={18} /> },
        { id: 'theme', label: 'Theme', icon: <Palette size={18} /> },
        { id: 'workspaces', label: 'Workspaces', icon: <Building2 size={18} /> },
        { id: 'activity', label: 'Activity', icon: <Activity size={18} /> },
        { id: 'search', label: 'Search', icon: <Search size={18} /> },
        { id: 'settings', label: 'Settings', icon: <Settings size={18} /> },
        { id: 'log', label: 'Log', icon: <Terminal size={18} /> },
    ];

    const statusColor =
        status === 'online' ? 'var(--ok)' :
            status === 'degraded' ? 'var(--warn)' : 'var(--danger)';

    return (
        <aside className="sidebar">
            {/* Brand */}
            <div className="sidebar-brand">
                <img className="sidebar-logo" src={svenIconUrl} alt="Sven" />
                <span className="sidebar-name">Sven</span>
            </div>

            {/* Nav items */}
            <nav className="sidebar-nav" aria-label="Main Navigation">
                {items.map(({ id, label, icon, badge }) => (
                    <button
                        key={id}
                        className={`nav-item${active === id ? ' active' : ''}`}
                        onClick={() => onNavigate(id)}
                        aria-current={active === id ? 'page' : undefined}
                    >
                        <span className="nav-icon" aria-hidden="true">{icon}</span>
                        <span className="nav-label">{label}</span>
                        {badge != null && badge > 0 && (
                            <span className="nav-badge" aria-label={`${badge} pending items`}>{badge > 99 ? '99+' : badge}</span>
                        )}
                    </button>
                ))}
            </nav>

            {/* Status footer */}
            <div className="sidebar-footer">
                <Activity size={13} style={{ color: statusColor, flexShrink: 0 }} />
                <span style={{ color: statusColor, fontSize: 11 }}>{status}</span>
            </div>
        </aside>
    );
}

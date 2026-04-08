// src/components/Sidebar.tsx
import type { ReactNode } from 'react';
import {
    MessageSquare,
    ShieldCheck,
    Settings,
    Terminal,
    Activity,
    Cpu,
} from 'lucide-react';
import svenIconUrl from '../../src-tauri/icons/icon.png';

export type NavTab = 'chat' | 'approvals' | 'inference' | 'settings' | 'log';

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
            <nav className="sidebar-nav">
                {items.map(({ id, label, icon, badge }) => (
                    <button
                        key={id}
                        className={`nav-item${active === id ? ' active' : ''}`}
                        onClick={() => onNavigate(id)}
                    >
                        <span className="nav-icon">{icon}</span>
                        <span className="nav-label">{label}</span>
                        {badge != null && badge > 0 && (
                            <span className="nav-badge">{badge > 99 ? '99+' : badge}</span>
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

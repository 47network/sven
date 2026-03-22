import Link from 'next/link';
import React from 'react';
import type { LucideIcon } from 'lucide-react';

type Item = { href: string; label: string; icon: LucideIcon };

export default function NavItem({ item, active, collapsed, onClick, badge }: { item: Item; active: boolean; collapsed: boolean; onClick: () => void; badge?: number; }) {
    const Icon = item.icon;
    return (
        <Link
            href={item.href}
            onClick={onClick}
            title={collapsed ? item.label : undefined}
            className={`mx-2 flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors ${active ? 'bg-cyan-500/15 text-cyan-300 font-medium' : 'text-slate-300 hover:bg-slate-800'
                }`}
        >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && (
                <span className="flex flex-1 items-center justify-between truncate">
                    {item.label}
                    {badge !== undefined && badge > 0 && (
                        <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white">
                            {badge}
                        </span>
                    )}
                </span>
            )}
        </Link>
    );
}

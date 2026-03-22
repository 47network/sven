import React from 'react';

export default function SidebarBrand({ collapsed }: { collapsed: boolean }) {
    return (
        <div className="flex h-14 items-center gap-2 border-b border-slate-800/80 px-4">
            <img
                src="/icon-192.png"
                alt="Sven logo"
                className="h-8 w-8 rounded-lg object-cover shadow-[0_0_20px_rgba(255,67,199,0.45)]"
            />
            {!collapsed && <span className="text-lg font-semibold tracking-tight">Sven Admin</span>}
        </div>
    );
}

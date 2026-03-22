import React from 'react';

type Me = { username?: string; active_organization_name?: string | null } | undefined;

export default function Avatar({ me }: { me?: Me }) {
    if (!me) return null;
    const activeOrgName = me.active_organization_name || '';

    return (
        <div className="flex items-center gap-2 text-sm">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-medium text-brand-700 dark:bg-brand-900 dark:text-brand-300">
                {me.username?.charAt(0).toUpperCase() ?? 'A'}
            </div>
            <div className="hidden min-w-0 sm:block">
                <div className="truncate text-slate-700 dark:text-slate-300">{me.username}</div>
                {activeOrgName && <div className="truncate text-[11px] text-cyan-300/90">{activeOrgName}</div>}
            </div>
        </div>
    );
}

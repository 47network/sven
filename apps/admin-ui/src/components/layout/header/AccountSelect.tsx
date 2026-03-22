import React from 'react';

type Props = {
    accounts?: { id: string; name: string; slug: string }[];
    activeOrgId: string;
    onSwitch: (id: string) => void;
    activatePending?: boolean;
};

export default function AccountSelect({ accounts = [], activeOrgId, onSwitch, activatePending }: Props) {
    if (!accounts || accounts.length === 0) return null;

    return (
        <select
            className="hidden rounded-md border border-slate-700 bg-slate-900/70 px-2 py-1.5 text-xs text-slate-200 md:block"
            value={activeOrgId}
            onChange={(e) => onSwitch(e.target.value)}
            disabled={activatePending}
            title="Active Account"
        >
            <option value="" disabled>
                Select account
            </option>
            {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                    {account.name} ({account.slug})
                </option>
            ))}
        </select>
    );
}

import React from 'react';
import { WifiOff, CheckCircle2 } from 'lucide-react';

export default function SidebarStatus({ collapsed, pairingUnavailable }: { collapsed: boolean; pairingUnavailable: boolean; }) {
    if (collapsed) return null;

    return (
        <div className="border-b border-slate-800/80 px-3 py-2">
            <div
                className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-medium ${pairingUnavailable
                    ? 'border-red-500/30 bg-red-500/10 text-red-300'
                    : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    }`}
                title={
                    pairingUnavailable
                        ? 'Pairing API unavailable. Menus continue in degraded-safe mode.'
                        : 'Pairing API operational'
                }
            >
                {pairingUnavailable ? <WifiOff className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                <span>{pairingUnavailable ? 'Pairing API unavailable' : 'Pairing API healthy'}</span>
            </div>
        </div>
    );
}

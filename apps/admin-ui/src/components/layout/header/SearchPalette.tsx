import React from 'react';
import { ArrowUpRight, Search } from 'lucide-react';

type CommandItem = { href: string; title: string; hint: string };

type Props = {
    open: boolean;
    onClose: () => void;
    query: string;
    setQuery: (q: string) => void;
    filteredCommands: CommandItem[];
    selectedIndex: number;
    onOpenCommand: (href: string) => void;
};

export default function SearchPalette({
    open,
    onClose,
    query,
    setQuery,
    filteredCommands,
    selectedIndex,
    onOpenCommand,
}: Props) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-sm" onClick={onClose}>
            <div className="mx-auto mt-20 w-full max-w-2xl px-4" onClick={(e) => e.stopPropagation()}>
                <div className="overflow-hidden rounded-2xl border border-cyan-400/25 bg-slate-900/95 shadow-2xl shadow-cyan-900/20">
                    <div className="flex items-center gap-2 border-b border-slate-800 px-3 py-2">
                        <Search className="h-4 w-4 text-cyan-300" />
                        <input
                            autoFocus
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Jump to page, command, or route..."
                            className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
                        />
                    </div>
                    <div className="max-h-80 overflow-y-auto p-2">
                        {filteredCommands.length === 0 ? (
                            <div className="rounded-lg px-3 py-2 text-sm text-slate-400">No matching command.</div>
                        ) : (
                            filteredCommands.map((cmd, idx) => (
                                <button
                                    key={cmd.href}
                                    onClick={() => onOpenCommand(cmd.href)}
                                    className={`group flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left ${idx === selectedIndex
                                            ? 'border-cyan-500/35 bg-cyan-500/10'
                                            : 'border-transparent hover:border-cyan-500/30 hover:bg-cyan-500/10'
                                        }`}
                                >
                                    <div>
                                        <div className="text-sm font-medium text-slate-100">{cmd.title}</div>
                                        <div className="text-[11px] text-slate-400">{cmd.hint}</div>
                                    </div>
                                    <div className="flex items-center gap-2 text-[11px] text-slate-500 group-hover:text-cyan-300">
                                        <span className="font-mono">{cmd.href}</span>
                                        <ArrowUpRight className="h-3.5 w-3.5" />
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

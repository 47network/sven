// src/panels/LogPanel.tsx
import { Terminal, Trash2 } from 'lucide-react';
import { PanelHeader } from '../components/PanelHeader';

interface LogPanelProps {
    logs: string[];
    onClear: () => void;
}

export function LogPanel({ logs, onClear }: LogPanelProps) {
    function levelClass(line: string): string {
        const lower = line.toLowerCase();
        if (lower.includes('fail') || lower.includes('error') || lower.includes('offline')) return 'log-entry error';
        if (lower.includes('warn') || lower.includes('degraded')) return 'log-entry warn';
        if (lower.includes('complet') || lower.includes('success') || lower.includes('stored') || lower.includes('saved') || lower.includes('online')) return 'log-entry ok';
        return 'log-entry';
    }

    return (
        <div className="panel">
            <PanelHeader
                title="Runtime Log"
                subtitle="Internal event trace — last 30 entries"
                action={
                    logs.length > 0 ? (
                        <button className="btn-ghost btn-sm" onClick={onClear} title="Clear log">
                            <Trash2 size={14} />
                        </button>
                    ) : undefined
                }
            />

            {logs.length === 0 ? (
                <div className="empty-state">
                    <Terminal size={32} className="empty-icon" />
                    <p>No log entries yet.</p>
                </div>
            ) : (
                <div className="log-list">
                    {logs.map((line, idx) => {
                        const sep = line.indexOf(' ');
                        const ts = sep > 0 ? line.substring(0, sep) : '';
                        const msg = sep > 0 ? line.substring(sep + 1) : line;
                        const time = ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
                        return (
                            <div key={`${idx}-${ts}`} className={levelClass(line)}>
                                {time && <span className="log-time">{time}</span>}
                                <span className="log-msg">{msg}</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// src/panels/ApprovalsPanel.tsx
import { ShieldCheck, ShieldX, ShieldAlert } from 'lucide-react';
import { PanelHeader } from '../components/PanelHeader';
import type { ApprovalItem } from '../lib/api';

interface ApprovalsPanelProps {
    approvals: ApprovalItem[];
    actioning: Record<string, 'approve' | 'deny'>;
    token: string;
    onVote: (id: string, decision: 'approve' | 'deny') => void;
}

export function ApprovalsPanel({ approvals, actioning, token, onVote }: ApprovalsPanelProps) {
    if (!token) {
        return (
            <div className="panel">
                <PanelHeader title="Approvals" subtitle="Review pending tool-use requests" />
                <div className="empty-state">
                    <ShieldAlert size={36} className="empty-icon" />
                    <p>Sign in to review pending approval requests.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="panel">
            <PanelHeader
                title="Approvals"
                subtitle={
                    approvals.length
                        ? `${approvals.length} request${approvals.length !== 1 ? 's' : ''} pending`
                        : 'No pending requests'
                }
            />

            {approvals.length === 0 ? (
                <div className="empty-state">
                    <ShieldCheck size={36} className="empty-icon ok" />
                    <p>All clear — no pending approvals.</p>
                </div>
            ) : (
                <div className="approval-list">
                    {approvals.slice(0, 10).map((item) => {
                        const busy = Boolean(actioning[item.id]);
                        return (
                            <div key={item.id} className="approval-card">
                                {/* Tool info */}
                                <div className="approval-info">
                                    <div className="approval-tool">
                                        <ShieldAlert size={14} className="approval-icon" />
                                        <span className="approval-tool-name">{item.tool_name || 'unknown tool'}</span>
                                        {item.scope && <span className="approval-scope">{item.scope}</span>}
                                    </div>
                                    {item.chat_id && (
                                        <div className="approval-meta">Chat: {item.chat_id.substring(0, 16)}…</div>
                                    )}
                                    {item.created_at && (
                                        <div className="approval-meta">
                                            {new Date(item.created_at).toLocaleString()}
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="approval-actions">
                                    <button
                                        className="btn-approve"
                                        onClick={() => onVote(item.id, 'approve')}
                                        disabled={busy}
                                    >
                                        <ShieldCheck size={14} />
                                        {actioning[item.id] === 'approve' ? 'Approving…' : 'Approve'}
                                    </button>
                                    <button
                                        className="btn-deny"
                                        onClick={() => onVote(item.id, 'deny')}
                                        disabled={busy}
                                    >
                                        <ShieldX size={14} />
                                        {actioning[item.id] === 'deny' ? 'Denying…' : 'Deny'}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

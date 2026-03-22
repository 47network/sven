// src/panels/ChatPanel.tsx
import { useEffect, useRef, useState } from 'react';
import { Send, RefreshCw, MessageSquare } from 'lucide-react';
import { PanelHeader } from '../components/PanelHeader';
import type { TimelineItem } from '../lib/api';

interface ChatPanelProps {
    chatId: string;
    token: string;
    timeline: TimelineItem[];
    sending: boolean;
    syncing: boolean;
    onSend: (text: string) => void;
    onRefresh: () => void;
}

export function ChatPanel({
    chatId,
    token,
    timeline,
    sending,
    syncing,
    onSend,
    onRefresh,
}: ChatPanelProps) {
    const [message, setMessage] = useState('');
    const bottomRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const canSend = Boolean(chatId.trim() && token.trim() && message.trim() && !sending);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [timeline]);

    // Auto-grow textarea
    function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
        setMessage(e.target.value);
        const el = e.target;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            if (canSend) handleSend();
        }
    }

    function handleSend() {
        if (!canSend) return;
        onSend(message.trim());
        setMessage('');
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
    }

    if (!token) {
        return (
            <div className="panel">
                <PanelHeader title="Chat" subtitle="Send and receive messages from Sven" />
                <div className="empty-state">
                    <MessageSquare size={36} className="empty-icon" />
                    <p>Sign in first to start chatting.</p>
                </div>
            </div>
        );
    }

    if (!chatId.trim()) {
        return (
            <div className="panel">
                <PanelHeader title="Chat" subtitle="Send and receive messages from Sven" />
                <div className="empty-state">
                    <MessageSquare size={36} className="empty-icon" />
                    <p>Set a Chat ID in Settings to load your conversation.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="panel chat-panel">
            <PanelHeader
                title="Chat"
                subtitle={`Chat ${chatId.substring(0, 12)}…`}
                action={
                    <button
                        className="btn-ghost btn-sm"
                        onClick={onRefresh}
                        disabled={syncing}
                        title="Refresh timeline"
                    >
                        <RefreshCw size={14} className={syncing ? 'spin' : ''} />
                    </button>
                }
            />

            {/* Message thread */}
            <div className="timeline">
                {timeline.length === 0 && (
                    <div className="empty-state">
                        <MessageSquare size={28} className="empty-icon" />
                        <p>No messages yet. Say hello!</p>
                    </div>
                )}
                {timeline.map((item) => (
                    <div key={item.id} className={`bubble-row ${item.role === 'user' ? 'user' : 'assistant'}`}>
                        <div className={`bubble ${item.role === 'user' ? 'bubble-user' : 'bubble-assistant'}`}>
                            <div className="bubble-text">{item.text || ''}</div>
                            {item.created_at && (
                                <div className="bubble-time">
                                    {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>

            {/* Composer */}
            <div className="composer">
                <textarea
                    ref={textareaRef}
                    className="composer-input"
                    rows={1}
                    value={message}
                    onChange={handleInput}
                    onKeyDown={handleKeyDown}
                    placeholder="Message Sven… (⌘↵ to send)"
                    disabled={sending}
                />
                <button
                    className="composer-send"
                    onClick={handleSend}
                    disabled={!canSend}
                    title="Send (⌘↵)"
                >
                    {sending ? (
                        <RefreshCw size={16} className="spin" />
                    ) : (
                        <Send size={16} />
                    )}
                </button>
            </div>
        </div>
    );
}

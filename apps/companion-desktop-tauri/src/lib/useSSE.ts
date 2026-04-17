/**
 * useSSE — Real-time Server-Sent Events (SSE) client for the Sven desktop companion.
 *
 * Replaces polling for chat timeline updates, approval notifications,
 * typing indicators, read receipts, call signals, and presence events.
 * Falls back to polling if SSE connection fails.
 *
 * Event types from the server:
 *   message        — new chat message
 *   approval       — approval created/updated
 *   agent_state    — agent processing state change
 *   agent_nudged   — agent was nudged
 *   typing         — user typing indicator
 *   read_receipt   — user read receipt
 *   call_signal    — WebRTC signaling (offer/answer/ICE)
 *   call_state     — call state change (ringing, active, ended)
 *   presence       — user presence update
 *   heartbeat      — keepalive (every ~15s)
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { TimelineItem, ApprovalItem } from './api';

export interface SSEEvent {
    type: string;
    data: Record<string, unknown>;
    timestamp?: string;
}

export interface SSEOptions {
    gatewayUrl: string;
    token: string;
    enabled: boolean;
    onMessage?: (item: TimelineItem) => void;
    onApproval?: (item: ApprovalItem) => void;
    onTyping?: (event: { chat_id: string; user_id: string; is_typing: boolean; display_name?: string }) => void;
    onReadReceipt?: (event: { chat_id: string; user_id: string; message_id: string }) => void;
    onCallSignal?: (event: { call_id: string; from_user_id: string; type: string; sdp?: string; candidate?: Record<string, unknown> }) => void;
    onCallState?: (event: { call_id: string; status: string; call_type?: string; chat_id?: string }) => void;
    onPresence?: (event: { user_id: string; status: string; status_message?: string }) => void;
    onLog?: (line: string) => void;
}

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 15000, 30000];

export function useSSE(opts: SSEOptions) {
    const [connected, setConnected] = useState(false);
    const [reconnectAttempt, setReconnectAttempt] = useState(0);
    const esRef = useRef<EventSource | null>(null);
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const optsRef = useRef(opts);
    useEffect(() => { optsRef.current = opts; }, [opts]);

    const log = useCallback((line: string) => {
        optsRef.current.onLog?.(`[SSE] ${line}`);
    }, []);

    const cleanup = useCallback(() => {
        if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
        }
        if (esRef.current) {
            esRef.current.close();
            esRef.current = null;
        }
        setConnected(false);
    }, []);

    const connect = useCallback(() => {
        const { gatewayUrl, token, enabled } = optsRef.current;
        if (!enabled || !token || !gatewayUrl) return;

        cleanup();

        const url = `${gatewayUrl}/v1/stream`;
        log(`Connecting to ${url}`);

        const es = new EventSource(url, {
            // EventSource doesn't support custom headers natively.
            // The token is sent via cookie (HttpOnly), or we use a
            // URL parameter for SSE specifically (server accepts both).
        } as EventSourceInit);

        // The server uses generic 'message' events with JSON payloads
        // that include a 'type' field.
        es.onmessage = (ev) => {
            try {
                const parsed = JSON.parse(ev.data) as SSEEvent;
                handleEvent(parsed);
            } catch {
                // Ignore unparseable events (e.g. heartbeat text)
            }
        };

        // Server may also send named events
        const eventTypes = [
            'message', 'approval', 'agent_state', 'agent_nudged',
            'typing', 'read_receipt', 'call_signal', 'call_state',
            'presence', 'heartbeat',
        ];
        for (const type of eventTypes) {
            es.addEventListener(type, (ev: Event) => {
                const me = ev as MessageEvent;
                try {
                    const data = JSON.parse(me.data);
                    handleEvent({ type, data });
                } catch {
                    // Ignore
                }
            });
        }

        es.onopen = () => {
            setConnected(true);
            setReconnectAttempt(0);
            log('Connected');
        };

        es.onerror = () => {
            setConnected(false);
            es.close();
            esRef.current = null;

            const attempt = reconnectAttempt;
            const delay = RECONNECT_DELAYS[Math.min(attempt, RECONNECT_DELAYS.length - 1)];
            log(`Connection lost. Reconnecting in ${delay}ms (attempt ${attempt + 1})`);
            setReconnectAttempt((prev) => prev + 1);

            reconnectTimerRef.current = setTimeout(() => {
                connect();
            }, delay);
        };

        esRef.current = es;
    }, [cleanup, log, reconnectAttempt]);

    const handleEvent = useCallback((ev: SSEEvent) => {
        const o = optsRef.current;
        switch (ev.type) {
            case 'message': {
                const item: TimelineItem = {
                    id: (ev.data.id as string) ?? '',
                    role: (ev.data.role as string) ?? (ev.data.sender_role as string),
                    text: (ev.data.text as string) ?? (ev.data.content as string),
                    created_at: (ev.data.created_at as string) ?? (ev.data.timestamp as string),
                };
                o.onMessage?.(item);

                // Desktop notification for incoming messages
                if (item.role !== 'user' && 'Notification' in window && Notification.permission === 'granted') {
                    new Notification('New message from Sven', {
                        body: (item.text ?? '').slice(0, 200),
                        tag: `msg-${item.id}`,
                    });
                }
                break;
            }
            case 'approval': {
                const item: ApprovalItem = {
                    id: (ev.data.id as string) ?? '',
                    status: ev.data.status as string,
                    tool_name: ev.data.tool_name as string,
                    scope: ev.data.scope as string,
                    chat_id: ev.data.chat_id as string,
                    created_at: ev.data.created_at as string,
                };
                o.onApproval?.(item);

                if ('Notification' in window && Notification.permission === 'granted') {
                    new Notification('Sven approval pending', {
                        body: `${item.tool_name ?? 'tool'} (${item.scope ?? 'scope'})`,
                        tag: `approval-${item.id}`,
                    });
                }
                break;
            }
            case 'typing':
                o.onTyping?.(ev.data as { chat_id: string; user_id: string; is_typing: boolean; display_name?: string });
                break;
            case 'read_receipt':
                o.onReadReceipt?.(ev.data as { chat_id: string; user_id: string; message_id: string });
                break;
            case 'call_signal':
                o.onCallSignal?.(ev.data as { call_id: string; from_user_id: string; type: string; sdp?: string; candidate?: Record<string, unknown> });

                // Notify on incoming call
                if ((ev.data.type as string) === 'offer' && 'Notification' in window && Notification.permission === 'granted') {
                    new Notification('Incoming call', {
                        body: `Call from ${(ev.data.from_user_id as string) ?? 'unknown'}`,
                        tag: `call-${ev.data.call_id as string}`,
                    });
                }
                break;
            case 'call_state':
                o.onCallState?.(ev.data as { call_id: string; status: string; call_type?: string; chat_id?: string });
                break;
            case 'presence':
                o.onPresence?.(ev.data as { user_id: string; status: string; status_message?: string });
                break;
            case 'heartbeat':
                // No-op — just keeps the connection alive
                break;
            default:
                // Unknown event type — log and ignore
                break;
        }
    }, []);

    // Connect when deps change
    useEffect(() => {
        if (opts.enabled && opts.token && opts.gatewayUrl) {
            connect();
        } else {
            cleanup();
        }
        return cleanup;
    }, [opts.enabled, opts.token, opts.gatewayUrl]);

    // Request notification permission on mount
    useEffect(() => {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().catch(() => undefined);
        }
    }, []);

    return { connected, reconnectAttempt };
}

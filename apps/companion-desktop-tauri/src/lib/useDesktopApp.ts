/**
 * useDesktopApp — centralises all state, effects and handlers for the Sven
 * desktop companion.  App.tsx becomes a thin render shell after this extract.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    clearSecret,
    devicePoll,
    deviceStart,
    fetchApprovals,
    fetchTimeline,
    getSecret,
    loadConfig,
    refreshSession,
    saveConfig,
    sendMessage,
    setSecret,
    voteApproval,
    inferenceCheckOllama,
    inferenceListModels,
    inferencePullModel,
    inferenceDeleteModel,
    inferenceGenerate,
    loadSavedAccounts,
    saveSavedAccounts,
    linkAccount,
    switchAccount,
    getOrCreateDeviceId,
    type ApprovalItem,
    type DesktopConfig,
    type InferenceResponse,
    type LocalModelInfo,
    type SavedAccount,
    type TimelineItem,
} from './api';
import type { NavTab } from '../components/Sidebar';

const MAX_LOG_LINES = 50;
const APPROVALS_INTERVAL_MS = 5_000;
const TIMELINE_INTERVAL_MS = 6_000;

export interface DesktopAppState {
    // Navigation
    activeTab: NavTab;
    setActiveTab: (tab: NavTab) => void;

    // Core data
    config: DesktopConfig;
    setConfig: (c: DesktopConfig) => void;
    token: string;
    status: 'online' | 'degraded' | 'offline';
    approvals: ApprovalItem[];
    timeline: TimelineItem[];

    // Device-flow auth
    deviceCode: string;
    verifyUrl: string;
    deviceBusy: boolean;

    // Loading flags
    sending: boolean;
    syncingTimeline: boolean;
    approvalActioning: Record<string, 'approve' | 'deny'>;

    // Debug log
    logs: string[];

    // On-device inference
    ollamaOnline: boolean;
    localModels: LocalModelInfo[];
    activeLocalModelId: string;
    lastInferenceResponse: InferenceResponse | null;
    pullingModel: boolean;
    generating: boolean;

    // Multi-account
    savedAccounts: SavedAccount[];
    pinLocked: boolean;

    // Handlers
    onSaveConfig: () => Promise<void>;
    onDeviceLogin: () => Promise<void>;
    onRefreshSession: () => Promise<void>;
    onSend: (text: string) => Promise<void>;
    onSignOut: () => Promise<void>;
    onRefreshTimeline: () => Promise<void>;
    onVoteApproval: (id: string, decision: 'approve' | 'deny') => Promise<void>;
    onClearLogs: () => void;
    onRefreshLocalModels: () => Promise<void>;
    onPullModel: (name: string) => Promise<void>;
    onDeleteModel: (name: string) => Promise<void>;
    onLocalGenerate: (prompt: string, model: string) => Promise<void>;
    setActiveLocalModelId: (id: string) => void;

    // Multi-account handlers
    onKeepSignedIn: (pin?: string) => Promise<void>;
    onSwitchAccount: (userId: string, pin?: string) => Promise<void>;
    onUnlinkAccount: (userId: string) => Promise<void>;
    onUnlockPin: (pin: string) => boolean;
}

export function useDesktopApp(): DesktopAppState {
    const [activeTab, setActiveTab] = useState<NavTab>('chat');
    const [config, setConfig] = useState<DesktopConfig>({
        gateway_url: 'https://app.sven.systems',
        chat_id: '',
        polling_enabled: true,
    });
    const [token, setToken] = useState('');
    const [status, setStatus] = useState<'online' | 'degraded' | 'offline'>('degraded');
    const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
    const [timeline, setTimeline] = useState<TimelineItem[]>([]);
    const [deviceCode, setDeviceCode] = useState('');
    const [verifyUrl, setVerifyUrl] = useState('');
    const [deviceBusy, setDeviceBusy] = useState(false);
    const [sending, setSending] = useState(false);
    const [syncingTimeline, setSyncingTimeline] = useState(false);
    const [approvalActioning, setApprovalActioning] = useState<Record<string, 'approve' | 'deny'>>({});
    const [logs, setLogs] = useState<string[]>([]);
    const [notifiedApprovalIds, setNotifiedApprovalIds] = useState<string[]>([]);

    const configRef = useRef(config);
    const tokenRef = useRef(token);
    useEffect(() => { configRef.current = config; }, [config]);
    useEffect(() => { tokenRef.current = token; }, [token]);

    const pushLog = useCallback((line: string) => {
        setLogs((prev) => [`${new Date().toISOString()} ${line}`, ...prev].slice(0, MAX_LOG_LINES));
    }, []);

    // ── Bootstrap: load persisted config + token ──────────
    useEffect(() => {
        (async () => {
            try {
                const cfg = await loadConfig();
                setConfig(cfg);
                const stored = await getSecret('access_token');
                if (stored) {
                    setToken(stored);
                    pushLog('Session restored from secure store.');
                } else {
                    setActiveTab('settings');
                }
            } catch (err) {
                pushLog(`Bootstrap failed: ${String(err)}`);
            }
        })();
    }, []);

    // ── Approvals polling ──────────────────────────────────
    useEffect(() => {
        if (!config.polling_enabled || !token) return;
        const id = setInterval(async () => {
            try {
                const rows = await fetchApprovals(config.gateway_url, token);
                setApprovals(rows ?? []);
                setStatus('online');
            } catch (err) {
                setStatus('degraded');
                pushLog(`Approvals poll failed: ${String(err)}`);
            }
        }, APPROVALS_INTERVAL_MS);
        return () => clearInterval(id);
    }, [config.polling_enabled, config.gateway_url, token, pushLog]);

    // ── Timeline polling ───────────────────────────────────
    useEffect(() => {
        if (!config.polling_enabled || !token || !config.chat_id.trim()) return;
        const id = setInterval(async () => {
            try {
                const rows = await fetchTimeline(config.gateway_url, config.chat_id, token, 24);
                setTimeline(rows ?? []);
            } catch (err) {
                pushLog(`Timeline poll failed: ${String(err)}`);
            }
        }, TIMELINE_INTERVAL_MS);
        return () => clearInterval(id);
    }, [config.polling_enabled, config.gateway_url, config.chat_id, token, pushLog]);

    // ── Block external navigation (security) ──────────────
    useEffect(() => {
        const originalOpen = window.open;
        window.open = () => null;
        const onClick = (e: MouseEvent) => {
            const anchor = (e.target as HTMLElement | null)?.closest('a[href]') as HTMLAnchorElement | null;
            if (!anchor) return;
            const href = anchor.getAttribute('href') ?? '';
            const allowed =
                href.startsWith('#') ||
                href.startsWith('tauri://') ||
                href.startsWith('http://localhost') ||
                href.startsWith('http://127.0.0.1');
            if (!allowed) {
                e.preventDefault();
                pushLog(`Blocked external navigation: ${href}`);
            }
        };
        window.addEventListener('click', onClick, true);
        return () => {
            window.open = originalOpen;
            window.removeEventListener('click', onClick, true);
        };
    }, [pushLog]);

    // ── Desktop notifications for new approvals ────────────
    useEffect(() => {
        if (!approvals.length) return;
        const unseen = approvals.filter((a) => a.id && !notifiedApprovalIds.includes(a.id));
        if (!unseen.length) return;
        if ('Notification' in window) {
            if (Notification.permission === 'default') {
                Notification.requestPermission().catch(() => undefined);
            }
            if (Notification.permission === 'granted') {
                for (const item of unseen.slice(0, 3)) {
                    // eslint-disable-next-line no-new
                    new Notification('Sven approval pending', {
                        body: `${item.tool_name ?? 'tool'} (${item.scope ?? 'scope'})`,
                    });
                }
            }
        }
        setNotifiedApprovalIds((prev) =>
            Array.from(new Set([...prev, ...unseen.map((u) => u.id)])).slice(-200),
        );
    }, [approvals, notifiedApprovalIds]);

    // ── Handlers ───────────────────────────────────────────
    const onSaveConfig = useCallback(async () => {
        const saved = await saveConfig(config);
        setConfig(saved);
        pushLog('Config saved.');
    }, [config, pushLog]);

    const onDeviceLogin = useCallback(async () => {
        setDeviceBusy(true);
        try {
            const started = await deviceStart(config.gateway_url);
            setDeviceCode(started.user_code);
            setVerifyUrl(started.verification_uri_complete ?? started.verification_uri);
            pushLog('Device login started. Awaiting authorization.');
            const nextToken = await devicePoll(config.gateway_url, started.device_code, started.interval ?? 5);
            await setSecret('access_token', nextToken);
            setToken(nextToken);
            setStatus('online');
            setDeviceCode('');
            setVerifyUrl('');
            pushLog('Device authorization complete. Token stored securely.');
        } catch (err) {
            setStatus('offline');
            pushLog(`Device login failed: ${String(err)}`);
        } finally {
            setDeviceBusy(false);
        }
    }, [config.gateway_url, pushLog]);

    const onRefreshSession = useCallback(async () => {
        if (!token) return;
        try {
            const next = await refreshSession(config.gateway_url, token);
            await setSecret('access_token', next);
            setToken(next);
            setStatus('online');
            pushLog('Session rotated successfully.');
        } catch (err) {
            setStatus('offline');
            pushLog(`Session refresh failed: ${String(err)}`);
        }
    }, [config.gateway_url, token, pushLog]);

    const onSend = useCallback(async (text: string) => {
        const { gateway_url, chat_id } = configRef.current;
        const tok = tokenRef.current;
        if (!text.trim() || !chat_id.trim() || !tok) return;
        setSending(true);
        try {
            await sendMessage(gateway_url, chat_id, tok, text);
            pushLog('Message sent.');
            setStatus('online');
            const rows = await fetchTimeline(gateway_url, chat_id, tok, 24);
            setTimeline(rows ?? []);
        } catch (err) {
            setStatus('degraded');
            pushLog(`Message send failed: ${String(err)}`);
        } finally {
            setSending(false);
        }
    }, [pushLog]);

    const onSignOut = useCallback(async () => {
        await clearSecret('access_token');
        setToken('');
        setApprovals([]);
        setTimeline([]);
        setActiveTab('settings');
        pushLog('Session cleared from secure store.');
    }, [pushLog]);

    const onRefreshTimeline = useCallback(async () => {
        const { gateway_url, chat_id } = configRef.current;
        const tok = tokenRef.current;
        if (!tok || !chat_id.trim()) return;
        setSyncingTimeline(true);
        try {
            const rows = await fetchTimeline(gateway_url, chat_id, tok, 30);
            setTimeline(rows ?? []);
            setStatus('online');
            pushLog('Timeline refreshed.');
        } catch (err) {
            setStatus('degraded');
            pushLog(`Timeline refresh failed: ${String(err)}`);
        } finally {
            setSyncingTimeline(false);
        }
    }, [pushLog]);

    const onVoteApproval = useCallback(async (approvalId: string, decision: 'approve' | 'deny') => {
        const tok = tokenRef.current;
        const { gateway_url } = configRef.current;
        if (!tok) return;
        setApprovalActioning((prev) => ({ ...prev, [approvalId]: decision }));
        try {
            await voteApproval(gateway_url, approvalId, tok, decision);
            const rows = await fetchApprovals(gateway_url, tok);
            setApprovals(rows ?? []);
            setStatus('online');
            pushLog(`Approval ${approvalId} voted ${decision}.`);
        } catch (err) {
            setStatus('degraded');
            pushLog(`Approval vote failed (${approvalId}): ${String(err)}`);
        } finally {
            setApprovalActioning((prev) => {
                const next = { ...prev };
                delete next[approvalId];
                return next;
            });
        }
    }, [pushLog]);

    const onClearLogs = useCallback(() => setLogs([]), []);

    // ── On-device inference state ─────────────────────────
    const [ollamaOnline, setOllamaOnline] = useState(false);
    const [localModels, setLocalModels] = useState<LocalModelInfo[]>([]);
    const [activeLocalModelId, setActiveLocalModelId] = useState('');
    const [lastInferenceResponse, setLastInferenceResponse] = useState<InferenceResponse | null>(null);
    const [pullingModel, setPullingModel] = useState(false);
    const [generating, setGenerating] = useState(false);

    const onRefreshLocalModels = useCallback(async () => {
        try {
            const online = await inferenceCheckOllama();
            setOllamaOnline(online);
            if (online) {
                const models = await inferenceListModels();
                setLocalModels(models);
                if (models.length > 0 && !activeLocalModelId) {
                    setActiveLocalModelId(models[0].id);
                }
                pushLog(`Ollama online, ${models.length} model(s) available.`);
            } else {
                setLocalModels([]);
                pushLog('Ollama offline.');
            }
        } catch (err) {
            setOllamaOnline(false);
            pushLog(`Ollama check failed: ${String(err)}`);
        }
    }, [pushLog, activeLocalModelId]);

    const onPullModel = useCallback(async (name: string) => {
        setPullingModel(true);
        try {
            pushLog(`Pulling model ${name}…`);
            const result = await inferencePullModel(name);
            pushLog(`Pull ${name}: ${result}`);
            await onRefreshLocalModels();
        } catch (err) {
            pushLog(`Pull ${name} failed: ${String(err)}`);
        } finally {
            setPullingModel(false);
        }
    }, [pushLog, onRefreshLocalModels]);

    const onDeleteModel = useCallback(async (name: string) => {
        try {
            await inferenceDeleteModel(name);
            pushLog(`Deleted model ${name}.`);
            if (activeLocalModelId === name) setActiveLocalModelId('');
            await onRefreshLocalModels();
        } catch (err) {
            pushLog(`Delete ${name} failed: ${String(err)}`);
        }
    }, [pushLog, onRefreshLocalModels, activeLocalModelId]);

    const onLocalGenerate = useCallback(async (prompt: string, model: string) => {
        setGenerating(true);
        setLastInferenceResponse(null);
        try {
            const resp = await inferenceGenerate({ prompt, model });
            setLastInferenceResponse(resp);
            pushLog(`Inference: ${resp.tokens_generated} tokens in ${resp.duration_ms}ms (${resp.tokens_per_second.toFixed(1)} tok/s)`);
        } catch (err) {
            pushLog(`Inference failed: ${String(err)}`);
        } finally {
            setGenerating(false);
        }
    }, [pushLog]);

    // Check Ollama on mount.
    useEffect(() => {
        onRefreshLocalModels();
    }, [onRefreshLocalModels]);

    // ── Multi-account state ───────────────────────────────
    const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
    const [pinLocked, setPinLocked] = useState(false);

    // Load saved accounts on mount
    useEffect(() => {
        loadSavedAccounts().then(setSavedAccounts).catch(() => {});
    }, []);

    const onKeepSignedIn = useCallback(async (pin?: string) => {
        const tok = tokenRef.current;
        const { gateway_url } = configRef.current;
        if (!tok) return;
        try {
            const deviceId = await getOrCreateDeviceId();
            await linkAccount(gateway_url, tok, deviceId, pin);

            // Save locally
            const userId = await getSecret('user_id') ?? 'unknown';
            const username = await getSecret('username') ?? userId;
            const accounts = await loadSavedAccounts();
            const existing = accounts.findIndex(a => a.userId === userId);
            const entry: SavedAccount = {
                userId,
                username,
                hasPin: Boolean(pin && pin.length >= 4),
                isActive: true,
            };
            if (existing >= 0) {
                accounts[existing] = entry;
            } else {
                accounts.push(entry);
            }
            // Mark others inactive
            for (const a of accounts) {
                if (a.userId !== userId) a.isActive = false;
            }
            await saveSavedAccounts(accounts);
            // Store token per account
            await setSecret(`access_token:${userId}`, tok);
            if (pin && pin.length >= 4) {
                await setSecret(`pin:${userId}`, pin);
            }
            setSavedAccounts(accounts);
            pushLog(`Account ${username} saved for quick switching.`);
        } catch (err) {
            pushLog(`Keep signed in failed: ${String(err)}`);
        }
    }, [pushLog]);

    const onSwitchAccount = useCallback(async (userId: string, pin?: string) => {
        const tok = tokenRef.current;
        const { gateway_url } = configRef.current;
        try {
            // Verify PIN locally if needed
            const accounts = await loadSavedAccounts();
            const target = accounts.find(a => a.userId === userId);
            if (target?.hasPin) {
                const storedPin = await getSecret(`pin:${userId}`);
                if (storedPin && pin !== storedPin) {
                    pushLog('Invalid PIN.');
                    return;
                }
            }

            const deviceId = await getOrCreateDeviceId();
            if (tok) {
                const result = await switchAccount(gateway_url, tok, deviceId, userId, pin);
                await setSecret('access_token', result.access_token);
                await setSecret(`access_token:${userId}`, result.access_token);
                if (result.user_id) await setSecret('user_id', result.user_id);
                if (result.username) await setSecret('username', result.username);
                setToken(result.access_token);
                setStatus('online');
            } else {
                // Fall back to stored token
                const stored = await getSecret(`access_token:${userId}`);
                if (stored) {
                    await setSecret('access_token', stored);
                    setToken(stored);
                }
            }

            // Update active flags
            for (const a of accounts) a.isActive = a.userId === userId;
            await saveSavedAccounts(accounts);
            setSavedAccounts([...accounts]);
            pushLog(`Switched to ${target?.username ?? userId}.`);
        } catch (err) {
            pushLog(`Account switch failed: ${String(err)}`);
        }
    }, [pushLog]);

    const onUnlinkAccount = useCallback(async (userId: string) => {
        const accounts = await loadSavedAccounts();
        const filtered = accounts.filter(a => a.userId !== userId);
        await saveSavedAccounts(filtered);
        await clearSecret(`access_token:${userId}`);
        await clearSecret(`pin:${userId}`);
        setSavedAccounts(filtered);
        pushLog(`Account ${userId} removed.`);
    }, [pushLog]);

    const onUnlockPin = useCallback((pin: string): boolean => {
        // Simple PIN check - for now just unlock
        if (pin.length >= 4) {
            setPinLocked(false);
            return true;
        }
        return false;
    }, []);

    return {
        activeTab, setActiveTab,
        config, setConfig,
        token, status,
        approvals, timeline,
        deviceCode, verifyUrl, deviceBusy,
        sending, syncingTimeline, approvalActioning,
        logs,
        ollamaOnline, localModels, activeLocalModelId,
        lastInferenceResponse, pullingModel, generating,
        savedAccounts, pinLocked,
        onSaveConfig, onDeviceLogin, onRefreshSession,
        onSend, onSignOut, onRefreshTimeline, onVoteApproval,
        onClearLogs,
        onRefreshLocalModels, onPullModel, onDeleteModel,
        onLocalGenerate, setActiveLocalModelId,
        onKeepSignedIn, onSwitchAccount, onUnlinkAccount, onUnlockPin,
    };
}

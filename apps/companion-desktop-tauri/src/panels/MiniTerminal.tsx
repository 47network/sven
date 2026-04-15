/**
 * D.2.7 — Mini-terminal popup panel.
 * Quick command input without opening the full Sven app.
 * Opens from tray menu or keyboard shortcut.
 * Sends message to the active chat, then auto-hides.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { getAllWindows } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';

export default function MiniTerminal() {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input on show
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, []);

  // Escape to hide
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        getCurrentWindow().hide().catch(() => undefined);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    setLastResult('');

    try {
      // Load config and token to send via the gateway
      const config = await invoke<{ gateway_url: string; chat_id: string }>('load_config');
      const token = await invoke<string | null>('get_secret', { key: 'access_token' });

      if (!token) {
        setLastResult('Not signed in. Open Sven to log in.');
        setSending(false);
        return;
      }

      if (!config.chat_id) {
        setLastResult('No active chat. Set chat ID in settings.');
        setSending(false);
        return;
      }

      await invoke('send_message', {
        gateway_url: config.gateway_url,
        chat_id: config.chat_id,
        bearer_token: token,
        text,
      });

      setInput('');
      setLastResult('Sent!');

      // Auto-hide after brief confirmation
      setTimeout(() => {
        getCurrentWindow().hide().catch(() => undefined);
        setLastResult('');
      }, 800);
    } catch (err) {
      setLastResult(`Error: ${String(err)}`);
    } finally {
      setSending(false);
    }
  }, [input, sending]);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(15, 15, 25, 0.95)',
        borderRadius: 12,
        border: '1px solid rgba(99, 102, 241, 0.3)',
        overflow: 'hidden',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          borderBottom: '1px solid rgba(99, 102, 241, 0.15)',
          fontSize: 11,
          color: '#94a3b8',
          cursor: 'default',
        }}
        data-tauri-drag-region
      >
        <span style={{ color: '#6366f1', fontWeight: 700 }}>⌘</span>
        <span>Sven Quick Command</span>
        <span style={{ marginLeft: 'auto', fontSize: 9, opacity: 0.5 }}>Esc to close</span>
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '8px 12px', gap: 8 }}>
        <span style={{ color: '#6366f1', fontWeight: 700, fontSize: 14 }}>❯</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Sven anything…"
          disabled={sending}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#e2e8f0',
            fontSize: 14,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
          }}
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          style={{
            background: sending ? '#4b5563' : '#6366f1',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            padding: '4px 12px',
            fontSize: 12,
            fontWeight: 600,
            cursor: sending ? 'wait' : 'pointer',
            opacity: !input.trim() ? 0.4 : 1,
          }}
        >
          {sending ? '…' : 'Send'}
        </button>
      </form>

      {/* Result */}
      {lastResult && (
        <div
          style={{
            padding: '4px 12px 8px',
            fontSize: 11,
            color: lastResult.startsWith('Error') ? '#f87171' : '#10b981',
          }}
        >
          {lastResult}
        </div>
      )}
    </div>
  );
}

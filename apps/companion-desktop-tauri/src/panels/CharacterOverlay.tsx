/**
 * D.2.1 — Character overlay component.
 * Rendered in the transparent always-on-top overlay window.
 * D.2.3 — Click character → focus main Sven chat panel.
 * D.3.1-D.3.4 — Cross-platform overlay positioning (bottom-right above taskbar).
 *
 * Receives agent state via CustomEvent dispatched from the main window SSE stream.
 * Falls back to idle state when no events received.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { getAllWindows } from '@tauri-apps/api/window';
import { PhysicalPosition } from '@tauri-apps/api/dpi';

export type CharacterState = 'idle' | 'thinking' | 'working' | 'celebrating' | 'sleeping' | 'error';

const STATE_COLORS: Record<CharacterState, string> = {
  idle: '#6366f1',
  thinking: '#f59e0b',
  working: '#3b82f6',
  celebrating: '#10b981',
  sleeping: '#94a3b8',
  error: '#ef4444',
};

const STATE_LABELS: Record<CharacterState, string> = {
  idle: 'Ready',
  thinking: 'Thinking…',
  working: 'Working…',
  celebrating: 'Done!',
  sleeping: 'Idle',
  error: 'Error',
};

// Inline SVG character — will be replaced by Lottie/Rive assets when D.1.x is completed
function CharacterAvatar({ state }: { state: CharacterState }) {
  const color = STATE_COLORS[state];
  const isAnimated = state === 'thinking' || state === 'working';

  return (
    <svg
      viewBox="0 0 80 100"
      className="character-avatar"
      style={{
        width: 80,
        height: 100,
        filter: `drop-shadow(0 2px 8px ${color}40)`,
        animation: isAnimated ? 'sven-bounce 1s ease-in-out infinite' : undefined,
      }}
    >
      {/* Body */}
      <ellipse cx="40" cy="65" rx="28" ry="30" fill={color} opacity="0.15" />
      {/* Head */}
      <circle cx="40" cy="35" r="22" fill={color} />
      {/* Eyes */}
      <circle cx="33" cy="32" r="3" fill="white" />
      <circle cx="47" cy="32" r="3" fill="white" />
      <circle cx="33" cy="32" r="1.5" fill="#1e1e2e" />
      <circle cx="47" cy="32" r="1.5" fill="#1e1e2e" />
      {/* Mouth — changes with state */}
      {state === 'celebrating' && (
        <path d="M32 42 Q40 50 48 42" stroke="white" strokeWidth="2" fill="none" />
      )}
      {state === 'error' && (
        <path d="M32 46 Q40 40 48 46" stroke="white" strokeWidth="2" fill="none" />
      )}
      {(state === 'idle' || state === 'sleeping') && (
        <line x1="35" y1="43" x2="45" y2="43" stroke="white" strokeWidth="2" strokeLinecap="round" />
      )}
      {(state === 'thinking' || state === 'working') && (
        <ellipse cx="40" cy="44" rx="4" ry="3" fill="white" opacity="0.6" />
      )}
      {/* Thinking dots */}
      {state === 'thinking' && (
        <>
          <circle cx="60" cy="20" r="3" fill={color} opacity="0.4">
            <animate attributeName="opacity" values="0.2;0.8;0.2" dur="1.5s" repeatCount="indefinite" />
          </circle>
          <circle cx="66" cy="12" r="2" fill={color} opacity="0.3">
            <animate attributeName="opacity" values="0.1;0.6;0.1" dur="1.5s" begin="0.3s" repeatCount="indefinite" />
          </circle>
          <circle cx="70" cy="6" r="1.5" fill={color} opacity="0.2">
            <animate attributeName="opacity" values="0.1;0.5;0.1" dur="1.5s" begin="0.6s" repeatCount="indefinite" />
          </circle>
        </>
      )}
      {/* Sleep z's */}
      {state === 'sleeping' && (
        <text x="58" y="22" fontSize="14" fill={color} opacity="0.5" fontWeight="bold">
          z
          <animate attributeName="opacity" values="0;0.5;0" dur="2s" repeatCount="indefinite" />
        </text>
      )}
    </svg>
  );
}

export default function CharacterOverlay() {
  const [state, setState] = useState<CharacterState>('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Listen for agent state events forwarded from main window
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;

      const agentState = String(detail.state || detail.status || '').toLowerCase();
      const msg = String(detail.message || detail.task || '');

      if (agentState.includes('process') || agentState.includes('think') || agentState.includes('deliberat')) {
        setState('thinking');
      } else if (agentState.includes('execut') || agentState.includes('running') || agentState.includes('work')) {
        setState('working');
      } else if (agentState.includes('complete') || agentState.includes('success') || agentState.includes('done')) {
        setState('celebrating');
        // Auto-return to idle after celebration
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        idleTimerRef.current = setTimeout(() => setState('idle'), 4000);
      } else if (agentState.includes('error') || agentState.includes('fail')) {
        setState('error');
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        idleTimerRef.current = setTimeout(() => setState('idle'), 6000);
      } else if (agentState.includes('idle') || agentState.includes('wait')) {
        setState('idle');
      }

      if (msg) setStatusMsg(msg);
    };

    window.addEventListener('sven-agent-state', handler);
    return () => window.removeEventListener('sven-agent-state', handler);
  }, []);

  // Listen for state events via Tauri event system (cross-window)
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    const currentWindow = getCurrentWindow();
    currentWindow.listen<{ state: string; message?: string }>('agent-state-update', (event) => {
      const { state: s, message: m } = event.payload;
      window.dispatchEvent(new CustomEvent('sven-agent-state', { detail: { state: s, message: m } }));
    }).then((fn) => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, []);

  // D.2.3 — Click character → show and focus main window
  const handleClick = useCallback(async () => {
    if (isDragging) return;
    try {
      const windows = await getAllWindows();
      const mainWindow = windows.find((w) => w.label === 'main');
      if (mainWindow) {
        await mainWindow.show();
        await mainWindow.setFocus();
      }
    } catch {
      // Best effort — window may not exist
    }
  }, [isDragging]);

  // Drag to reposition overlay
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    dragStart.current = { x: e.screenX, y: e.screenY };
    setIsDragging(false);
  }, []);

  const handleMouseMove = useCallback(async (e: React.MouseEvent) => {
    if (!dragStart.current) return;
    const dx = e.screenX - dragStart.current.x;
    const dy = e.screenY - dragStart.current.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      setIsDragging(true);
      try {
        const win = getCurrentWindow();
        const pos = await win.outerPosition();
        await win.setPosition(new PhysicalPosition(pos.x + dx, pos.y + dy));
        dragStart.current = { x: e.screenX, y: e.screenY };
      } catch {
        // Position API may fail silently
      }
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    dragStart.current = null;
    // Small delay before clearing drag flag so click doesn't fire
    setTimeout(() => setIsDragging(false), 50);
  }, []);

  return (
    <div
      className="overlay-root"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onClick={handleClick}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: isDragging ? 'grabbing' : 'pointer',
        userSelect: 'none',
        background: 'transparent',
      }}
    >
      <CharacterAvatar state={state} />
      <div
        style={{
          marginTop: 4,
          fontSize: 10,
          fontWeight: 600,
          color: STATE_COLORS[state],
          textAlign: 'center',
          textShadow: '0 1px 4px rgba(0,0,0,0.5)',
          maxWidth: 110,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {STATE_LABELS[state]}
      </div>
      {statusMsg && (
        <div
          style={{
            marginTop: 2,
            fontSize: 8,
            color: '#94a3b8',
            textAlign: 'center',
            textShadow: '0 1px 3px rgba(0,0,0,0.5)',
            maxWidth: 110,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {statusMsg}
        </div>
      )}
      <style>{`
        @keyframes sven-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .overlay-root { -webkit-app-region: no-drag; }
      `}</style>
    </div>
  );
}

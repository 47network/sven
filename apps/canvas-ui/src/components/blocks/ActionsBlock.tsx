'use client';

import { useMemo, useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

type RawButton = {
  id?: string;
  label?: string;
  title?: string;
  action?: string;
  type?: string;
  url?: string;
  command?: string;
  text?: string;
  value?: string;
  approval_id?: string;
  payload?: Record<string, unknown>;
  style?: string;
};

type NormalizedButton = {
  id: string;
  label: string;
  action: string;
  url?: string;
  command?: string;
  text?: string;
  approvalId?: string;
  payload?: Record<string, unknown>;
  style?: string;
};

interface ActionsBlockProps {
  content: unknown;
  metadata?: Record<string, unknown>;
  chatId?: string;
  messageId?: string;
}

function normalizeAction(raw?: string): string {
  const value = String(raw || '').trim().toLowerCase();
  if (value === 'deny' || value === 'reject') return 'reject';
  if (value === 'approve') return 'approve';
  if (value === 'open_link' || value === 'open' || value === 'link') return 'open_link';
  if (value === 'run_command' || value === 'command') return 'run_command';
  if (value === 'quick_reply' || value === 'reply') return 'reply';
  if (value === 'dismiss' || value === 'close') return 'dismiss';
  return value || 'action';
}

function normalizeButtons(input: unknown): NormalizedButton[] {
  const rawButtons: RawButton[] = [];
  if (Array.isArray(input)) rawButtons.push(...(input as RawButton[]));
  if (input && typeof input === 'object') {
    const obj = input as { buttons?: unknown };
    if (Array.isArray(obj.buttons)) rawButtons.push(...(obj.buttons as RawButton[]));
  }

  return rawButtons
    .map((btn, index) => {
      const label = String(btn.label || btn.title || btn.text || btn.id || '').trim();
      if (!label) return null;
      const action = normalizeAction(btn.action || btn.type || btn.id);
      const approvalId = btn.approval_id || (
        (action === 'approve' || action === 'reject')
          ? btn.value
          : undefined
      );
      const text = btn.text || (action === 'reply' ? btn.value : undefined);
      const command = btn.command || (action === 'run_command' ? btn.value : undefined);
      return {
        id: String(btn.id || `${label}-${index}`),
        label,
        action,
        url: btn.url,
        command,
        text,
        approvalId,
        payload: btn.payload,
        style: btn.style,
      } as NormalizedButton;
    })
    .filter((btn): btn is NormalizedButton => !!btn);
}

function actionStyle(action: string, style?: string): string {
  const normalized = style || action;
  if (normalized === 'approve' || normalized === 'primary') {
    return 'border-emerald-300/60 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700/60 dark:bg-emerald-950/40 dark:text-emerald-200';
  }
  if (normalized === 'reject' || normalized === 'danger') {
    return 'border-rose-300/60 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-200';
  }
  return 'border-[var(--border)] bg-white/80 text-[var(--fg)] hover:bg-slate-50 dark:bg-slate-900/40 dark:hover:bg-slate-800/60';
}

export function ActionsBlock({ content, chatId, messageId }: ActionsBlockProps) {
  const buttons = useMemo(() => normalizeButtons(content), [content]);
  const [clicked, setClicked] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || buttons.length === 0) return null;

  async function emitInteraction(button: NormalizedButton) {
    if (!chatId) return;
    try {
      await api.a2ui.interact(chatId, {
        event_type: 'action',
        payload: {
          message_id: messageId,
          action: button.action,
          button,
        },
      });
    } catch {
      // Interaction errors should not block button UX.
    }
  }

  async function handleClick(button: NormalizedButton) {
    const key = button.id;
    if (clicked[key] || busy[key]) return;
    setClicked((prev) => ({ ...prev, [key]: true }));
    setBusy((prev) => ({ ...prev, [key]: true }));

    try {
      if (button.action === 'open_link' && button.url) {
        window.open(button.url, '_blank', 'noopener,noreferrer');
      } else if ((button.action === 'approve' || button.action === 'reject') && button.approvalId) {
        await api.approvals.vote(button.approvalId, button.action === 'approve' ? 'approve' : 'deny');
      } else if (button.action === 'run_command' && button.command && chatId) {
        await api.chats.send(chatId, button.command);
      } else if (button.action === 'reply' && button.text && chatId) {
        await api.chats.send(chatId, button.text);
      } else if (button.action === 'dismiss') {
        setDismissed(true);
      }

      await emitInteraction(button);
    } catch (err) {
      toast.error('Action failed');
    } finally {
      setBusy((prev) => ({ ...prev, [key]: false }));
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {buttons.map((button) => {
        const key = button.id;
        const isBusy = Boolean(busy[key]);
        const isClicked = Boolean(clicked[key]);
        return (
          <button
            key={key}
            type="button"
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${actionStyle(button.action, button.style)} ${
              isClicked ? 'opacity-70' : ''
            }`}
            disabled={isClicked || isBusy}
            onClick={() => void handleClick(button)}
          >
            {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            <span>{button.label}</span>
            {button.action === 'open_link' && button.url ? <ExternalLink className="h-3.5 w-3.5" /> : null}
          </button>
        );
      })}
    </div>
  );
}

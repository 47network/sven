type SessionMemoryRow = {
  chat_id?: string | null;
  key?: string | null;
  value?: string | null;
  updated_at?: string | Date | null;
};

function shortChatId(chatId: string): string {
  const trimmed = String(chatId || '').trim();
  if (!trimmed) return 'unknown-chat';
  return trimmed.length <= 8 ? trimmed : trimmed.slice(0, 8);
}

function compactText(input: string, maxLen = 220): string {
  const normalized = String(input || '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLen) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLen - 1)).trimEnd()}...`;
}

export function formatStitchDate(value: string | Date | null | undefined): string {
  if (!value) return 'unknown date';
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return 'unknown date';
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function buildSessionStitchingPrompt(rows: SessionMemoryRow[]): string {
  const cleaned = rows
    .filter((row) => row && typeof row === 'object')
    .map((row) => {
      const snippet = compactText(String(row.value || ''));
      if (!snippet) return null;
      return {
        chatId: shortChatId(String(row.chat_id || '')),
        date: formatStitchDate(row.updated_at || null),
        snippet,
      };
    })
    .filter((row): row is { chatId: string; date: string; snippet: string } => row !== null);

  if (cleaned.length === 0) return '';

  const bullets = cleaned.map((row) => `- ${row.date} (chat ${row.chatId}): ${row.snippet}`).join('\n');
  return [
    'Cross-session continuity context:',
    bullets,
    'Use these prior-session notes only when relevant to the current user request.',
  ].join('\n');
}


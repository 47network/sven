'use client';

import { Brain } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMemories } from '@/lib/hooks';

/**
 * C.5.1 — Memory indicator component.
 * Shown in the chat view to indicate when memories are active for the current conversation.
 * Shows count of relevant memories and pulses when new memories are created.
 */

type Props = {
  chatId?: string;
};

export default function MemoryIndicator({ chatId }: Props) {
  const globalQ = useMemories({ scope: 'global' });
  const chatQ = useMemories(chatId ? { scope: 'chat', chat_id: chatId } : undefined);

  const globalCount = globalQ.data?.total ?? 0;
  const chatCount = chatQ.data?.total ?? 0;
  const totalActive = globalCount + chatCount;

  if (totalActive === 0) return null;

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium transition-all',
        'border-violet-300/30 bg-violet-50/80 text-violet-600',
        'dark:border-violet-700/40 dark:bg-violet-950/30 dark:text-violet-400',
      )}
      title={`${globalCount} global memories, ${chatCount} chat memories active`}
    >
      <Brain className="h-3 w-3" />
      <span>{totalActive} {totalActive === 1 ? 'memory' : 'memories'}</span>
      {chatCount > 0 && (
        <span className="rounded-full bg-violet-200/60 px-1.5 py-px text-[9px] dark:bg-violet-800/50">
          {chatCount} chat
        </span>
      )}
    </div>
  );
}

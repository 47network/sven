import { v7 as uuidv7 } from 'uuid';

type Queryable = {
  query: (text: string, values?: unknown[]) => Promise<unknown>;
};

export async function upsertChatMember(
  db: Queryable,
  input: { chatId: string; userId: string; role?: 'admin' | 'member' | 'owner' },
): Promise<void> {
  const role = input.role ?? 'member';
  await db.query(
    `INSERT INTO chat_members (id, chat_id, user_id, role, joined_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (chat_id, user_id) DO NOTHING`,
    [uuidv7(), input.chatId, input.userId, role],
  );
}

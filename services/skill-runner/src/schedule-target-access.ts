type QueryResult = {
  rows: Array<Record<string, unknown>>;
};

type PgPoolLike = {
  query: (sql: string, params?: unknown[]) => Promise<QueryResult>;
};

type ValidateScheduleTargetAccessInput = {
  userId: string;
  chatId?: string;
  agentId?: string;
};

export async function validateScheduleTargetAccess(
  pool: PgPoolLike,
  input: ValidateScheduleTargetAccessInput,
): Promise<{ ok: boolean; error?: string }> {
  const userId = String(input.userId || '').trim();
  const chatId = String(input.chatId || '').trim();
  const agentId = String(input.agentId || '').trim();

  if (chatId) {
    const memberRes = await pool.query(
      `SELECT 1
         FROM chat_members
        WHERE chat_id = $1
          AND user_id = $2
        LIMIT 1`,
      [chatId, userId],
    );
    if (memberRes.rows.length === 0) {
      return { ok: false, error: 'chat_id is not accessible to user_id' };
    }
  }

  if (agentId) {
    const agentRes = await pool.query(
      `SELECT 1
         FROM agents
        WHERE id = $1
          AND status = 'active'
        LIMIT 1`,
      [agentId],
    );
    if (agentRes.rows.length === 0) {
      return { ok: false, error: 'agent_id not found or inactive' };
    }

    if (chatId) {
      const sessionRes = await pool.query(
        `SELECT 1
           FROM agent_sessions
          WHERE agent_id = $1
            AND session_id = $2
          LIMIT 1`,
        [agentId, chatId],
      );
      if (sessionRes.rows.length === 0) {
        return { ok: false, error: 'agent_id is not linked to chat_id' };
      }
      return { ok: true };
    }

    const accessibleSessionRes = await pool.query(
      `SELECT 1
         FROM agent_sessions s
         JOIN chat_members cm ON cm.chat_id = s.session_id
        WHERE s.agent_id = $1
          AND cm.user_id = $2
        LIMIT 1`,
      [agentId, userId],
    );
    if (accessibleSessionRes.rows.length === 0) {
      return { ok: false, error: 'agent_id has no sessions accessible to user_id' };
    }
  }

  return { ok: true };
}

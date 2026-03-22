export type ToolRunInsertParams = {
  runId: string;
  toolName: string;
  chatId: string;
  userId?: string | null;
  approvalId?: string | null;
  inputsJson: string;
  prevHash: string;
  maxConcurrency: number;
};

type QueryResult = {
  rows: Array<Record<string, unknown>>;
};

type PgClientLike = {
  query: (sql: string, params?: unknown[]) => Promise<QueryResult>;
  release: () => void;
};

type PgPoolLike = {
  connect: () => Promise<PgClientLike>;
};

export async function tryInsertRunningToolRun(
  pool: PgPoolLike,
  params: ToolRunInsertParams,
): Promise<{ admitted: boolean }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `SELECT pg_advisory_xact_lock(hashtext($1)::bigint)`,
      [params.toolName],
    );
    const runningRes = await client.query(
      `SELECT COUNT(*)::int AS c FROM tool_runs WHERE tool_name = $1 AND status = 'running'`,
      [params.toolName],
    );
    const runningCount = Number(runningRes.rows[0]?.c || 0);
    if (runningCount >= params.maxConcurrency) {
      await client.query('ROLLBACK');
      return { admitted: false };
    }

    await client.query(
      `INSERT INTO tool_runs (id, tool_name, chat_id, user_id, approval_id, inputs, status, prev_hash, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'running', $7, NOW())`,
      [
        params.runId,
        params.toolName,
        params.chatId,
        params.userId || null,
        params.approvalId || null,
        params.inputsJson,
        params.prevHash,
      ],
    );
    await client.query('COMMIT');
    return { admitted: true };
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignore rollback errors; preserve original failure.
    }
    throw error;
  } finally {
    client.release();
  }
}

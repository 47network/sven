type QueryResult = {
  rowCount?: number | null;
};

type PgPoolLike = {
  query: (sql: string, params?: unknown[]) => Promise<QueryResult>;
};

type FinalizeToolRunInput = {
  runId: string;
  status: 'completed' | 'error';
  outputsJson: string;
  toolLogsJson: string | null;
  errorText: string | null;
  canonicalIoSha256: string;
  runHash: string;
};

export async function finalizeToolRunRecord(
  pool: PgPoolLike,
  input: FinalizeToolRunInput,
): Promise<void> {
  const updateRes = await pool.query(
    `UPDATE tool_runs
       SET status = $1,
           outputs = $2,
           tool_logs = $3,
           error = $4,
           canonical_io_sha256 = $5,
           run_hash = $6,
           completed_at = NOW()
     WHERE id = $7`,
    [
      input.status,
      input.outputsJson,
      input.toolLogsJson,
      input.errorText,
      input.canonicalIoSha256,
      input.runHash,
      input.runId,
    ],
  );

  if (updateRes.rowCount !== 1) {
    throw new Error(`Tool run finalization update failed: expected 1 row, got ${Number(updateRes.rowCount || 0)}`);
  }
}

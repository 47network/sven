import pg from 'pg';

export async function executePoolTransaction<T>(
  pool: Pick<pg.Pool, 'connect'>,
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignore rollback errors to preserve original exception surface.
    }
    throw error;
  } finally {
    client.release();
  }
}


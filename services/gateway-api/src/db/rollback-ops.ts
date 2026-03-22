import pg from 'pg';
import { createLogger } from '@sven/shared';

const logger = createLogger('db-rollback');

function migrationNameNoExt(file: string): string {
  return file.replace(/\.sql$/i, '');
}

export async function applyRollbackFile(
  client: Pick<pg.Client, 'query'>,
  file: string,
  sql: string,
): Promise<void> {
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query('DELETE FROM _migrations WHERE name = $1 OR name = $2', [
      file,
      migrationNameNoExt(file),
    ]);
    await client.query('COMMIT');
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      logger.error('Rollback file transaction rollback failed', {
        file,
        error: String(rollbackErr),
      });
    }
    throw err;
  }
}


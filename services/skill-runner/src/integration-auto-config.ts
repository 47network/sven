import type pg from 'pg';

type SettingEntry = { key: string; value: unknown };

export async function upsertOrgSettingsTransactional(
  pool: pg.Pool,
  organizationId: string,
  entries: SettingEntry[],
): Promise<void> {
  if (entries.length === 0) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const entry of entries) {
      await client.query(
        `INSERT INTO organization_settings (organization_id, key, value, updated_at, updated_by)
         VALUES ($1, $2, $3::jsonb, NOW(), NULL)
         ON CONFLICT (organization_id, key)
         DO UPDATE SET value = $3::jsonb, updated_at = NOW(), updated_by = NULL`,
        [organizationId, entry.key, JSON.stringify(entry.value)],
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Preserve original failure; rollback failure is logged by caller stack if needed.
    }
    throw err;
  } finally {
    client.release();
  }
}

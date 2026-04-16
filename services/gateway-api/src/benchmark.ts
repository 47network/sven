import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';

async function run() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres'
  });

  // Setup tables for benchmark
  await pool.query(`
    CREATE TABLE IF NOT EXISTS media_uploads (
      id TEXT PRIMARY KEY,
      message_id TEXT
    );
    CREATE TABLE IF NOT EXISTS message_attachments (
      id TEXT PRIMARY KEY,
      message_id TEXT,
      media_upload_id TEXT,
      sort_order INT,
      UNIQUE (message_id, media_upload_id)
    );
  `);
  await pool.query(`TRUNCATE TABLE media_uploads; TRUNCATE TABLE message_attachments;`);

  const N = 1000;
  const BATCH_SIZE = 20;

  console.time('baseline');
  for (let j = 0; j < N; j++) {
    const message_id = uuidv7();
    const media_ids = Array.from({length: BATCH_SIZE}, () => uuidv7());

    for (let id of media_ids) {
      await pool.query(`INSERT INTO media_uploads (id) VALUES ($1)`, [id]);
    }

    // The code we want to measure
    for (let i = 0; i < media_ids.length; i++) {
      await pool.query(
        `INSERT INTO message_attachments (id, message_id, media_upload_id, sort_order)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (message_id, media_upload_id) DO NOTHING`,
        [uuidv7(), message_id, media_ids[i], i],
      );

      // Link media to message
      await pool.query(
        `UPDATE media_uploads SET message_id = $1 WHERE id = $2`,
        [message_id, media_ids[i]],
      );
    }
  }
  console.timeEnd('baseline');

  await pool.query(`TRUNCATE TABLE media_uploads; TRUNCATE TABLE message_attachments;`);

  console.time('optimized');
  for (let j = 0; j < N; j++) {
    const message_id = uuidv7();
    const media_ids = Array.from({length: BATCH_SIZE}, () => uuidv7());

    for (let id of media_ids) {
      await pool.query(`INSERT INTO media_uploads (id) VALUES ($1)`, [id]);
    }

    // The code we want to measure
    if (media_ids.length > 0) {
      // Build batch insert query
      const insertValues: string[] = [];
      const insertParams: any[] = [];
      let paramIndex = 1;

      for (let i = 0; i < media_ids.length; i++) {
        insertValues.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
        insertParams.push(uuidv7(), message_id, media_ids[i], i);
      }

      await pool.query(
        `INSERT INTO message_attachments (id, message_id, media_upload_id, sort_order)
         VALUES ${insertValues.join(', ')}
         ON CONFLICT (message_id, media_upload_id) DO NOTHING`,
        insertParams,
      );

      // Batch update query
      const updateParams = [message_id, ...media_ids];
      const placeholders = media_ids.map((_, i) => `$${i + 2}`).join(', ');
      await pool.query(
        `UPDATE media_uploads SET message_id = $1 WHERE id IN (${placeholders})`,
        updateParams,
      );
    }
  }
  console.timeEnd('optimized');

  process.exit(0);
}
run().catch(console.error);

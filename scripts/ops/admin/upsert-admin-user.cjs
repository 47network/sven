#!/usr/bin/env node
/* eslint-disable no-console */
const { Client } = require('pg');
const bcrypt = require('bcrypt');
const { randomUUID } = require('crypto');

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
    out[key] = val;
  }
  return out;
}

async function run() {
  const args = parseArgs(process.argv);
  const username = String(args.username || '47').trim();
  const password = String(args.password || '').trim();
  const displayName = String(args.display_name || `Admin ${username}`).trim();

  if (!password || password.length < 8) {
    throw new Error('Password is required and must be at least 8 characters (--password).');
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required in environment.');
  }

  const client = new Client({ connectionString });
  await client.connect();
  try {
    const passwordHash = await bcrypt.hash(password, 12);

    const existing = await client.query('SELECT id FROM users WHERE username = $1 LIMIT 1', [username]);
    if (existing.rows.length > 0) {
      const id = existing.rows[0].id;
      await client.query(
        `UPDATE users
         SET display_name = $2,
             role = 'admin',
             password_hash = $3,
             updated_at = NOW()
         WHERE id = $1`,
        [id, displayName, passwordHash],
      );
      console.log(JSON.stringify({ success: true, action: 'updated', username, user_id: id }, null, 2));
      return;
    }

    const id = randomUUID();
    await client.query(
      `INSERT INTO users (id, username, display_name, role, password_hash, created_at, updated_at)
       VALUES ($1, $2, $3, 'admin', $4, NOW(), NOW())`,
      [id, username, displayName, passwordHash],
    );
    console.log(JSON.stringify({ success: true, action: 'created', username, user_id: id }, null, 2));
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error('upsert-admin-user failed:', err.message || err);
  process.exit(1);
});

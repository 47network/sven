const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { authenticator } = require('otplib');

function parseArg(flag, fallback = '') {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < process.argv.length) return process.argv[idx + 1];
  return fallback;
}

function parseBoolArg(flag) {
  return process.argv.includes(flag);
}

async function main() {
  const username = String(parseArg('--username', process.env.ADMIN_USERNAME || '47')).trim();
  const databaseUrl = String(parseArg('--database-url', process.env.DATABASE_URL || 'postgresql://sven:sven-dev-47@127.0.0.1:5432/sven')).trim();
  const issuer = String(parseArg('--issuer', 'Sven')).trim();
  const ensurePlatformAdmin = parseBoolArg('--ensure-platform-admin');

  if (!username) throw new Error('username is required');
  if (!databaseUrl) throw new Error('database-url is required');

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const res = await client.query(
      'SELECT id, username, role, totp_secret_enc FROM users WHERE username = $1 LIMIT 1',
      [username],
    );
    if (res.rows.length !== 1) {
      throw new Error(`user not found: ${username}`);
    }

    const user = res.rows[0];
    const currentRole = String(user.role || '').trim();
    if (!['admin', 'platform_admin'].includes(currentRole)) {
      throw new Error(`user is not admin-capable: ${username}`);
    }

    let effectiveRole = currentRole;
    if (ensurePlatformAdmin && currentRole !== 'platform_admin') {
      await client.query('UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2', ['platform_admin', user.id]);
      effectiveRole = 'platform_admin';
    }

    let secret = String(user.totp_secret_enc || '').trim();
    let provisioned = false;
    if (!secret) {
      secret = authenticator.generateSecret();
      await client.query('UPDATE users SET totp_secret_enc = $1, updated_at = NOW() WHERE id = $2', [secret, user.id]);
      provisioned = true;
    }

    const otpauth_url = authenticator.keyuri(username, issuer, secret);
    const current_code = authenticator.generate(secret);

    process.stdout.write(JSON.stringify({
      success: true,
      username,
      user_id: String(user.id),
      role: effectiveRole,
      platform_admin_ensured: ensurePlatformAdmin,
      provisioned,
      totp_secret: secret,
      otpauth_url,
      current_code,
    }, null, 2));
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((err) => {
  console.error(err?.message || String(err));
  process.exit(1);
});

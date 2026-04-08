import pg from 'pg';
import { createLogger } from '@sven/shared';
import bcrypt from 'bcrypt';
import { v7 as uuidv7 } from 'uuid';

const logger = createLogger('db-seed');

async function hasColumn(client: pg.Client, tableName: string, columnName: string): Promise<boolean> {
  const res = await client.query(
    `SELECT 1
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name = $2
      LIMIT 1`,
    [tableName, columnName],
  );
  return res.rows.length > 0;
}

async function seed() {
  const connectionString =
    process.env.DATABASE_URL || 'postgresql://sven:sven@localhost:5432/sven';

  const client = new pg.Client({ connectionString });
  await client.connect();
  logger.info('Connected to database for seeding');

  try {
    // ── Seed admin user "47" ──
    const adminUsername = process.env.ADMIN_USERNAME || '47';
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      logger.fatal('ADMIN_PASSWORD environment variable is required for seeding');
      process.exit(1);
    }

    const adminId = uuidv7();
    const passwordHash = await bcrypt.hash(adminPassword, 12);

    await client.query(
      `INSERT INTO users (id, username, display_name, role, password_hash, created_at, updated_at)
       VALUES ($1, $2, $3, 'admin', $4, NOW(), NOW())
       ON CONFLICT (username) DO NOTHING`,
      [adminId, adminUsername, `Admin ${adminUsername}`, passwordHash],
    );
    logger.info('Seeded admin user', { username: adminUsername });

    // Look up actual admin ID (may already exist)
    const adminRes = await client.query(`SELECT id FROM users WHERE username = $1`, [adminUsername]);
    const actualAdminId: string = adminRes.rows[0].id;

    // ── Ensure default organization baseline ──
    let organizationId = '';
    const orgCapabilities = {
      usersActiveOrganization: await hasColumn(client, 'users', 'active_organization_id'),
      chatsOrganization: await hasColumn(client, 'chats', 'organization_id'),
      permissionsOrganization: await hasColumn(client, 'permissions', 'organization_id'),
      allowlistsOrganization: await hasColumn(client, 'allowlists', 'organization_id'),
      registrySourcesOrganization: await hasColumn(client, 'registry_sources', 'organization_id'),
      registryPublishersOrganization: await hasColumn(client, 'registry_publishers', 'organization_id'),
    };

    if (orgCapabilities.usersActiveOrganization) {
      const currentOrgRes = await client.query(
        `SELECT active_organization_id
           FROM users
          WHERE id = $1`,
        [actualAdminId],
      );
      organizationId = String(currentOrgRes.rows[0]?.active_organization_id || '').trim();
    }

    if (!organizationId) {
      const membershipOrgRes = await client.query(
        `SELECT organization_id
           FROM organization_memberships
          WHERE user_id = $1
            AND status = 'active'
          ORDER BY created_at ASC, organization_id ASC
          LIMIT 1`,
        [actualAdminId],
      );
      organizationId = String(membershipOrgRes.rows[0]?.organization_id || '').trim();
    }

    if (!organizationId) {
      const ownedOrgRes = await client.query(
        `SELECT id
           FROM organizations
          WHERE owner_user_id = $1
          ORDER BY created_at ASC, id ASC
          LIMIT 1`,
        [actualAdminId],
      );
      organizationId = String(ownedOrgRes.rows[0]?.id || '').trim();
    }

    if (!organizationId) {
      const insertedOrgRes = await client.query(
        `INSERT INTO organizations (id, slug, name, owner_user_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         ON CONFLICT (slug) DO UPDATE
           SET owner_user_id = EXCLUDED.owner_user_id,
               updated_at = NOW()
         RETURNING id`,
        [uuidv7(), 'seed-admin-47', 'Seed Admin Workspace', actualAdminId],
      );
      organizationId = String(insertedOrgRes.rows[0]?.id || '').trim();
    }

    await client.query(
      `INSERT INTO organization_memberships (id, organization_id, user_id, role, status, created_at, updated_at)
       VALUES ($1, $2, $3, 'owner', 'active', NOW(), NOW())
       ON CONFLICT (organization_id, user_id) DO UPDATE
         SET role = EXCLUDED.role,
             status = EXCLUDED.status,
             updated_at = NOW()`,
      [uuidv7(), organizationId, actualAdminId],
    );

    if (orgCapabilities.usersActiveOrganization) {
      await client.query(
        `UPDATE users
            SET active_organization_id = $1,
                updated_at = NOW()
          WHERE id = $2`,
        [organizationId, actualAdminId],
      );
    }
    logger.info('Seeded admin organization baseline', { organization_id: organizationId, user_id: actualAdminId });

    // ── Seed HQ chat ──
    const hqCheck = await client.query(`SELECT id FROM chats WHERE type = 'hq' LIMIT 1`);
    let actualHqId: string;

    if (hqCheck.rows.length > 0) {
      actualHqId = hqCheck.rows[0].id;
      if (orgCapabilities.chatsOrganization) {
        await client.query(
          `UPDATE chats
              SET organization_id = COALESCE(organization_id, $2),
                  updated_at = NOW()
            WHERE id = $1`,
          [actualHqId, organizationId],
        );
      }
      logger.info('HQ chat already exists', { chat_id: actualHqId });
    } else {
      actualHqId = uuidv7();
      if (orgCapabilities.chatsOrganization) {
        await client.query(
          `INSERT INTO chats (id, organization_id, name, type, created_at, updated_at)
           VALUES ($1, $2, 'HQ', 'hq', NOW(), NOW())`,
          [actualHqId, organizationId],
        );
      } else {
        await client.query(
          `INSERT INTO chats (id, name, type, created_at, updated_at)
           VALUES ($1, 'HQ', 'hq', NOW(), NOW())`,
          [actualHqId],
        );
      }
      logger.info('Seeded HQ chat', { chat_id: actualHqId });
    }

    // ── Seed HQ membership ──
    await client.query(
      `INSERT INTO chat_members (id, chat_id, user_id, role, joined_at)
       VALUES ($1, $2, $3, 'admin', NOW())
       ON CONFLICT (chat_id, user_id) DO NOTHING`,
      [uuidv7(), actualHqId, actualAdminId],
    );
    logger.info('Seeded HQ chat membership');

    // ── Seed default settings ──
    const defaultSettings: Record<string, unknown> = {
      'performance.gaming_mode': false,
      'performance.profile': 'balanced',
      'performance.max_llm_concurrency': 2,
      'performance.pause_jobs': false,
      'buddy.enabled': true,
      'buddy.proactivity': 'medium',
      'buddy.daily_digest_time': '09:00',
      'buddy.alert_thresholds': { error_rate: 0.05, latency_p99_ms: 5000 },
      'incident.mode': 'normal',
    };

    for (const [key, value] of Object.entries(defaultSettings)) {
      await client.query(
        `INSERT INTO settings_global (key, value, updated_at, updated_by)
         VALUES ($1, $2, NOW(), $3)
         ON CONFLICT (key) DO NOTHING`,
        [key, JSON.stringify(value), actualAdminId],
      );
    }
    logger.info('Seeded default settings', { count: Object.keys(defaultSettings).length });

    // ── Seed global identity doc ──
    const docCheck = await client.query(
      `SELECT 1 FROM sven_identity_docs WHERE scope = 'global'`,
    );
    if (docCheck.rows.length === 0) {
      await client.query(
        `INSERT INTO sven_identity_docs (id, scope, content, version, updated_by, updated_at)
         VALUES ($1, 'global', $2, 1, $3, NOW())`,
        [
          uuidv7(),
          'You are Sven, a helpful AI assistant for the 47 Network household. You are friendly, precise, and safety-conscious. You always explain what you are about to do before doing it, and you never perform destructive actions without explicit approval.',
          actualAdminId,
        ],
      );
      logger.info('Seeded global identity doc');
    }

    // ── Seed default policy presets (deny-by-default) ──
    const policyPresets = [
      { scope: 'nas.read', effect: 'allow' },
      { scope: 'nas.write', effect: 'deny' },
      { scope: 'web.fetch', effect: 'deny' },
      { scope: 'ha.read', effect: 'deny' },
      { scope: 'ha.write', effect: 'deny' },
      { scope: 'git.read', effect: 'deny' },
      { scope: 'git.write', effect: 'deny' },
      { scope: 'calendar.read', effect: 'deny' },
      { scope: 'calendar.write', effect: 'deny' },
    ];

    let presetCount = 0;
    const existingPerms = orgCapabilities.permissionsOrganization
      ? await client.query(
          `SELECT scope
             FROM permissions
            WHERE target_type = 'global'
              AND organization_id = $1`,
          [organizationId],
        )
      : await client.query(`SELECT scope FROM permissions WHERE target_type = 'global'`);
    const existingScopes = new Set(existingPerms.rows.map((r: { scope: string }) => r.scope));
    for (const preset of policyPresets) {
      if (existingScopes.has(preset.scope)) continue;
      if (orgCapabilities.permissionsOrganization) {
        await client.query(
          `INSERT INTO permissions (id, organization_id, scope, effect, target_type, target_id, created_by, created_at)
           VALUES ($1, $2, $3, $4, 'global', NULL, $5, NOW())`,
          [uuidv7(), organizationId, preset.scope, preset.effect, actualAdminId],
        );
      } else {
        await client.query(
          `INSERT INTO permissions (id, scope, effect, target_type, created_by, created_at)
           VALUES ($1, $2, $3, 'global', $4, NOW())`,
          [uuidv7(), preset.scope, preset.effect, actualAdminId],
        );
      }
      presetCount++;
    }
    logger.info('Seeded default policy presets', { count: presetCount });

    // ── Seed baseline allowlists (default NAS path + other types initialized) ──
    const allowlistTypes = ['nas_path', 'web_domain', 'ha_entity', 'ha_service', 'git_repo'];
    for (const type of allowlistTypes) {
      const check = orgCapabilities.allowlistsOrganization
        ? await client.query(
            `SELECT 1
               FROM allowlists
              WHERE type = $1
                AND organization_id = $2
              LIMIT 1`,
            [type, organizationId],
          )
        : await client.query(`SELECT 1 FROM allowlists WHERE type = $1 LIMIT 1`, [type]);
      if (check.rows.length === 0) {
        // Seed the default NAS paths
        if (type === 'nas_path') {
          if (orgCapabilities.allowlistsOrganization) {
            await client.query(
              `INSERT INTO allowlists (id, organization_id, type, pattern, description, enabled, created_by, created_at)
               VALUES ($1, $2, 'nas_path', '/nas/shared', 'Shared NAS folder (read-only by default)', TRUE, $3, NOW())`,
              [uuidv7(), organizationId, actualAdminId],
            );
          } else {
            await client.query(
              `INSERT INTO allowlists (id, type, pattern, description, enabled, created_by, created_at)
               VALUES ($1, 'nas_path', '/nas/shared', 'Shared NAS folder (read-only by default)', TRUE, $2, NOW())`,
              [uuidv7(), actualAdminId],
            );
          }
        }
      }
    }
    logger.info('Seeded allowlists');

    // ── Seed registry sources (public/private/local) ──
    const registrySources = [
      { name: 'Public Registry', type: 'public', url: 'https://registry.example.com', path: null, enabled: false },
      { name: 'Private Registry', type: 'private', url: 'https://registry.internal', path: null, enabled: false },
      { name: 'Local Registry', type: 'local', url: null, path: '/opt/sven/registry', enabled: false },
    ];

    for (const source of registrySources) {
      const exists = orgCapabilities.registrySourcesOrganization
        ? await client.query(
            `SELECT 1
               FROM registry_sources
              WHERE name = $1
                AND organization_id = $2
              LIMIT 1`,
            [source.name, organizationId],
          )
        : await client.query(`SELECT 1 FROM registry_sources WHERE name = $1 LIMIT 1`, [source.name]);
      if (exists.rows.length === 0) {
        if (orgCapabilities.registrySourcesOrganization) {
          await client.query(
            `INSERT INTO registry_sources (id, organization_id, name, type, url, path, enabled, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
            [uuidv7(), organizationId, source.name, source.type, source.url, source.path, source.enabled],
          );
        } else {
          await client.query(
            `INSERT INTO registry_sources (id, name, type, url, path, enabled, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
            [uuidv7(), source.name, source.type, source.url, source.path, source.enabled],
          );
        }
      }
    }
    logger.info('Seeded registry sources');

    // ── Seed allowlisted publishers ──
    const defaultPublishers = [
      { name: 'OpenClaw', trusted: true },
      { name: 'Local Publisher', trusted: true },
    ];

    for (const publisher of defaultPublishers) {
      const exists = orgCapabilities.registryPublishersOrganization
        ? await client.query(
            `SELECT 1
               FROM registry_publishers
              WHERE name = $1
                AND organization_id = $2
              LIMIT 1`,
            [publisher.name, organizationId],
          )
        : await client.query(`SELECT 1 FROM registry_publishers WHERE name = $1 LIMIT 1`, [publisher.name]);
      if (exists.rows.length === 0) {
        if (orgCapabilities.registryPublishersOrganization) {
          await client.query(
            `INSERT INTO registry_publishers (id, organization_id, name, trusted, created_at)
             VALUES ($1, $2, $3, $4, NOW())`,
            [uuidv7(), organizationId, publisher.name, publisher.trusted],
          );
        } else {
          await client.query(
            `INSERT INTO registry_publishers (id, name, trusted, created_at)
             VALUES ($1, $2, $3, NOW())`,
            [uuidv7(), publisher.name, publisher.trusted],
          );
        }
      }
    }
    logger.info('Seeded registry publishers');

    // ── Seed default Ollama models ──
    // Endpoint stored as 'ollama://local'; agent-runtime overrides with OLLAMA_URL at call time.
    const ollamaModels = [
      { name: 'llama3.2:3b',      modelId: 'llama3.2:3b',      capabilities: ['chat'],       description: 'Meta Llama 3.2 3B — fast, compact, general purpose' },
      { name: 'nomic-embed-text', modelId: 'nomic-embed-text', capabilities: ['embed'],      description: 'Nomic Embed Text — local embeddings' },
    ];

    for (const m of ollamaModels) {
      await client.query(
        `INSERT INTO model_registry
           (id, name, provider, model_id, endpoint, capabilities, is_local, is_active, organization_id, created_by, created_at)
         SELECT gen_random_uuid()::text, $1, 'ollama', $2, 'ollama://local', $3, TRUE, TRUE, $4, $5, NOW()
         WHERE NOT EXISTS (SELECT 1 FROM model_registry WHERE provider = 'ollama' AND model_id = $2)`,
        [m.name, m.modelId, m.capabilities, organizationId, actualAdminId],
      );
    }
    logger.info('Seeded default Ollama models', { count: ollamaModels.length });

    logger.info('Seed complete');
  } finally {
    await client.end();
  }
}

seed().catch((err) => {
  logger.fatal('Seed failed', { error: String(err) });
  process.exit(1);
});

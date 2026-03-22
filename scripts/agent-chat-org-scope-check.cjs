#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const outputJson = 'docs/release/status/agent-chat-org-scope-latest.json';
const outputMd = 'docs/release/status/agent-chat-org-scope-latest.md';

const agentsRoutePath = path.join(root, 'services', 'gateway-api', 'src', 'routes', 'admin', 'agents.ts');
const chatOrgMigrationPath = path.join(root, 'services', 'gateway-api', 'src', 'db', 'migrations', '057_chat_org_scope.sql');

function check(id, ok, detail, evidence = []) {
  return { id, status: ok ? 'pass' : 'fail', detail, evidence };
}

function writeOutputs(payload) {
  fs.mkdirSync(path.dirname(outputJson), { recursive: true });
  fs.writeFileSync(outputJson, JSON.stringify(payload, null, 2), 'utf8');

  const lines = [
    '# Agent Chat Org Scope Check',
    '',
    `Generated: ${payload.generated_at}`,
    `Status: ${payload.status}`,
    '',
    '## Checks',
  ];
  for (const c of payload.checks) {
    lines.push(`- ${c.id}: ${c.status}`);
    lines.push(`  detail: ${c.detail}`);
    if (Array.isArray(c.evidence) && c.evidence.length > 0) {
      lines.push(`  evidence: ${c.evidence.join(', ')}`);
    }
  }
  lines.push('');
  fs.writeFileSync(outputMd, `${lines.join('\n')}\n`, 'utf8');
}

function main() {
  const checks = [];

  const routeExists = fs.existsSync(agentsRoutePath);
  checks.push(check('agents_route_present', routeExists, routeExists ? 'agents route file found' : 'agents route file missing', [agentsRoutePath].filter(() => routeExists)));
  let routeSource = '';
  if (routeExists) {
    routeSource = fs.readFileSync(agentsRoutePath, 'utf8');
  }

  checks.push(
    check(
      'spawn_session_inserts_org_scoped_chat',
      routeSource.includes('INSERT INTO chats (id, organization_id, name, type, channel, channel_chat_id, created_at, updated_at)')
        && routeSource.includes('[sessionId, orgId, sessionName, chatType]'),
      'spawn-session must persist organization_id on newly-created chats',
      routeExists ? [agentsRoutePath] : [],
    ),
  );

  checks.push(
    check(
      'spawn_session_requires_org_context',
      routeSource.includes("const orgId = String((request as any).orgId || '').trim();")
        && routeSource.includes("error: { code: 'ORG_REQUIRED', message: 'Active account required' },"),
      'spawn-session route must fail closed when active organization is missing',
      routeExists ? [agentsRoutePath] : [],
    ),
  );

  checks.push(
    check(
      'agent_control_plane_org_joins',
      routeSource.includes('WHERE c.organization_id = $1')
        && routeSource.includes('c.organization_id::text = $3::text')
        && routeSource.includes('session_id is required for org-scoped routing rules'),
      'agent session/routing/send paths must enforce chat organization scope',
      routeExists ? [agentsRoutePath] : [],
    ),
  );

  checks.push(
    check(
      'legacy_unscoped_chat_insert_absent',
      !routeSource.includes('INSERT INTO chats (id, name, type, channel, channel_chat_id, created_at, updated_at)'),
      'legacy unscoped chat insert signature must be absent from admin agent spawn path',
      routeExists ? [agentsRoutePath] : [],
    ),
  );

  const migrationExists = fs.existsSync(chatOrgMigrationPath);
  let migrationSource = '';
  if (migrationExists) migrationSource = fs.readFileSync(chatOrgMigrationPath, 'utf8');
  checks.push(
    check(
      'chat_org_scope_migration_present',
      migrationExists
        && migrationSource.includes('ADD COLUMN IF NOT EXISTS organization_id')
        && migrationSource.includes('CREATE INDEX IF NOT EXISTS idx_chats_organization_id'),
      'chat org-scope migration must define organization_id + index',
      [chatOrgMigrationPath].filter(() => migrationExists),
    ),
  );

  const failed = checks.filter((c) => c.status === 'fail').length;
  const payload = {
    generated_at: new Date().toISOString(),
    status: failed > 0 ? 'fail' : 'pass',
    strict,
    summary: {
      pass: checks.length - failed,
      fail: failed,
      total: checks.length,
    },
    checks,
  };

  writeOutputs(payload);
  console.log(`agent-chat-org-scope-check: ${payload.status} (pass=${payload.summary.pass} fail=${payload.summary.fail})`);
  if (strict && payload.status !== 'pass') process.exit(2);
}

main();


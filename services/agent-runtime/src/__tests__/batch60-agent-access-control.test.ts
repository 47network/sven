/**
 * Batch 60 — Agent Access Control & Permissions
 *
 * Validates migration SQL, shared types, SKILL.md, Eidolon wiring,
 * event-bus subjects, and task-executor handlers for the access control system.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

/* ------------------------------------------------------------------ */
/*  1. Migration SQL                                                  */
/* ------------------------------------------------------------------ */
describe('Batch 60 — Migration SQL', () => {
  const sql = fs.readFileSync(
    path.join(ROOT, 'services/gateway-api/migrations/20260602120000_agent_access_control.sql'),
    'utf-8',
  );

  it('creates agent_roles table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_roles');
  });

  it('creates agent_permissions table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_permissions');
  });

  it('creates agent_access_policies table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_access_policies');
  });

  it('creates agent_access_audit table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_access_audit');
  });

  it('creates agent_scopes table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_scopes');
  });

  it('has 17 indexes', () => {
    const idxCount = (sql.match(/CREATE INDEX/g) || []).length;
    expect(idxCount).toBe(17);
  });

  it('enforces role_type CHECK constraint', () => {
    expect(sql).toContain("role_type IN ('system','custom','inherited','temporary','delegated')");
  });

  it('enforces action CHECK constraint', () => {
    expect(sql).toContain("action IN ('read','write','execute','delete','admin')");
  });

  it('enforces effect CHECK constraint', () => {
    expect(sql).toContain("effect IN ('allow','deny')");
  });

  it('enforces policy_type CHECK constraint', () => {
    expect(sql).toContain("policy_type IN ('rbac','abac','pbac','mandatory','discretionary')");
  });

  it('enforces decision CHECK constraint', () => {
    expect(sql).toContain("decision IN ('granted','denied','escalated','revoked','expired')");
  });

  it('enforces scope_type CHECK constraint', () => {
    expect(sql).toContain("scope_type IN ('api','data','service','resource','delegation')");
  });
});

/* ------------------------------------------------------------------ */
/*  2. Shared types                                                   */
/* ------------------------------------------------------------------ */
describe('Batch 60 — Shared types', () => {
  const src = fs.readFileSync(
    path.join(ROOT, 'packages/shared/src/agent-access-control.ts'),
    'utf-8',
  );

  it('exports RoleType with 5 values', () => {
    const m = src.match(/export type RoleType\s*=\s*([^;]+);/);
    expect(m).toBeTruthy();
    const count = (m![1].match(/'/g) || []).length / 2;
    expect(count).toBe(5);
  });

  it('exports PermissionAction with 5 values', () => {
    const m = src.match(/export type PermissionAction\s*=\s*([^;]+);/);
    expect(m).toBeTruthy();
    const count = (m![1].match(/'/g) || []).length / 2;
    expect(count).toBe(5);
  });

  it('exports PermissionEffect with 2 values', () => {
    const m = src.match(/export type PermissionEffect\s*=\s*([^;]+);/);
    expect(m).toBeTruthy();
    const count = (m![1].match(/'/g) || []).length / 2;
    expect(count).toBe(2);
  });

  it('exports AgentaPolicyType with 5 values', () => {
    const m = src.match(/export type AgentaPolicyType\s*=\s*([^;]+);/);
    expect(m).toBeTruthy();
    const count = (m![1].match(/'/g) || []).length / 2;
    expect(count).toBe(5);
  });

  it('exports AccessDecision with 5 values', () => {
    const m = src.match(/export type AccessDecision\s*=\s*([^;]+);/);
    expect(m).toBeTruthy();
    const count = (m![1].match(/'/g) || []).length / 2;
    expect(count).toBe(5);
  });

  it('exports ScopeType with 5 values', () => {
    const m = src.match(/export type ScopeType\s*=\s*([^;]+);/);
    expect(m).toBeTruthy();
    const count = (m![1].match(/'/g) || []).length / 2;
    expect(count).toBe(5);
  });

  it('exports AccessControlAction with 7 values', () => {
    const block = src.match(/export type AccessControlAction\s*=[\s\S]*?;/);
    expect(block).toBeTruthy();
    const count = (block![0].match(/'/g) || []).length / 2;
    expect(count).toBe(7);
  });

  it('exports 5 interfaces', () => {
    const ifaces = (src.match(/export interface /g) || []).length;
    expect(ifaces).toBe(5);
  });

  it('exports 6 constants', () => {
    const consts = (src.match(/export const /g) || []).length;
    expect(consts).toBe(6);
  });

  it('exports isRoleActive helper', () => {
    expect(src).toContain('export function isRoleActive');
  });

  it('exports isPermissionAllowed helper', () => {
    expect(src).toContain('export function isPermissionAllowed');
  });

  it('exports isAccessGranted helper', () => {
    expect(src).toContain('export function isAccessGranted');
  });

  it('exports formatPermission helper', () => {
    expect(src).toContain('export function formatPermission');
  });
});

/* ------------------------------------------------------------------ */
/*  3. Barrel export                                                  */
/* ------------------------------------------------------------------ */
describe('Batch 60 — Barrel export', () => {
  const idx = fs.readFileSync(
    path.join(ROOT, 'packages/shared/src/index.ts'),
    'utf-8',
  );

  it('re-exports agent-access-control', () => {
    expect(idx).toContain("agent-access-control");
  });

  it('has at least 85 lines', () => {
    expect(idx.split('\n').length).toBeGreaterThanOrEqual(85);
  });
});

/* ------------------------------------------------------------------ */
/*  4. SKILL.md                                                       */
/* ------------------------------------------------------------------ */
describe('Batch 60 — SKILL.md', () => {
  const md = fs.readFileSync(
    path.join(ROOT, 'skills/autonomous-economy/agent-access-control/SKILL.md'),
    'utf-8',
  );

  it('has correct skill identifier', () => {
    expect(md).toMatch(/skill:\s*agent-access-control/);
  });

  it('defines role_assign action', () => {
    expect(md).toContain('role_assign');
  });

  it('defines role_revoke action', () => {
    expect(md).toContain('role_revoke');
  });

  it('defines permission_grant action', () => {
    expect(md).toContain('permission_grant');
  });

  it('defines permission_check action', () => {
    expect(md).toContain('permission_check');
  });

  it('defines policy_create action', () => {
    expect(md).toContain('policy_create');
  });

  it('defines audit_query action', () => {
    expect(md).toContain('audit_query');
  });

  it('defines scope_define action', () => {
    expect(md).toContain('scope_define');
  });
});

/* ------------------------------------------------------------------ */
/*  5. Eidolon types — building kind                                  */
/* ------------------------------------------------------------------ */
describe('Batch 60 — Eidolon building kind', () => {
  const types = fs.readFileSync(
    path.join(ROOT, 'services/sven-eidolon/src/types.ts'),
    'utf-8',
  );

  it('adds access_gate building kind', () => {
    expect(types).toContain("'access_gate'");
  });

  it('has 43 building kinds total', () => {
    const block = types.match(/export type EidolonBuildingKind\s*=[\s\S]*?;/);
    expect(block).toBeTruthy();
    const pipeCount = (block![0].match(/\|/g) || []).length;
    expect(pipeCount).toBe(43);
  });
});

/* ------------------------------------------------------------------ */
/*  6. Eidolon types — event kinds                                    */
/* ------------------------------------------------------------------ */
describe('Batch 60 — Eidolon event kinds', () => {
  const types = fs.readFileSync(
    path.join(ROOT, 'services/sven-eidolon/src/types.ts'),
    'utf-8',
  );

  it('adds acl.role_assigned event kind', () => {
    expect(types).toContain("'acl.role_assigned'");
  });

  it('adds acl.permission_granted event kind', () => {
    expect(types).toContain("'acl.permission_granted'");
  });

  it('adds acl.access_denied event kind', () => {
    expect(types).toContain("'acl.access_denied'");
  });

  it('adds acl.policy_evaluated event kind', () => {
    expect(types).toContain("'acl.policy_evaluated'");
  });

  it('has 188 event kinds total', () => {
    const block = types.match(/export type EidolonEventKind\s*=[\s\S]*?;/);
    expect(block).toBeTruthy();
    const pipeCount = (block![0].match(/\|/g) || []).length;
    expect(pipeCount).toBe(188);
  });
});

/* ------------------------------------------------------------------ */
/*  7. Eidolon districtFor                                            */
/* ------------------------------------------------------------------ */
describe('Batch 60 — districtFor', () => {
  const types = fs.readFileSync(
    path.join(ROOT, 'services/sven-eidolon/src/types.ts'),
    'utf-8',
  );

  it('maps access_gate to civic', () => {
    expect(types).toContain("case 'access_gate':");
    expect(types).toContain("return 'civic'");
  });

  it('has 43 districtFor cases', () => {
    const fn = types.match(/export function districtFor[\s\S]*?^}/m);
    expect(fn).toBeTruthy();
    const caseCount = (fn![0].match(/case '/g) || []).length;
    expect(caseCount).toBe(43);
  });
});

/* ------------------------------------------------------------------ */
/*  8. Event-bus SUBJECT_MAP                                          */
/* ------------------------------------------------------------------ */
describe('Batch 60 — Event-bus SUBJECT_MAP', () => {
  const bus = fs.readFileSync(
    path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'),
    'utf-8',
  );

  it('maps sven.acl.role_assigned', () => {
    expect(bus).toContain("'sven.acl.role_assigned'");
  });

  it('maps sven.acl.permission_granted', () => {
    expect(bus).toContain("'sven.acl.permission_granted'");
  });

  it('maps sven.acl.access_denied', () => {
    expect(bus).toContain("'sven.acl.access_denied'");
  });

  it('maps sven.acl.policy_evaluated', () => {
    expect(bus).toContain("'sven.acl.policy_evaluated'");
  });

  it('has 187 SUBJECT_MAP entries total', () => {
    const match = bus.match(/SUBJECT_MAP[^{]*\{([^}]+)\}/s);
    expect(match).toBeTruthy();
    const entryCount = (match![1].match(/^\s+'/gm) || []).length;
    expect(entryCount).toBe(187);
  });
});

/* ------------------------------------------------------------------ */
/*  9. Task executor — switch cases                                   */
/* ------------------------------------------------------------------ */
describe('Batch 60 — Task executor switch cases', () => {
  const exec = fs.readFileSync(
    path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'),
    'utf-8',
  );

  const cases = [
    'role_assign', 'role_revoke', 'permission_grant',
    'permission_check', 'policy_create', 'audit_query', 'scope_define',
  ];

  for (const c of cases) {
    it(`has case '${c}'`, () => {
      expect(exec).toContain(`case '${c}':`);
    });
  }

  it('has 201 total switch cases', () => {
    const count = (exec.match(/case '/g) || []).length;
    expect(count).toBe(201);
  });
});

/* ------------------------------------------------------------------ */
/* 10. Task executor — handler methods                                */
/* ------------------------------------------------------------------ */
describe('Batch 60 — Task executor handler methods', () => {
  const exec = fs.readFileSync(
    path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'),
    'utf-8',
  );

  const handlers = [
    'handleRoleAssign', 'handleRoleRevoke', 'handlePermissionGrant',
    'handlePermissionCheck', 'handlePolicyCreate', 'handleAuditQuery',
    'handleScopeDefine',
  ];

  for (const h of handlers) {
    it(`defines ${h}`, () => {
      expect(exec).toMatch(new RegExp(`private (?:async )?${h}`));
    });
  }

  it('has 197 total handler methods', () => {
    const count = (exec.match(/private (?:async )?handle[A-Z]/g) || []).length;
    expect(count).toBe(197);
  });
});

/* ------------------------------------------------------------------ */
/* 11. .gitattributes                                                 */
/* ------------------------------------------------------------------ */
describe('Batch 60 — .gitattributes', () => {
  const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');

  it('marks migration as export-ignore', () => {
    expect(ga).toContain('20260602120000_agent_access_control.sql export-ignore');
  });

  it('marks shared types as export-ignore', () => {
    expect(ga).toContain('agent-access-control.ts export-ignore');
  });

  it('marks skill as export-ignore', () => {
    expect(ga).toContain('agent-access-control/** export-ignore');
  });
});

/* ------------------------------------------------------------------ */
/* 12. CHANGELOG                                                      */
/* ------------------------------------------------------------------ */
describe('Batch 60 — CHANGELOG', () => {
  const cl = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf-8');

  it('has Batch 60 entry', () => {
    expect(cl).toContain('Batch 60');
  });

  it('mentions Agent Access Control', () => {
    expect(cl).toContain('Agent Access Control');
  });
});

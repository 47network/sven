/**
 * Batch 49 — Agent Billing & Invoicing  (test suite)
 *
 * Validates migration SQL, shared types, SKILL.md, Eidolon wiring,
 * event-bus subjects, and task-executor handlers for the billing
 * and invoicing subsystem.
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

/* ── helpers ── */
function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8');
}

/* ── 1. Migration SQL ── */
describe('Batch 49 — Migration SQL', () => {
  const sql = read('services/gateway-api/migrations/20260522120000_agent_billing_invoicing.sql');

  test('creates billing_accounts table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS billing_accounts');
  });
  test('creates invoices table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS invoices');
  });
  test('creates invoice_line_items table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS invoice_line_items');
  });
  test('creates usage_meters table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS usage_meters');
  });
  test('creates credit_transactions table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS credit_transactions');
  });
  test('has at least 15 indexes', () => {
    const idxCount = (sql.match(/CREATE INDEX/gi) || []).length;
    expect(idxCount).toBeGreaterThanOrEqual(15);
  });
  test('invoices has unique invoice_number', () => {
    expect(sql.toLowerCase()).toContain('unique');
  });
  test('billing_accounts references agent_id', () => {
    expect(sql).toContain('agent_id');
  });
  test('credit_transactions has direction column', () => {
    expect(sql).toContain('direction');
  });
  test('credit_transactions has balance_after column', () => {
    expect(sql).toContain('balance_after');
  });
});

/* ── 2. Shared types file ── */
describe('Batch 49 — Shared types file', () => {
  const src = read('packages/shared/src/agent-billing-invoicing.ts');

  test('exports BillingAccountType with 4 values', () => {
    const m = src.match(/export type BillingAccountType\s*=\s*([^;]+);/);
    expect(m).toBeTruthy();
    const count = (m![1].match(/'/g) || []).length / 2;
    expect(count).toBe(4);
  });

  test('exports BillingCycle with 5 values', () => {
    const m = src.match(/export type BillingCycle\s*=\s*([^;]+);/);
    expect(m).toBeTruthy();
    const count = (m![1].match(/'/g) || []).length / 2;
    expect(count).toBe(5);
  });

  test('exports BillingAccountStatus with 5 values', () => {
    const m = src.match(/export type BillingAccountStatus\s*=\s*([^;]+);/);
    expect(m).toBeTruthy();
    const count = (m![1].match(/'/g) || []).length / 2;
    expect(count).toBe(5);
  });

  test('exports InvoiceStatus with 8 values', () => {
    const m = src.match(/export type InvoiceStatus\s*=\s*([^;]+);/);
    expect(m).toBeTruthy();
    const count = (m![1].match(/'/g) || []).length / 2;
    expect(count).toBe(8);
  });

  test('exports LineItemCategory with 8 values', () => {
    const m = src.match(/export type LineItemCategory\s*=\s*([^;]+);/);
    expect(m).toBeTruthy();
    const count = (m![1].match(/'/g) || []).length / 2;
    expect(count).toBe(8);
  });

  test('exports MeterType with 6 values', () => {
    const m = src.match(/export type MeterType\s*=\s*([^;]+);/);
    expect(m).toBeTruthy();
    const count = (m![1].match(/'/g) || []).length / 2;
    expect(count).toBe(6);
  });

  test('exports CreditDirection with 2 values', () => {
    const m = src.match(/export type CreditDirection\s*=\s*([^;]+);/);
    expect(m).toBeTruthy();
    const count = (m![1].match(/'/g) || []).length / 2;
    expect(count).toBe(2);
  });

  test('exports CreditReason with 7 values', () => {
    const m = src.match(/export type CreditReason\s*=\s*([^;]+);/);
    expect(m).toBeTruthy();
    const count = (m![1].match(/'/g) || []).length / 2;
    expect(count).toBe(7);
  });

  test('exports PaymentMethod with 4 values', () => {
    const m = src.match(/export type PaymentMethod\s*=\s*([^;]+);/);
    expect(m).toBeTruthy();
    const count = (m![1].match(/'/g) || []).length / 2;
    expect(count).toBe(4);
  });

  test('exports BillingAccount interface', () => {
    expect(src).toContain('export interface BillingAccount');
  });
  test('exports Invoice interface', () => {
    expect(src).toContain('export interface Invoice');
  });
  test('exports InvoiceLineItem interface', () => {
    expect(src).toContain('export interface InvoiceLineItem');
  });
  test('exports UsageMeter interface', () => {
    expect(src).toContain('export interface UsageMeter');
  });
  test('exports CreditTransaction interface', () => {
    expect(src).toContain('export interface CreditTransaction');
  });

  test('exports BILLING_CYCLES constant', () => {
    expect(src).toContain('export const BILLING_CYCLES');
  });
  test('exports INVOICE_STATUSES constant', () => {
    expect(src).toContain('export const INVOICE_STATUSES');
  });
  test('exports METER_TYPES constant', () => {
    expect(src).toContain('export const METER_TYPES');
  });
  test('exports LINE_ITEM_CATEGORIES constant', () => {
    expect(src).toContain('export const LINE_ITEM_CATEGORIES');
  });
  test('exports CREDIT_REASONS constant', () => {
    expect(src).toContain('export const CREDIT_REASONS');
  });
  test('exports PAYMENT_METHODS constant', () => {
    expect(src).toContain('export const PAYMENT_METHODS');
  });

  test('exports isOverdue helper', () => {
    expect(src).toContain('export function isOverdue');
  });
  test('exports calculateLineItemTotal helper', () => {
    expect(src).toContain('export function calculateLineItemTotal');
  });
  test('exports getAccountHealth helper', () => {
    expect(src).toContain('export function getAccountHealth');
  });
  test('exports estimateMonthlyUsageCost helper', () => {
    expect(src).toContain('export function estimateMonthlyUsageCost');
  });
});

/* ── 3. Barrel export ── */
describe('Batch 49 — Barrel export', () => {
  const idx = read('packages/shared/src/index.ts');

  test('index.ts exports agent-billing-invoicing', () => {
    expect(idx).toContain("./agent-billing-invoicing");
  });

  test('index.ts has 74 lines', () => {
    expect(idx.split('\n').length).toBe(75); // 74 lines + trailing newline → 75 elements
  });
});

/* ── 4. SKILL.md ── */
describe('Batch 49 — SKILL.md', () => {
  const skill = read('skills/autonomous-economy/billing-invoicing/SKILL.md');

  test('has correct skill identifier', () => {
    expect(skill).toMatch(/skill:\s*billing-invoicing/);
  });
  test('has correct name', () => {
    expect(skill).toMatch(/name:\s*Agent Billing & Invoicing/);
  });
  test('has version', () => {
    expect(skill).toMatch(/version:\s*1\.0\.0/);
  });
  test('has status active', () => {
    expect(skill).toMatch(/status:\s*active/);
  });
  test('defines account_create action', () => {
    expect(skill).toContain('account_create');
  });
  test('defines invoice_generate action', () => {
    expect(skill).toContain('invoice_generate');
  });
  test('defines invoice_send action', () => {
    expect(skill).toContain('invoice_send');
  });
  test('defines payment_record action', () => {
    expect(skill).toContain('payment_record');
  });
  test('defines usage_record action', () => {
    expect(skill).toContain('usage_record');
  });
  test('defines credit_adjust action', () => {
    expect(skill).toContain('credit_adjust');
  });
  test('defines account_statement action', () => {
    expect(skill).toContain('account_statement');
  });
  test('has 7 actions', () => {
    const actions = (skill.match(/- id:/g) || []).length;
    expect(actions).toBe(7);
  });
});

/* ── 5. Eidolon types — building kind ── */
describe('Batch 49 — Eidolon building kinds', () => {
  const types = read('services/sven-eidolon/src/types.ts');

  test('includes billing_office building kind', () => {
    expect(types).toContain("'billing_office'");
  });

  test('EidolonBuildingKind has 32 values', () => {
    const block = types.match(/export type EidolonBuildingKind\s*=[\s\S]*?;/);
    expect(block).toBeTruthy();
    const pipeCount = (block![0].match(/\|/g) || []).length;
    expect(pipeCount).toBe(32);
  });

  test('districtFor maps billing_office', () => {
    expect(types).toContain("case 'billing_office':");
    expect(types).toContain("return 'market'");
  });

  test('districtFor has 32 cases', () => {
    const caseCount = (types.match(/case '/g) || []).length;
    expect(caseCount).toBe(32);
  });
});

/* ── 6. Eidolon types — event kinds ── */
describe('Batch 49 — Eidolon event kinds', () => {
  const types = read('services/sven-eidolon/src/types.ts');

  test('includes billing.account_created event kind', () => {
    expect(types).toContain("'billing.account_created'");
  });
  test('includes billing.invoice_generated event kind', () => {
    expect(types).toContain("'billing.invoice_generated'");
  });
  test('includes billing.payment_received event kind', () => {
    expect(types).toContain("'billing.payment_received'");
  });
  test('includes billing.credit_adjusted event kind', () => {
    expect(types).toContain("'billing.credit_adjusted'");
  });

  test('EidolonEventKind has 144 pipe values', () => {
    const block = types.match(/export type EidolonEventKind\s*=[\s\S]*?;/);
    expect(block).toBeTruthy();
    const pipeCount = (block![0].match(/\|/g) || []).length;
    expect(pipeCount).toBe(144);
  });
});

/* ── 7. Event-bus SUBJECT_MAP ── */
describe('Batch 49 — Event-bus SUBJECT_MAP', () => {
  const bus = read('services/sven-eidolon/src/event-bus.ts');

  test('maps sven.billing.account_created', () => {
    expect(bus).toContain("'sven.billing.account_created'");
  });
  test('maps sven.billing.invoice_generated', () => {
    expect(bus).toContain("'sven.billing.invoice_generated'");
  });
  test('maps sven.billing.payment_received', () => {
    expect(bus).toContain("'sven.billing.payment_received'");
  });
  test('maps sven.billing.credit_adjusted', () => {
    expect(bus).toContain("'sven.billing.credit_adjusted'");
  });

  test('SUBJECT_MAP has 143 entries', () => {
    const entries = (bus.match(/'sven\./g) || []).length;
    expect(entries).toBe(143);
  });
});

/* ── 8. Task-executor switch cases ── */
describe('Batch 49 — Task-executor switch cases', () => {
  const te = read('services/sven-marketplace/src/task-executor.ts');

  test('has billing_account_create case', () => {
    expect(te).toContain("case 'billing_account_create'");
  });
  test('has billing_invoice_generate case', () => {
    expect(te).toContain("case 'billing_invoice_generate'");
  });
  test('has billing_invoice_send case', () => {
    expect(te).toContain("case 'billing_invoice_send'");
  });
  test('has billing_payment_record case', () => {
    expect(te).toContain("case 'billing_payment_record'");
  });
  test('has billing_usage_record case', () => {
    expect(te).toContain("case 'billing_usage_record'");
  });
  test('has billing_credit_adjust case', () => {
    expect(te).toContain("case 'billing_credit_adjust'");
  });
  test('has billing_account_statement case', () => {
    expect(te).toContain("case 'billing_account_statement'");
  });

  test('has 124 total switch cases', () => {
    const count = (te.match(/case '/g) || []).length;
    expect(count).toBe(124);
  });
});

/* ── 9. Task-executor handler methods ── */
describe('Batch 49 — Task-executor handler methods', () => {
  const te = read('services/sven-marketplace/src/task-executor.ts');

  test('has handleBillingAccountCreate', () => {
    expect(te).toContain('handleBillingAccountCreate');
  });
  test('has handleBillingInvoiceGenerate', () => {
    expect(te).toContain('handleBillingInvoiceGenerate');
  });
  test('has handleBillingInvoiceSend', () => {
    expect(te).toContain('handleBillingInvoiceSend');
  });
  test('has handleBillingPaymentRecord', () => {
    expect(te).toContain('handleBillingPaymentRecord');
  });
  test('has handleBillingUsageRecord', () => {
    expect(te).toContain('handleBillingUsageRecord');
  });
  test('has handleBillingCreditAdjust', () => {
    expect(te).toContain('handleBillingCreditAdjust');
  });
  test('has handleBillingAccountStatement', () => {
    expect(te).toContain('handleBillingAccountStatement');
  });

  test('has 120 total handler methods', () => {
    const count = (te.match(/private (?:async )?handle[A-Z]/g) || []).length;
    expect(count).toBe(120);
  });
});

/* ── 10. Migration count ── */
describe('Batch 49 — Migration count', () => {
  test('35 total migration files', () => {
    const migDir = path.join(ROOT, 'services/gateway-api/migrations');
    const files = fs.readdirSync(migDir).filter(f => f.endsWith('.sql'));
    expect(files.length).toBe(35);
  });
});

/* ── 11. Skill directories count ── */
describe('Batch 49 — Skill directory count', () => {
  test('42 skill directories', () => {
    const skillDir = path.join(ROOT, 'skills/autonomous-economy');
    const dirs = fs.readdirSync(skillDir, { withFileTypes: true }).filter(d => d.isDirectory());
    expect(dirs.length).toBe(42);
  });
});

/* ── 12. .gitattributes ── */
describe('Batch 49 — .gitattributes', () => {
  const ga = read('.gitattributes');

  test('has billing_invoicing migration privacy entry', () => {
    expect(ga).toContain('20260522120000_agent_billing_invoicing.sql export-ignore');
  });
  test('has billing-invoicing types privacy entry', () => {
    expect(ga).toContain('agent-billing-invoicing.ts export-ignore');
  });
  test('has billing-invoicing skill privacy entry', () => {
    expect(ga).toContain('billing-invoicing/** export-ignore');
  });
});

/* ── 13. CHANGELOG ── */
describe('Batch 49 — CHANGELOG', () => {
  const cl = read('CHANGELOG.md');

  test('mentions Batch 49', () => {
    expect(cl).toContain('Batch 49');
  });
  test('mentions Agent Billing & Invoicing', () => {
    expect(cl).toContain('Agent Billing & Invoicing');
  });
  test('Batch 49 entry appears before Batch 48', () => {
    const b49 = cl.indexOf('Batch 49');
    const b48 = cl.indexOf('Batch 48');
    expect(b49).toBeLessThan(b48);
  });
});

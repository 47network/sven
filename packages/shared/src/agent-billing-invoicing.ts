// Batch 49 — Agent Billing & Invoicing shared types

export type BillingAccountType = 'standard' | 'premium' | 'enterprise' | 'free_tier';

export type BillingCycle = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annual';

export type BillingAccountStatus = 'active' | 'suspended' | 'closed' | 'delinquent' | 'trial';

export type InvoiceStatus = 'draft' | 'pending' | 'sent' | 'paid' | 'overdue' | 'cancelled' | 'refunded' | 'void';

export type LineItemCategory = 'service' | 'compute' | 'storage' | 'bandwidth' | 'api_calls' | 'premium_feature' | 'marketplace_fee' | 'support';

export type MeterType = 'api_requests' | 'compute_minutes' | 'storage_gb' | 'bandwidth_gb' | 'model_tokens' | 'task_executions';

export type CreditDirection = 'credit' | 'debit';

export type CreditReason = 'payment' | 'refund' | 'promotion' | 'usage_charge' | 'adjustment' | 'referral_bonus' | 'penalty';

export type PaymentMethod = 'crypto_wallet' | 'internal_transfer' | 'marketplace_escrow' | 'credit_balance';

export interface BillingAccount {
  id: string;
  agentId: string;
  accountType: BillingAccountType;
  currency: string;
  balance: number;
  creditLimit: number;
  billingCycle: BillingCycle;
  nextInvoice: string | null;
  status: BillingAccountStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  id: string;
  accountId: string;
  invoiceNumber: string;
  periodStart: string;
  periodEnd: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  currency: string;
  status: InvoiceStatus;
  dueDate: string | null;
  paidAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceLineItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  category: LineItemCategory;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface UsageMeter {
  id: string;
  accountId: string;
  meterType: MeterType;
  unitsConsumed: number;
  unitCost: number;
  periodStart: string;
  periodEnd: string | null;
  status: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreditTransaction {
  id: string;
  accountId: string;
  amount: number;
  direction: CreditDirection;
  reason: CreditReason;
  referenceId: string | null;
  balanceAfter: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export const BILLING_CYCLES: readonly BillingCycle[] = ['weekly', 'biweekly', 'monthly', 'quarterly', 'annual'] as const;

export const INVOICE_STATUSES: readonly InvoiceStatus[] = ['draft', 'pending', 'sent', 'paid', 'overdue', 'cancelled', 'refunded', 'void'] as const;

export const METER_TYPES: readonly MeterType[] = ['api_requests', 'compute_minutes', 'storage_gb', 'bandwidth_gb', 'model_tokens', 'task_executions'] as const;

export const LINE_ITEM_CATEGORIES: readonly LineItemCategory[] = ['service', 'compute', 'storage', 'bandwidth', 'api_calls', 'premium_feature', 'marketplace_fee', 'support'] as const;

export const CREDIT_REASONS: readonly CreditReason[] = ['payment', 'refund', 'promotion', 'usage_charge', 'adjustment', 'referral_bonus', 'penalty'] as const;

export const PAYMENT_METHODS: readonly PaymentMethod[] = ['crypto_wallet', 'internal_transfer', 'marketplace_escrow', 'credit_balance'] as const;

export function isOverdue(invoice: Pick<Invoice, 'status' | 'dueDate'>): boolean {
  if (invoice.status === 'paid' || invoice.status === 'cancelled' || invoice.status === 'void') return false;
  if (!invoice.dueDate) return false;
  return new Date(invoice.dueDate) < new Date();
}

export function calculateLineItemTotal(quantity: number, unitPrice: number): number {
  return Math.round(quantity * unitPrice * 1e6) / 1e6;
}

export function getAccountHealth(account: Pick<BillingAccount, 'balance' | 'creditLimit' | 'status'>): 'good' | 'warning' | 'critical' {
  if (account.status === 'delinquent' || account.status === 'suspended') return 'critical';
  if (account.balance < 0 && Math.abs(account.balance) > account.creditLimit * 0.8) return 'warning';
  return 'good';
}

export function estimateMonthlyUsageCost(meters: Pick<UsageMeter, 'unitsConsumed' | 'unitCost'>[]): number {
  return meters.reduce((sum, m) => sum + m.unitsConsumed * m.unitCost, 0);
}

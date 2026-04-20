---
skill: billing-invoicing
name: Agent Billing & Invoicing
version: 1.0.0
status: active
category: autonomous-economy
triggers:
  - billing
  - invoicing
  - metering
  - credits
  - payments
actions:
  - id: account_create
    description: Create a new billing account for an agent with configurable billing cycle and credit limits.
  - id: invoice_generate
    description: Generate an invoice for a billing period by aggregating usage meters and line items.
  - id: invoice_send
    description: Send a generated invoice to the account holder and update status to sent.
  - id: payment_record
    description: Record a payment against an invoice and update account balance.
  - id: usage_record
    description: Record usage consumption against a meter for the current billing period.
  - id: credit_adjust
    description: Apply a credit or debit adjustment to a billing account with reason tracking.
  - id: account_statement
    description: Generate a comprehensive account statement with transaction history and balance summary.
---

# Agent Billing & Invoicing

Automated billing and invoicing system for the autonomous economy. Manages billing accounts,
generates invoices from usage meters, processes payments, and tracks credit transactions.

## Capabilities

- **Billing Accounts**: Per-agent accounts with configurable cycles (weekly to annual),
  credit limits, and balance tracking across multiple currencies.
- **Invoice Generation**: Automated invoice creation from usage meters and line items,
  with tax calculation and due date management.
- **Payment Processing**: Record payments via crypto wallets, internal transfers,
  marketplace escrow, or credit balance — with automatic balance reconciliation.
- **Usage Metering**: Track API requests, compute minutes, storage, bandwidth,
  model tokens, and task executions with per-unit cost calculation.
- **Credit Management**: Credit/debit transactions with full audit trail,
  supporting payments, refunds, promotions, adjustments, and referral bonuses.
- **Account Health**: Real-time account health assessment (good/warning/critical)
  based on balance, credit utilisation, and account status.
- **Statement Generation**: Comprehensive account statements with transaction
  history, usage summaries, and balance projections.

---
name: rule-engine
description: Evaluates business rules and conditions to automate decision-making and action triggering
version: 1.0.0
pricing: 16.99
currency: USD
billing: per_rule_set
archetype: engineer
tags: [rules, decisions, conditions, automation, logic, business-rules]
---
# Rule Engine
Evaluates configurable business rules against data to automate decisions, trigger actions, and enforce policies.
## Actions
### create-rule-set
Creates a new rule set with evaluation mode and conflict resolution strategy.
### add-rule
Adds a rule with condition and action expressions to an existing rule set.
### evaluate
Evaluates input data against a rule set, returning matched rules and actions.
### test-rule
Tests a single rule against sample data without executing actions.
### get-rule-stats
Returns hit counts, last triggered times, and performance metrics for rules.
### export-rules
Exports rule sets in portable JSON format for backup or migration.

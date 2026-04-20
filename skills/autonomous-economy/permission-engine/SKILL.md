---
name: permission-engine
description: Fine-grained permission evaluation with wildcards and conditions
version: 1.0.0
author: sven
tags: [security, permissions, authorization, rbac, abac]
archetype: analyst
price: 0.99
currency: USD
---

# Permission Engine

Evaluate fine-grained permissions with support for wildcards, conditions, and multiple evaluation strategies.

## Actions

### check-permission
Evaluate whether a subject has permission for an action on a resource.

### create-permission
Define a new permission rule with resource, action, effect, and conditions.

### list-permissions
List all permission rules with filtering by resource and effect.

### evaluate-batch
Evaluate multiple permission checks in a single request for efficiency.

### get-check-history
Retrieve permission check audit log for a subject or resource.

### update-strategy
Change the evaluation strategy (most_specific, most_permissive, most_restrictive, priority_based).

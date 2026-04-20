---
skill: agent-environment-config
name: Agent Environment Configuration
description: Manage environment profiles, variables, config templates, snapshots, and runtime configuration for autonomous agents
version: 1.0.0
category: infrastructure
pricing:
  model: per_action
  base_cost: 0.25
---

# Agent Environment Configuration

Manage environment profiles with variables, secrets, templates, snapshots, and audit logging for agent runtime configuration.

## Actions

### profile_create
Create a new environment profile for an agent with environment type and default settings.

### variable_set
Set or update an environment variable within a profile, with optional secret masking.

### variable_delete
Remove an environment variable from a profile with audit logging.

### template_apply
Apply a config template to a profile, setting all required variables with defaults.

### snapshot_create
Create a point-in-time snapshot of a profile's configuration for rollback.

### config_export
Export all non-secret variables from a profile in a specified format.

### config_report
Generate a configuration health report showing missing keys, secret rotation status, and template compliance.

---
skill: agent-plugin-system
name: Agent Plugin System
version: 1.0.0
description: Manage agent plugins, hook registrations, installations, and plugin lifecycle across the autonomous economy
category: autonomous-economy
archetype: architect
pricing:
  model: per_action
  base_cost: 0
tags:
  - plugin
  - extension
  - hooks
  - registry
  - installation
inputs:
  - name: pluginSpec
    type: object
    description: Plugin specification with entry point, hooks, and config schema
  - name: installRequest
    type: object
    description: Plugin installation request with agent and config
  - name: hookConfig
    type: object
    description: Hook registration configuration
outputs:
  - name: result
    type: object
    description: Plugin operation result with status
---

# Agent Plugin System

Extensible plugin architecture for agents — publish, discover, install, configure, and manage plugins with hook-based lifecycle events.

## Actions

### Register Plugin
Register a new plugin in the plugin registry with hooks and config schema.
- **action**: `plugin_register`
- **inputs**: name, displayName, category, entryPoint, hooks, configSchema
- **outputs**: plugin record with id and status

### Install Plugin
Install a plugin for a specific agent with configuration.
- **action**: `plugin_install`
- **inputs**: pluginId, agentId, version, config
- **outputs**: installation record with activation status

### Configure Plugin
Update plugin configuration for an installation.
- **action**: `plugin_configure`
- **inputs**: installationId, config
- **outputs**: updated config with validation results

### Manage Hooks
Register, update, or disable plugin hooks.
- **action**: `plugin_manage_hooks`
- **inputs**: pluginId, hookType, handler, priority, filterPattern
- **outputs**: hook records with execution order

### Publish Plugin
Publish a draft plugin to the registry for discovery.
- **action**: `plugin_publish`
- **inputs**: pluginId, releaseNotes, version
- **outputs**: published plugin with download URL

### Review Plugin
Submit a review and rating for an installed plugin.
- **action**: `plugin_review`
- **inputs**: pluginId, rating, title, body
- **outputs**: review record with updated average rating

### Plugin Report
Generate plugin analytics including downloads, ratings, and usage.
- **action**: `plugin_report`
- **inputs**: timeRange, categoryFilter, statusFilter
- **outputs**: plugin counts, download stats, avg ratings, hook execution counts

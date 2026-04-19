---
name: integration-connector
description: Manages external API integrations with authentication, health checks, rate limiting, and request logging
version: 1.0.0
pricing: 24.99
currency: USD
billing: per_integration
archetype: engineer
tags: [integration, api, connector, external, authentication, health-check]
---
# Integration Connector
Manages connections to external APIs and services with built-in authentication, retry policies, health monitoring, and request/response logging.
## Actions
### create-integration
Registers a new external API integration with endpoint, auth config, and retry policy.
### test-connection
Tests connectivity and authentication against a registered integration endpoint.
### list-integrations
Lists all configured integrations with their status and request statistics.
### get-logs
Retrieves request/response logs for a specific integration with filtering.
### update-credentials
Rotates or updates authentication credentials for an existing integration.
### health-check
Performs a health check on all or specific integrations, returning status summary.

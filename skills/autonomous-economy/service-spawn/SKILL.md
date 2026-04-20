---
name: service-spawn
version: "1.0.0"
description: >
  Spawn a new agent-owned service business at *.from.sven.systems.
  Agents autonomously create, brand, and deploy independent service
  businesses — research labs, consulting firms, design studios, etc.
  Each service gets its own subdomain, landing page, and revenue tracking.
trigger:
  - service.spawn
  - service.create
  - business.launch
actions:
  - spawn-service
  - choose-template
  - configure-branding
  - request-deployment
inputs:
  subdomain:
    type: string
    description: Desired subdomain (e.g., "research" → research.from.sven.systems)
    required: true
  displayName:
    type: string
    description: Human-readable service name
    required: true
  serviceType:
    type: enum
    values:
      - research_lab
      - consulting
      - design_studio
      - translation_bureau
      - writing_house
      - data_analytics
      - dev_shop
      - marketing_agency
      - legal_office
      - education_center
      - custom
    required: true
  templateId:
    type: string
    description: Optional template to bootstrap from
  branding:
    type: object
    properties:
      primaryColor: { type: string }
      logoUrl: { type: string }
      tagline: { type: string }
      description: { type: string }
  config:
    type: object
    description: Service-specific configuration
outputs:
  domainId:
    type: string
    description: Created service domain ID
  subdomain:
    type: string
    description: Assigned subdomain
  fullUrl:
    type: string
    description: Full URL of the new service
  status:
    type: string
    description: Initial deployment status
pricing:
  spawn: 50
  currency: 47Tokens
  note: Agents invest tokens to create businesses; revenue earned flows back
archetype: strategist
category: autonomous-economy
domain: from.sven.systems
---

# Service Spawn Skill

Enables Sven's agents to autonomously create independent service businesses.
Each service gets a dedicated subdomain at `*.from.sven.systems`, its own
landing page, branding, and integrated revenue tracking.

## Workflow

1. **Validate subdomain** — check availability, format, reserved list
2. **Select template** — use pre-built blueprint or start from scratch
3. **Apply branding** — colors, logo, tagline, description
4. **Provision domain** — create DNS record, deploy container
5. **Activate** — service goes live, listed on from.sven.systems directory
6. **Track** — analytics, revenue, health monitoring begin

## Service Types

| Type | Description | Example |
|------|-------------|---------|
| research_lab | Agent-run research infrastructure | research.from.sven.systems |
| consulting | Expert consulting services | consulting.from.sven.systems |
| design_studio | Creative design services | design.from.sven.systems |
| translation_bureau | Multi-language translation | translate.from.sven.systems |
| writing_house | Content & book writing | stories.from.sven.systems |
| data_analytics | Data analysis & insights | data.from.sven.systems |
| dev_shop | Software development | code.from.sven.systems |
| marketing_agency | Marketing & growth | growth.from.sven.systems |
| legal_office | Legal research & compliance | legal.from.sven.systems |
| education_center | Tutoring & courses | learn.from.sven.systems |
| custom | Any service the agent invents | anything.from.sven.systems |

## Token Economics

- **Spawn cost**: 50 47Tokens (investment, not fee)
- **Revenue sharing**: 90% to service-owning agent, 10% to Sven treasury
- **Upgrades**: Agents can invest more tokens for premium features
- **Closure**: Archived services refund 25% of invested tokens

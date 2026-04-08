# Website Management Agents Specification

> Sven agents that autonomously maintain the47network.com and related 47Network web properties.
> Created: 2026-04-09

---

## Overview

The Website Management Agents are a set of Sven-native agents that keep 47Network web
properties accurate, legally compliant, and reflecting current reality. They operate
through the existing agent-runtime, use NATS JetStream for orchestration, and deploy
changes through a secure pipeline to the target VMs.

**Managed properties:**
- `the47network.com` — main 47Network site (deployed on VM 547 / daedalus)
- Future: product-specific sites, documentation portals, landing pages

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    agent-runtime                          │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────┐ │
│  │ Content     │  │ Legal      │  │ Link Health        │ │
│  │ Sync Agent  │  │ Compliance │  │ Monitor Agent      │ │
│  │             │  │ Agent      │  │                    │ │
│  └──────┬─────┘  └──────┬─────┘  └────────┬───────────┘ │
│         │               │                  │             │
│         └───────────┬───┴──────────────────┘             │
│                     │                                    │
│              ┌──────▼──────┐                             │
│              │ Website     │                             │
│              │ Deploy Skill│                             │
│              └──────┬──────┘                             │
└─────────────────────┼────────────────────────────────────┘
                      │ NATS: sven.tool.execute.website-deploy
                      │
               ┌──────▼──────┐
               │ skill-runner │
               │ (gVisor)     │
               └──────┬──────┘
                      │ rsync over SSH
                      │
               ┌──────▼──────┐
               │ VM 547       │
               │ daedalus     │
               │ nginx        │
               └──────────────┘
```

---

## Agent Definitions

### 1. Content Sync Agent

**Purpose:** Keep website content reflecting what 47Network actually builds and ships.

**Triggers:**
- Scheduled: daily scan at 03:00 UTC
- Event-driven: `sven.event.release.*` — any new product release
- Event-driven: `sven.event.repo.push` — changes to docs or product metadata
- Manual: admin command via Account 47

**Responsibilities:**
- Scan product pages (`products/*.html`) against live service status and feature lists
- Update project descriptions when specs change in the repo
- Add new product pages when a new service is deployed
- Update team/about information when org changes occur
- Sync blog content from markdown sources if configured
- Generate and update `sitemap.xml` and structured data (JSON-LD)
- Validate all SEO metadata (OG tags, Twitter cards, meta descriptions)

**Data sources:**
- Git repository (product READMEs, changelogs, feature lists)
- Service health endpoints (which services are live)
- Admin-provided content updates (via Account 47 or admin-ui)

**Output:** Modified HTML files committed to the website repo branch, then deployed via Website Deploy Skill.

### 2. Legal Compliance Agent

**Purpose:** Ensure all legal pages are current, jurisdiction-appropriate, and reflect actual data practices.

**Triggers:**
- Scheduled: weekly full audit (Sundays 02:00 UTC)
- Event-driven: `sven.event.service.deploy` — new service deployment may change data practices
- Event-driven: `sven.event.policy.update` — explicit policy change signal
- Manual: admin command

**Responsibilities:**
- Monitor and update Privacy Policy for accuracy against actual data collection
- Monitor and update Terms of Service for consistency with product capabilities
- Monitor Cookie Policy against actually-deployed cookies and trackers
- Generate GDPR-required disclosures (data processing activities register)
- Track regulatory changes in applicable jurisdictions (EU, US/CCPA, etc.)
- Flag any new data collection that lacks legal basis documentation
- Ensure all legal pages have accurate "Last updated" dates
- Maintain legal page version history for audit trail
- Generate data processing impact assessments (DPIAs) when significant processing changes occur

**Compliance frameworks tracked:**
- GDPR (EU/EEA)
- CCPA/CPRA (California)
- ePrivacy Directive (cookie consent)
- Applicable national implementations

**Output:** Updated legal HTML pages + compliance report to admin. Changes always require
Account 47 approval before deployment (never auto-deployed).

### 3. Link Health Monitor Agent

**Purpose:** Ensure zero broken links, optimal performance, and security posture of all web properties.

**Triggers:**
- Scheduled: every 6 hours
- Event-driven: post-deployment validation
- Manual: admin command

**Responsibilities:**
- Crawl all pages and verify every internal and external link (HTTP status check)
- Monitor SSL certificate expiry (warn at 30 days, alert at 14 days)
- Check DNS resolution and propagation
- Validate robots.txt and sitemap.xml consistency
- Monitor page load performance (Core Web Vitals proxy via Lighthouse CLI)
- Check for mixed content (HTTP resources on HTTPS pages)
- Verify security headers (HSTS, CSP, X-Frame-Options, etc.)
- Monitor for unauthorized content changes (integrity hash comparison)
- Report broken links with suggested fixes (archive.org fallback, updated URLs)

**Output:** Health report published to admin dashboard. Critical issues (broken links,
cert expiry, security header regression) trigger immediate notification via Account 47.

---

## Website Deploy Skill

A new skill registered in the skill-runner that handles the actual deployment.

### Skill Manifest

```yaml
name: website-deploy
version: 1.0.0
description: Deploy website changes to target VM via rsync over SSH
trust_level: trusted
requires_approval: true
approval_scope: admin

permissions:
  - ssh.connect:daedalus
  - file.write:/var/www/the47network.com/

parameters:
  - name: target_vm
    type: string
    required: true
    allowed_values: ["daedalus"]
  - name: source_path
    type: string
    required: true
    description: Path to the website files in the local repo
  - name: dry_run
    type: boolean
    default: true
    description: Preview changes without deploying
  - name: backup
    type: boolean
    default: true
    description: Create timestamped backup before deploy

secrets:
  - DEPLOY_SSH_KEY  # Ed25519 key for rsync to daedalus
```

### Deployment Pipeline

```
1. Agent prepares changes (HTML edits, new files)
2. Changes committed to a `website/pending` branch in the repo
3. Agent creates a diff summary for admin review
4. Approval gate: Account 47 reviews and approves
5. Website Deploy Skill activates:
   a. Create backup: rsync current state to /var/www/backups/<timestamp>/
   b. Run dry-run: rsync --dry-run to preview changes
   c. Execute deploy: rsync --delete to target VM
   d. Post-deploy validation: curl key pages, check HTTP 200
   e. If validation fails: auto-rollback from backup
6. Link Health Monitor Agent runs post-deploy sweep
7. Agent reports deployment result to admin
```

### SSH Configuration

```
# Dedicated deploy key (read-only to repo, write to /var/www/)
# Key stored in SOPS-encrypted secrets, mounted by skill-runner
Host daedalus-deploy
  HostName 10.47.47.14
  User deploy
  IdentityFile /run/secrets/deploy-ssh-key
  StrictHostKeyChecking yes
  KnownHostsFile /run/secrets/known_hosts
```

The `deploy` user on daedalus has:
- Write access to `/var/www/the47network.com/` only
- No sudo, no shell — restricted rsync-only via `rrsync`
- All actions logged via `auditd`

---

## NATS Subject Map

| Subject | Publisher | Subscriber | Purpose |
|---------|-----------|-----------|---------|
| `sven.agent.website.content-sync` | Scheduler / Event | Content Sync Agent | Trigger content scan |
| `sven.agent.website.legal-audit` | Scheduler / Event | Legal Compliance Agent | Trigger legal review |
| `sven.agent.website.link-health` | Scheduler / Event | Link Health Monitor | Trigger health check |
| `sven.tool.execute.website-deploy` | Any website agent | skill-runner | Execute deployment |
| `sven.tool.result.website-deploy.<id>` | skill-runner | Requesting agent | Deploy result |
| `sven.event.website.deployed` | Website Deploy Skill | All website agents | Post-deploy notification |
| `sven.event.website.health-report` | Link Health Monitor | admin-ui / Account 47 | Health report |
| `sven.event.website.legal-alert` | Legal Compliance Agent | Account 47 | Legal issue alert |

---

## Agent Registration

All website management agents are registered as system-level agents in the agent registry:

```typescript
// Agent registration in gateway-api
{
  name: 'website-content-sync',
  display_name: 'Website Content Sync',
  type: 'system',
  is_agent: true,
  org_id: '47network',  // scoped to 47Network organization
  capabilities: ['website.read', 'website.write', 'git.read', 'git.write'],
  schedule: { cron: '0 3 * * *', timezone: 'UTC' },
  trust_level: 'trusted',
  max_concurrent_runs: 1,
}
```

---

## Content Update Workflow

### Automated Updates (Content Sync)

```
1. Agent detects change (schedule or event trigger)
2. Agent reads current website files from repo
3. Agent reads source of truth (product docs, READMEs, changelogs)
4. Agent generates diff: what needs to change
5. If changes are cosmetic/data-only:
   a. Agent commits to website/pending branch
   b. Notifies Account 47 with summary
   c. Waits for approval
6. If changes are structural (new pages, layout changes):
   a. Agent creates detailed proposal with preview
   b. Requires explicit Account 47 approval
   c. May request human review for design decisions
7. On approval: Website Deploy Skill executes
```

### Manual Updates (Admin-Initiated)

```
1. Account 47 instructs Sven: "Update the products page to add [new product]"
2. Content Sync Agent receives instruction
3. Agent generates the update, shows preview
4. Account 47 confirms
5. Deploy pipeline executes
```

---

## Security Model

- **Least privilege:** Each agent has only the permissions it needs. Content Sync
  can read/write website files but cannot modify legal pages. Legal Compliance
  Agent cannot modify product content.
- **Approval gates:** All deployments require Account 47 approval. No auto-deploy
  to production without human confirmation.
- **Audit trail:** Every change is committed to git with agent identity as author.
  Full traceability from trigger → change → approval → deployment.
- **Sandboxed execution:** All skills run in gVisor. SSH keys never leave the
  skill-runner container.
- **Integrity monitoring:** Link Health Monitor maintains content hashes. Any
  unauthorized change (not through the pipeline) triggers immediate alert.
- **Rollback:** Every deploy creates a timestamped backup. One-command rollback
  available through Account 47.

---

## Database Schema Additions

```sql
-- Website deployment audit log
CREATE TABLE website_deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id),
  target_vm TEXT NOT NULL,
  source_commit TEXT NOT NULL,
  files_changed INTEGER NOT NULL,
  dry_run BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'deploying', 'deployed', 'failed', 'rolled_back')),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  deployed_at TIMESTAMPTZ,
  rollback_path TEXT,
  diff_summary JSONB NOT NULL,
  validation_result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Website health check results
CREATE TABLE website_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id),
  target_domain TEXT NOT NULL,
  check_type TEXT NOT NULL CHECK (check_type IN ('links', 'ssl', 'dns', 'performance', 'security', 'integrity')),
  status TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'critical')),
  details JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Content change proposals (pending approval)
CREATE TABLE website_content_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  diff JSONB NOT NULL,          -- file path → unified diff
  change_type TEXT NOT NULL CHECK (change_type IN ('content', 'legal', 'structural', 'seo')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'deployed')),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  deployment_id UUID REFERENCES website_deployments(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_website_deployments_status ON website_deployments(status);
CREATE INDEX idx_website_health_checks_domain ON website_health_checks(target_domain, created_at DESC);
CREATE INDEX idx_website_content_proposals_status ON website_content_proposals(status);
```

---

## Integration with Existing Systems

- **agent-runtime:** Website agents are standard Sven agents, executed by the same
  runtime as all other agents. No special runtime needed.
- **skill-runner:** Website Deploy Skill runs in gVisor sandbox, same as all tools.
- **gateway-api:** Health reports and proposals exposed via `/api/v1/admin/website/` endpoints.
- **admin-ui:** New dashboard section for website management — deployments, health, proposals.
- **NATS JetStream:** All events use existing stream infrastructure with new subjects.
- **RAG indexer:** Website content can be indexed for Sven to answer questions about
  the 47Network site content.

---

## Managed Websites

| Domain | VM | Path | Agents |
|--------|-----|------|--------|
| the47network.com | daedalus (547) | /var/www/the47network.com/ | Content Sync, Legal Compliance, Link Health |
| Future: sven.systems | VM 704 | /srv/sven/prod/src/ | Content Sync, Link Health |
| Future: docs.sven.systems | TBD | TBD | Content Sync, Link Health |

---

## Future Extensions

- **A/B testing agent:** Test content variations, measure engagement
- **SEO optimization agent:** Track search rankings, suggest improvements
- **Multilingual agent:** Manage EN/RO and additional language versions
- **Analytics agent:** Process privacy-respecting analytics, generate reports
- **Accessibility agent:** Automated WCAG 2.1 AA compliance scanning

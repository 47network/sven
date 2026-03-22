# Security Policy

## Supported Versions

Only the latest release receives security fixes. We recommend always running the most recent version.

| Version | Supported |
|:--------|:---------:|
| 0.1.x (latest) | ✅ |
| < 0.1.0 | ❌ |

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Use one of the following private channels:

1. **GitHub Security Advisories (preferred)** — [Open a private advisory](https://github.com/47network/thesven/security/advisories/new). This allows structured, confidential discussion with maintainers and results in a tracked CVE if warranted.

2. **Email** — Send details to `security@the47network.com`.

### What to include

- Affected component(s) / service(s)
- Severity assessment (CVSS score if possible)
- Reproduction steps or proof-of-concept
- Suggested remediation (if available)
- Whether you would like credit in the advisory

## Response Expectations

| Stage | Target |
|:------|:-------|
| Initial acknowledgment | Within **2 business days** |
| Severity triage | Within **5 business days** |
| Fix or mitigation available | Dependent on severity — critical within **14 days** |
| Coordinated public disclosure | After fix is validated and released |

## Handling Guidelines

- Do not disclose publicly until maintainers confirm remediation is available.
- If you believe secrets may have been exposed, rotate them immediately and inform the maintainers.
- Preserve logs and evidence needed for incident investigation — do not delete.
- We follow [responsible disclosure](https://en.wikipedia.org/wiki/Responsible_disclosure) and will work with you on timing.

## Security Architecture References

| Document | Contents |
|:---------|:---------|
| [`docs/security/threat-model.md`](docs/security/threat-model.md) | Threat model, attack surface, mitigations |
| [`docs/security/incident-response-playbook.md`](docs/security/incident-response-playbook.md) | Triage, escalation, and communication playbook |
| [`docs/security/ui-app-security-baseline.md`](docs/security/ui-app-security-baseline.md) | Frontend security baseline |
| [`docs/release/section-k-security-privacy.md`](docs/release/section-k-security-privacy.md) | Full security and privacy assessment |

## Scope

The following are **in scope**:
- All services in `services/`
- All apps in `apps/`
- Docker Compose and deployment configurations
- CI/CD workflows
- Authentication and authorisation flows

The following are **out of scope**:
- Third-party upstream dependencies (report to the upstream project directly)
- Issues in self-hosted infrastructure not caused by Sven itself
- Theoretical attacks without a proof of concept

## Acknowledgements

We are grateful to security researchers who responsibly disclose vulnerabilities. Confirmed reporters will be credited in the release notes unless they request anonymity.

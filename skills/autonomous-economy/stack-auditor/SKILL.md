---
name: stack-auditor
description: Dependency auditing for vulnerabilities, license compliance, and outdated packages
version: 1.0.0
price: 7.99
currency: 47Token
archetype: analyst
---

## Actions
- audit: Run full dependency audit
- vulnerabilities: Check for known CVEs
- licenses: Verify license compliance
- outdated: Find outdated dependencies with upgrade paths

## Inputs
- scope: Audit scope (dependencies, licenses, vulnerabilities)
- severityThreshold: Minimum severity to report
- exclusions: Packages to exclude from audit
- autoFix: Whether to auto-apply safe fixes

## Outputs
- findings: List of audit findings
- criticalCount: Number of critical issues
- fixAvailable: Number of issues with available fixes
- report: Full audit report with recommendations

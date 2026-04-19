---
name: secrets-rotator
description: Rotate secrets on schedule. Track rotation history, warn on overdue rotations, integrate with vault backends.
version: 1.0.0
author: sven
pricing: 0.05 per rotation
archetype: engineer
tags: [secrets, rotation, security, vault, credentials]
---

## Actions
- rotate: Rotate a specific secret
- schedule: View/modify rotation schedule
- check-overdue: Find secrets past rotation deadline
- history: Get rotation history
- bulk-rotate: Rotate all overdue secrets
- verify: Verify a secret is valid post-rotation

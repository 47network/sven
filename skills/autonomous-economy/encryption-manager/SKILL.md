---
name: encryption-manager
description: Manages encryption keys, envelope encryption, and encrypted data registry for agent secrets and credentials
version: 1.0.0
price: 15.99
currency: USD
archetype: engineer
category: security-compliance
tags: [encryption, key-management, security, aes, cryptography]
---

# Encryption Manager

Provides comprehensive encryption key lifecycle management including generation, rotation, and destruction. Supports envelope encryption, HSM integration, and encrypted data tracking.

## Actions
- **generate-key**: Generate a new encryption key with specified algorithm and purpose
- **rotate-key**: Rotate an existing key, re-encrypting all associated data
- **encrypt-data**: Encrypt data using managed keys with envelope encryption
- **decrypt-data**: Decrypt data using the appropriate key version
- **list-keys**: List all managed encryption keys with status and metadata
- **destroy-key**: Securely destroy an encryption key after confirmation

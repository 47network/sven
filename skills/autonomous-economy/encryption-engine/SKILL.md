---
name: encryption-engine
description: Provides cryptographic operations including encryption, decryption, signing, verification, and key management
version: 1.0.0
pricing: 24.99
currency: USD
billing: per_config
archetype: engineer
tags: [encryption, cryptography, signing, keys, hashing, security]
---
# Encryption Engine
Performs cryptographic operations with key lifecycle management, supporting multiple algorithms and key derivation functions.
## Actions
### encrypt-data
Encrypts data using a specified key and algorithm, returning ciphertext and metadata.
### decrypt-data
Decrypts ciphertext using the corresponding key, verifying integrity.
### generate-key
Generates a new encryption key with specified algorithm, purpose, and expiration.
### sign-data
Creates a digital signature for data using a signing key.
### verify-signature
Verifies a digital signature against the original data and signing key.
### list-keys
Lists encryption keys with status, purpose, and expiration information.

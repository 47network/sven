# Key Rotation Procedure

## Overview

This document describes the process for rotating the master encryption key used by Sven. The master key encrypts user Data Encryption Keys (DEKs), which in turn encrypt sensitive data like user_private memories and encrypted artifacts.

## Prerequisites

- Access to SOPS/age or Vault (whichever stores the master key)
- Admin access to the Sven database
- The rotation must be performed during a maintenance window with minimal activity
- Backup database before starting rotation

## Key Rotation Process

### Phase 1: Generate New Master Key

1. **Generate new master key externally**:
   ```bash
   # Using age
   age-keygen -o master-key-v2.age
   
   # Or using SOPS + age
   sops -e -i secrets/master-key-v2.yaml
   ```

2. **Store new master key securely**:
   - Add to `.sops.yaml` if using SOPS
   - Store in Vault under `secret/master-key-v2` if using Vault
   - Set environment variable `SVEN_MASTER_KEY_V2`

3. **Generate corresponding salt**:
   ```bash
   # Generate random salt (16 bytes recommended)
   openssl rand -base64 16
   ```

4. **Store salt securely**:
   - Add to SOPS/Vault alongside master key
   - Set environment variable `SVEN_MASTER_SALT_V2`

### Phase 2: Register New Master Key in Database

1. **Stop all services that access user_keys**:
   ```bash
   docker compose stop agency-runtime skill-runner gateway-api
   ```

2. **Register new master key metadata**:
   ```sql
   INSERT INTO master_key_metadata (
       id,
       key_version,
       algorithm,
       key_ref,
       kdf_algorithm,
       kdf_iterations,
       salt_ref,
       is_active,
       created_at
   ) VALUES (
       'mkey-v2',
       2,
       'aes-256-gcm',
       'env://SVEN_MASTER_KEY_V2',
       'pbkdf2-sha256',
       100000,
       'env://SVEN_MASTER_SALT_V2',
       FALSE,  -- Not yet active
       NOW()
   );
   ```

3. **Verify new key metadata**:
   ```sql
   SELECT * FROM master_key_metadata WHERE key_version = 2;
   ```

### Phase 3: Re-encrypt User DEKs

1. **Create re-encryption job**:
   ```sql
   INSERT INTO key_rotation_events (
       id,
       from_key_version,
       to_key_version,
       event_type,
       triggered_by,
       status,
       started_at
   ) VALUES (
       'kr-' || gen_random_uuid()::TEXT,
       1,  -- from v1
       2,  -- to v2
       'rotated',
       'admin-user-id',
       'in_progress',
       NOW()
   );
   ```

2. **Re-encrypt all user DEKs** (run this job):
   ```bash
   # This would be implemented as a Node.js job that:
   # 1. Fetches all user_keys from the database
   # 2. For each user_key:
   #    a. Gets the old master key (v1)
   #    b. Unwraps the DEK using old master key
   #    c. Gets the new master key (v2)
   #    d. Wraps the same DEK using new master key
   #    e. Updates user_keys with new wrapped_dek
   # 3. Updates key_rotation_events with row count
   
   npm run key-rotate --workspace services/gateway-api
   ```

3. **Monitor re-encryption progress**:
   ```sql
   SELECT * FROM key_rotation_events WHERE event_type = 'rotated' ORDER BY started_at DESC LIMIT 1;
   ```

4. **On completion, mark new key as active and old key as deprecated**:
   ```sql
   -- Mark new key as active
   UPDATE master_key_metadata SET is_active = TRUE WHERE key_version = 2;
   
   -- Mark old key as deprecated
   UPDATE master_key_metadata SET deprecated_at = NOW() WHERE key_version = 1;
   
   -- Mark rotation event as completed
   UPDATE key_rotation_events 
   SET status = 'completed', completed_at = NOW() 
   WHERE id = 'kr-...';  -- Use the event ID from Phase 3.1
   ```

### Phase 4: Restart Services

1. **Start services with new key**:
   ```bash
   # Update docker-compose.yml or .env to reference SVEN_MASTER_KEY_V2
   docker compose up -d
   ```

2. **Verify services are healthy**:
   ```bash
   docker compose logs --tail=50 -f gateway-api
   ```

3. **Smoke test user operations**:
   - Create a memory (user_private data)
   - Fetch the memory to verify decryption works
   - Check logs for any decryption errors

### Phase 5: Cleanup (After Verification)

1. **After 7 days of stable operation**, remove the old master key:
   ```sql
   -- Archive old key metadata (don't delete, keep for audit)
   -- In a real system, you'd archive to a separate table
   
   -- Remove old environment variable from .env
   -- (Don't remove from SOPS/Vault yet - keep for at least 30 days for recovery)
   ```

2. **Document rotation**:
   - Record the date and time of rotation
   - Note any issues or anomalies
   - Update disaster recovery runbook

## Rollback Procedure

If the rotation fails or needs to be rolled back:

1. **Stop all services**:
   ```bash
   docker compose stop
   ```

2. **Mark rotation as failed and revert active key**:
   ```sql
   UPDATE master_key_metadata SET is_active = FALSE WHERE key_version = 2;
   UPDATE master_key_metadata SET is_active = TRUE WHERE key_version = 1;
   UPDATE key_rotation_events 
   SET status = 'failed', 
       error_message = 'Rollback initiated', 
       completed_at = NOW() 
   WHERE id = 'kr-...';
   ```

3. **Revert to old master key in environment**:
   ```bash
   # Restore SVEN_MASTER_KEY_V1 in docker-compose.yml
   docker compose up -d
   ```

4. **Verify data integrity**:
   - Check if user memories can be decrypted
   - Verify no new user_keys were created during rotation
   - Check error logs

5. **Investigate failure and retry** (after resolving issue)

## Manual DEK Unwrap/Rewrap (Emergency)

If you need to manually decrypt a wrapped DEK for emergency access:

```typescript
import { unwrapDataKey, wrapDataKey } from '@sven/shared';

// Get old master key from SOPS/Vault
const oldMasterKey = Buffer.from(process.env.SVEN_MASTER_KEY_V1!, 'base64');

// Get user_keys row from database
const wrappedKeyData = {
  version: 1,
  algorithm: 'aes-256-gcm',
  wrapped_key: /* from database */,
  kdf_salt: /* from database */,
  kdf_iterations: 100000,
};

// Unwrap DEK with old master key
const dek = unwrapDataKey(wrappedKeyData, oldMasterKey);

// Get new master key
const newMasterKey = Buffer.from(process.env.SVEN_MASTER_KEY_V2!, 'base64');
const newSalt = Buffer.from(process.env.SVEN_MASTER_SALT_V2!, 'base64');

// Wrap DEK with new master key
const newWrappedKey = wrapDataKey(dek, newMasterKey, newSalt);

// Update database with new wrapped DEK
await pool.query(
  `UPDATE user_keys SET wrapped_dek = $1 WHERE user_id = $2`,
  [JSON.stringify(newWrappedKey), userId]
);
```

## Monitoring & Alerts

The following should be monitored during key rotation:

- Error logs in `key-rotate` job output
- Database performance (lock times on user_keys table)
- Service memory/CPU during re-encryption
- Decryption failures after rotation

## Disaster Recovery

If master key is lost or compromised:

1. **Revoke compromised key immediately**:
   ```sql
   UPDATE master_key_metadata SET is_active = FALSE WHERE key_version = 1;
   ```

2. **Take system offline** to prevent recovery of sensitive data

3. **Restore from backup**:
   - Recover database from pre-incident backup
   - OR regenerate master key and perform emergency re-keying of all users

4. **Audit affected data**:
   - Review logs of who accessed what data
   - Notify users if necessary

5. **Implement enhanced key protection**:
   - Consider hardware security module (HSM) for master key storage
   - Implement key access auditing
   - Restrict key access to specific services/containers

## Questions?

Contact: Security Team (@sven-security)
Last Updated: 2026-02-10

import { getPool } from '../db/pool.js';
import { nanoid } from 'nanoid';

/**
 * Restore Service
 * Handles detailed restore operations, data verification, and RTO/RPO metrics
 */

interface RestorePoint {
  id: string;
  backupTime: Date;
  snapshotTag: string;
  size: number;
  type: 'backup' | 'snapshot';
}

interface RPOMetrics {
  targetRPO: number; // minutes
  actualRPO: number; // minutes
  compliant: boolean;
  lastSuccessfulBackup: Date;
  daysSinceBackup: number;
}

interface RTOMetrics {
  targetRTO: number; // minutes
  actualRTO: number; // minutes
  compliant: boolean;
  averageRestoreTime: number; // minutes
  recovery_point_objective?: string;
  recovery_time_objective?: string;
}

const pool = getPool();
const RESTORE_POINTS_MIN_LIMIT = 1;
const RESTORE_POINTS_MAX_LIMIT = 500;
const RESTORE_POINTS_DEFAULT_LIMIT = 100;

function normalizeRestorePointsLimit(limit: unknown): number {
  const parsed = Number(limit);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return RESTORE_POINTS_DEFAULT_LIMIT;
  return Math.min(RESTORE_POINTS_MAX_LIMIT, Math.max(RESTORE_POINTS_MIN_LIMIT, parsed));
}

/**
 * List all available restore points (backups and snapshots)
 */
export async function listAvailableRestorePoints(
  limit: number = 100
): Promise<RestorePoint[]> {
  try {
    const boundedLimit = normalizeRestorePointsLimit(limit);
    // Get backups
    const backupResult = await pool.query(
      `SELECT id, started_at as backup_time, total_size_bytes, 'backup' as type
       FROM backup_jobs
       WHERE status IN ('completed', 'verified')
       ORDER BY started_at DESC
       LIMIT $1`,
      [boundedLimit]
    );

    const restorePoints = backupResult.rows.map((r) => ({
      id: r.id,
      backupTime: r.backup_time,
      snapshotTag: `backup-${r.id.substring(0, 8)}`,
      size: r.total_size_bytes || 0,
      type: 'backup' as const,
    }));

    // Get snapshots
    const snapshotResult = await pool.query(
      `SELECT id, snapshot_time, total_size_bytes, tags
       FROM snapshot_jobs
       WHERE status = 'available'
       ORDER BY snapshot_time DESC
       LIMIT $1`,
      [Math.max(0, boundedLimit - restorePoints.length)]
    );

    const snapshotPoints = snapshotResult.rows.map((r) => ({
      id: r.id,
      backupTime: r.snapshot_time,
      snapshotTag: r.tags ? JSON.parse(r.tags)[0] : `snapshot-${r.id.substring(0, 8)}`,
      size: r.total_size_bytes || 0,
      type: 'snapshot' as const,
    }));

    return [...restorePoints, ...snapshotPoints];
  } catch (error) {
    console.error('Failed to list restore points:', error);
    return [];
  }
}

/**
 * Calculate Recovery Point Objective (RPO) metrics
 * RPO = maximum amount of data loss acceptable (time since last backup)
 */
export async function calculateRPOMetrics(): Promise<RPOMetrics> {
  try {
    // Get target RPO from config (default 1440 = 24 hours)
    const configResult = await pool.query(
      `SELECT retention_days FROM backup_config WHERE backup_type = 'incremental' LIMIT 1`
    );

    const targetRPO = 1440; // 24 hours in minutes

    // Get last successful backup
    const backupResult = await pool.query(
      `SELECT completed_at FROM backup_jobs 
       WHERE status IN ('completed', 'verified')
       ORDER BY completed_at DESC
       LIMIT 1`
    );

    if (backupResult.rows.length === 0) {
      return {
        targetRPO,
        actualRPO: -1, // No backup available
        compliant: false,
        lastSuccessfulBackup: new Date(0),
        daysSinceBackup: 0,
      };
    }

    const lastBackup = backupResult.rows[0].completed_at;
    const now = new Date();
    const minutesSinceBackup = Math.floor((now.getTime() - lastBackup.getTime()) / 60000);
    const daysSinceBackup = Math.floor(minutesSinceBackup / 1440);

    return {
      targetRPO,
      actualRPO: minutesSinceBackup,
      compliant: minutesSinceBackup <= targetRPO,
      lastSuccessfulBackup: lastBackup,
      daysSinceBackup,
    };
  } catch (error) {
    console.error('Failed to calculate RPO metrics:', error);
    return {
      targetRPO: 1440,
      actualRPO: 0,
      compliant: false,
      lastSuccessfulBackup: new Date(),
      daysSinceBackup: 0,
    };
  }
}

/**
 * Calculate Recovery Time Objective (RTO) metrics
 * RTO = maximum acceptable downtime (time to restore from backup)
 */
export async function calculateRTOMetrics(): Promise<RTOMetrics> {
  try {
    // Get target RTO from config (default 60 minutes)
    const targetRTO = 60;

    // Calculate average restore time from recent successful restores
    const restoreResult = await pool.query(
      `SELECT AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) / 60) as avg_duration
       FROM restore_jobs
       WHERE status = 'completed' AND completed_at IS NOT NULL
       AND completed_at > CURRENT_TIMESTAMP - INTERVAL '30 days'`
    );

    const averageRestoreTime = restoreResult.rows[0]?.avg_duration || 45; // Default 45 minutes

    return {
      targetRTO,
      actualRTO: Math.ceil(averageRestoreTime),
      compliant: averageRestoreTime <= targetRTO,
      averageRestoreTime: Math.ceil(averageRestoreTime),
      recovery_time_objective: `${targetRTO} minutes`,
      recovery_point_objective: `Last backup`,
    };
  } catch (error) {
    console.error('Failed to calculate RTO metrics:', error);
    return {
      targetRTO: 60,
      actualRTO: 0,
      compliant: false,
      averageRestoreTime: 0,
      recovery_time_objective: '60 minutes',
      recovery_point_objective: 'Last backup',
    };
  }
}

/**
 * Verify data integrity after restore
 */
export async function verifyRestoreDataIntegrity(restoreJobId: string): Promise<{
  success: boolean;
  issues: string[];
  summary: string;
}> {
  try {
    const result = await pool.query(
      `SELECT id, data_verification_passed, verification_details FROM restore_jobs WHERE id = $1`,
      [restoreJobId]
    );

    if (result.rows.length === 0) {
      return {
        success: false,
        issues: ['Restore job not found'],
        summary: 'Restore job not found',
      };
    }

    const restore = result.rows[0];
    const issues: string[] = [];

    // Check critical tables exist
    const tableCheckResult = await pool.query(
      `SELECT COUNT(*) as table_count FROM information_schema.tables 
       WHERE table_schema = 'public' AND table_name IN ('users', 'chats', 'approvals')`
    );

    if (tableCheckResult.rows[0].table_count < 3) {
      issues.push('Missing critical tables after restore');
    }

    // Check for data consistency
    const recordCountResult = await pool.query(
      `SELECT table_name, row_count FROM 
         (SELECT 'users' as table_name, COUNT(*) as row_count FROM users
          UNION ALL
          SELECT 'chats', COUNT(*) FROM chats
          UNION ALL
          SELECT 'approvals', COUNT(*) FROM approvals) as t
       ORDER BY row_count DESC`
    );

    if (recordCountResult.rows.every((r) => r.row_count === 0)) {
      issues.push('Restored database appears to be empty');
    }

    const success = issues.length === 0 && restore.data_verification_passed;

    // Log verification
    await pool.query(
      `INSERT INTO backup_audit_log (action_type, resource_type, resource_id, details)
       VALUES ('restore_verified', 'restore_job', $1, $2)`,
      [restoreJobId, JSON.stringify({ success, issues })]
    );

    return {
      success,
      issues,
      summary: success ? 'Data integrity verified' : `Found ${issues.length} issues`,
    };
  } catch (error) {
    console.error('Failed to verify restore data integrity:', error);
    return {
      success: false,
      issues: ['Verification error: ' + (error instanceof Error ? error.message : String(error))],
      summary: 'Verification failed',
    };
  }
}

/**
 * Continue a restore operation (in case of interruption)
 */
export async function continueRestore(restoreJobId: string): Promise<{ success: boolean }> {
  try {
    // Check if restore is paused or interrupted
    const result = await pool.query(
      `SELECT status FROM restore_jobs WHERE id = $1`,
      [restoreJobId]
    );

    if (result.rows.length === 0) {
      throw new Error('Restore job not found');
    }

    const currentStatus = result.rows[0].status;

    if (currentStatus === 'paused' || currentStatus === 'interrupted') {
      await pool.query(
        `UPDATE restore_jobs SET status = 'resuming', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [restoreJobId]
      );

      // Simulate resuming restore
      setTimeout(async () => {
        try {
          await pool.query(
            `UPDATE restore_jobs SET status = 'running' WHERE id = $1`,
            [restoreJobId]
          );
        } catch (err) {
          console.error('Failed to resume restore:', err);
        }
      }, 1000);

      return { success: true };
    }

    return { success: false };
  } catch (error) {
    console.error('Failed to continue restore:', error);
    throw error;
  }
}

/**
 * Cancel an in-progress restore
 */
export async function cancelRestore(restoreJobId: string, reason: string): Promise<{ success: boolean }> {
  try {
    const result = await pool.query(
      `UPDATE restore_jobs 
       SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP, cancellation_reason = $1
       WHERE id = $2 AND status IN ('pending', 'running')
       RETURNING id`,
      [reason, restoreJobId]
    );

    if (result.rows.length === 0) {
      throw new Error('Restore job not found or already completed');
    }

    await pool.query(
      `INSERT INTO backup_audit_log (action_type, resource_type, resource_id, details)
       VALUES ('restore_cancelled', 'restore_job', $1, $2)`,
      [restoreJobId, JSON.stringify({ reason })]
    );

    return { success: true };
  } catch (error) {
    console.error('Failed to cancel restore:', error);
    throw error;
  }
}

/**
 * Get restore statistics
 */
export async function getRestoreStatistics(): Promise<{
  totalRestores: number;
  successfulRestores: number;
  failedRestores: number;
  averageRestoreTimeMinutes: number;
  successRate: number;
}> {
  try {
    const result = await pool.query(
      `SELECT 
         COUNT(*) as total,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful,
         SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
         AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) / 60) as avg_duration
       FROM restore_jobs
       WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '90 days'`
    );

    const stats = result.rows[0];

    return {
      totalRestores: parseInt(stats.total) || 0,
      successfulRestores: parseInt(stats.successful) || 0,
      failedRestores: parseInt(stats.failed) || 0,
      averageRestoreTimeMinutes: Math.ceil(stats.avg_duration || 0),
      successRate:
        stats.total > 0 ? Math.round(((stats.successful || 0) / stats.total) * 100) : 0,
    };
  } catch (error) {
    console.error('Failed to get restore statistics:', error);
    return {
      totalRestores: 0,
      successfulRestores: 0,
      failedRestores: 0,
      averageRestoreTimeMinutes: 0,
      successRate: 0,
    };
  }
}

/**
 * Get partial restore capability (restore specific tables only)
 */
export async function initiatePartialRestore(
  backupJobId: string,
  tablesToRestore: string[],
  targetEnvironment: string,
  initiatedBy: string
): Promise<{ restoreId: string; tablesQueued: number }> {
  try {
    const restoreId = nanoid();

    // Create partial restore job
    await pool.query(
      `INSERT INTO restore_jobs 
       (id, backup_job_id, target_environment, status, initiated_by, partial_restore, tables_to_restore)
       VALUES ($1, $2, $3, 'pending', $4, true, $5)`,
      [restoreId, backupJobId, targetEnvironment, initiatedBy, JSON.stringify(tablesToRestore)]
    );

    await pool.query(
      `INSERT INTO backup_audit_log (action_type, resource_type, resource_id, details)
       VALUES ('partial_restore_initiated', 'restore_job', $1, $2)`,
      [restoreId, JSON.stringify({ tables: tablesToRestore })]
    );

    return {
      restoreId,
      tablesQueued: tablesToRestore.length,
    };
  } catch (error) {
    console.error('Failed to initiate partial restore:', error);
    throw error;
  }
}

/**
 * Get restore procedure with safeguards
 */
export async function getRestoreProcedureWithSafeguards(): Promise<string> {
  return `
# Safe Restore Procedure

## Pre-Restore Checks (MUST COMPLETE BEFORE PROCEEDING)

### 1. Backup Verification
- [ ] Backup status verified as 'completed' or 'verified'
- [ ] Backup file hash matches original checkpoint
- [ ] Backup size reasonable (not suspiciously small)
- [ ] Creation time within expected retention window

### 2. Target Environment Validation
- [ ] Target environment (prod/staging/dev) confirmed
- [ ] Target environment disk space >= 2x backup size
- [ ] No active users connected to target database
- [ ] Backup of target (if production) completed

### 3. Permissions & Authorization
- [ ] User has restore permission for target environment
- [ ] Approval chain completed (if production restore)
- [ ] Change management ticket created
- [ ] Stakeholders notified

## Restore Execution

### Step 1: Initiate Restore
\`\`\`
POST /backup/restore
{
  "backup_job_id": "backup-uuid",
  "target_environment": "staging|production",
  "reason": "JIRA-1234: Critical data recovery"
}
\`\`\`

### Step 2: Monitor Progress
- Expected duration: 15-90 minutes
- Monitor via: GET /backup/restore/{restore_id}
- Check status transitions: pending → running → completed

### Step 3: Data Verification (REQUIRED)
- POST /backup/restore/{restore_id}/verify
- Verify all critical tables present
- Compare row counts with production
- Run test queries on critical functions

### Step 4: Validation
- [ ] Application can connect to restored DB
- [ ] Read operations work
- [ ] Write operations work
- [ ] No orphaned references
- [ ] Indexes rebuilt

## Rollback Procedure

If issues detected:
1. Stop all application connections to restored database
2. Call POST /backup/restore/{id}/cancel
3. Restore previous state or revert to known-good backup
4. Verify application connections restored to original DB
5. Document incident and findings

## Emergency Abort

If restore corrupts data:
1. Activate incident response: POST /incident/kill-switch/activate
2. Prevent further writes to database
3. Contact DBA team immediately
4. Do NOT attempt additional restores without approval

## Success Criteria

- [ ] All tables present with correct schema
- [ ] Row counts match within 0.1% of original
- [ ] No corrupted indexes or constraints
- [ ] Full application functionality works
- [ ] No data loss detected
- [ ] Performance metrics acceptable

## Estimated Recovery Time
- Full restore (production): 30-90 minutes
- Partial restore (staging): 10-30 minutes
- Data verification: 5-15 minutes
- Total activation time: 45-120 minutes
`;
}

/**
 * Generate backup health report
 */
export async function generateBackupHealthReport(): Promise<{
  overallHealth: string;
  backupFrequency: string;
  lastBackupAge: string;
  restoreCapability: string;
  recommendations: string[];
}> {
  try {
    const rpoMetrics = await calculateRPOMetrics();
    const rtoMetrics = await calculateRTOMetrics();

    const recommendations: string[] = [];

    if (!rpoMetrics.compliant) {
      recommendations.push(
        'RPO compliance issue: Backup frequency not meeting targets. Enable continuous backups.'
      );
    }

    if (!rtoMetrics.compliant) {
      recommendations.push(
        'RTO compliance issue: Average restore time exceeds target. Consider optimizing restore process.'
      );
    }

    if (rpoMetrics.daysSinceBackup > 7) {
      recommendations.push(
        `Last backup is ${rpoMetrics.daysSinceBackup} days old. Schedule backup immediately.`
      );
    }

    const overallHealth =
      rpoMetrics.compliant && rtoMetrics.compliant ? 'healthy' : 'needs_attention';

    return {
      overallHealth,
      backupFrequency: `RPO: ${rpoMetrics.targetRPO} minutes`,
      lastBackupAge: `${rpoMetrics.daysSinceBackup} days ago`,
      restoreCapability: `RTO: ${rtoMetrics.actualRTO} minutes (target: ${rtoMetrics.targetRTO})`,
      recommendations,
    };
  } catch (error) {
    console.error('Failed to generate backup health report:', error);
    return {
      overallHealth: 'error',
      backupFrequency: 'unknown',
      lastBackupAge: 'unknown',
      restoreCapability: 'unknown',
      recommendations: ['Alert: Unable to generate health report'],
    };
  }
}

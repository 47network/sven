// ---------------------------------------------------------------------------
// NATS Event Publisher — Security Toolkit
// ---------------------------------------------------------------------------
// Publishes security scan events for cross-service coordination and
// real-time alerting on critical findings.
// ---------------------------------------------------------------------------

import { type NatsConnection, JSONCodec } from 'nats';
import { NATS_SUBJECTS } from '@sven/shared';

const jc = JSONCodec();

export class SecurityPublisher {
  constructor(private readonly nc: NatsConnection) {}

  publishSastComplete(scanId: string, orgId: string, findingsCount: number, severitySummary: Record<string, number>): void {
    this.nc.publish(
      NATS_SUBJECTS.SECURITY_SAST_COMPLETE,
      jc.encode({ scanId, orgId, findingsCount, severitySummary, timestamp: new Date().toISOString() }),
    );
  }

  publishSecretScanComplete(scanId: string, orgId: string, secretsFound: number, clean: boolean): void {
    this.nc.publish(
      NATS_SUBJECTS.SECURITY_SECRET_SCAN_COMPLETE,
      jc.encode({ scanId, orgId, secretsFound, clean, timestamp: new Date().toISOString() }),
    );
  }

  publishSecretFound(scanId: string, orgId: string, secretType: string, severity: string, filePath: string, redacted: string): void {
    this.nc.publish(
      NATS_SUBJECTS.SECURITY_SECRET_FOUND,
      jc.encode({ scanId, orgId, secretType, severity, filePath, redacted, timestamp: new Date().toISOString() }),
    );
  }

  publishDepAuditComplete(scanId: string, orgId: string, findingsCount: number, severitySummary: Record<string, number>): void {
    this.nc.publish(
      NATS_SUBJECTS.SECURITY_DEP_AUDIT_COMPLETE,
      jc.encode({ scanId, orgId, findingsCount, severitySummary, timestamp: new Date().toISOString() }),
    );
  }

  publishInfraAuditComplete(scanId: string, orgId: string, findingsCount: number, securityScore: number): void {
    this.nc.publish(
      NATS_SUBJECTS.SECURITY_INFRA_AUDIT_COMPLETE,
      jc.encode({ scanId, orgId, findingsCount, securityScore, timestamp: new Date().toISOString() }),
    );
  }

  publishPentestComplete(runId: string, orgId: string, scenarioId: string, status: string, vulnerabilitiesFound: number): void {
    this.nc.publish(
      NATS_SUBJECTS.SECURITY_PENTEST_COMPLETE,
      jc.encode({ runId, orgId, scenarioId, status, vulnerabilitiesFound, timestamp: new Date().toISOString() }),
    );
  }

  publishPostureGenerated(postureId: string, orgId: string, grade: string, overallScore: number): void {
    this.nc.publish(
      NATS_SUBJECTS.SECURITY_POSTURE_GENERATED,
      jc.encode({ postureId, orgId, grade, overallScore, timestamp: new Date().toISOString() }),
    );
  }

  publishCriticalFinding(scanId: string, orgId: string, ruleId: string, title: string, filePath: string | null, severity: string): void {
    this.nc.publish(
      NATS_SUBJECTS.SECURITY_CRITICAL_FINDING,
      jc.encode({ scanId, orgId, ruleId, title, filePath, severity, timestamp: new Date().toISOString() }),
    );
  }
}

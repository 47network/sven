// ---------------------------------------------------------------------------
// Security Toolkit Service — Entry Point
// ---------------------------------------------------------------------------
// Standalone service for security scanning: SAST, dependency audit, secret
// scanning, infrastructure auditing, pentest scenario management, and
// unified security posture reporting with Postgres persistence and NATS events.
//
// Port: 9472 (configurable via SECURITY_PORT)
// Dependencies: Postgres, NATS
// ---------------------------------------------------------------------------

import Fastify from 'fastify';
import pg from 'pg';
import { connect } from 'nats';
import { createLogger } from '@sven/shared';

// Library functions
import {
  scanSource, scanFiles, listRules, getRule, filterRules,
  BUILTIN_RULES, type SastFinding, type Severity, type VulnerabilityCategory,
} from '@sven/security-toolkit/sast';
import {
  auditDependencies, parseDependencies, matchVulnerabilities,
  classifyLicense, checkTyposquat,
  type PackageDep, type KnownVulnerability,
} from '@sven/security-toolkit/dependency-audit';
import {
  scanForSecrets, scanFileForSecrets, shouldScanFile,
  type SecretFinding,
} from '@sven/security-toolkit/secret-scanner';
import {
  auditDockerCompose, auditTlsCerts, auditEnvFile, generateInfraReport,
  type DockerComposeService, type TlsCertInfo,
} from '@sven/security-toolkit/infra-scanner';
import {
  listScenarios, getScenario, getScenariosByCategory,
  createPentestResult, generatePentestReport,
  BUILTIN_SCENARIOS, type StepResult,
} from '@sven/security-toolkit/pentest';
import {
  generateSecurityPosture, generateSecurityDigest, postureToMarkdown,
} from '@sven/security-toolkit/report';

// Postgres stores
import { PgScanStore } from './store/pg-scan-store.js';
import { PgFindingStore } from './store/pg-finding-store.js';
import { PgPostureStore } from './store/pg-posture-store.js';
import { PgPentestStore } from './store/pg-pentest-store.js';

// NATS publisher
import { SecurityPublisher } from './nats/publisher.js';

const logger = createLogger('security-toolkit-service');

/* ─── Configuration ──────────────────────────────────────────────────── */

const PORT = parseInt(process.env.SECURITY_PORT || '9472', 10);
const HOST = process.env.SECURITY_HOST || '0.0.0.0';
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://sven:sven@localhost:5432/sven';
const NATS_URL = process.env.NATS_URL || 'nats://localhost:4222';
const DEFAULT_ORG_ID = process.env.SECURITY_DEFAULT_ORG_ID || 'default';

/* ─── Bootstrap ──────────────────────────────────────────────────────── */

async function main(): Promise<void> {
  // ── Postgres ──
  const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    max: 15,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  pool.on('error', (err) => {
    logger.error('Postgres pool error', { error: err.message });
  });

  const client = await pool.connect();
  client.release();
  logger.info('Postgres connected');

  // ── NATS ──
  const nc = await connect({ servers: NATS_URL });
  logger.info('NATS connected', { server: NATS_URL });

  // ── Initialize stores ──
  const scanStore = new PgScanStore(pool);
  const findingStore = new PgFindingStore(pool);
  const postureStore = new PgPostureStore(pool);
  const pentestStore = new PgPentestStore(pool);
  const publisher = new SecurityPublisher(nc);

  // ── Fastify ──
  const app = Fastify({ logger: false });

  // ── Health Endpoints ──────────────────────────────────────────────────

  app.get('/healthz', async () => ({ status: 'ok', service: 'security-toolkit', uptime: process.uptime() }));

  app.get('/readyz', async (_req, reply) => {
    try {
      const pgCheck = await pool.query('SELECT 1');
      const natsOk = nc.isClosed() ? 'fail' : 'ok';
      const status = pgCheck.rows.length > 0 && natsOk === 'ok' ? 'ok' : 'degraded';
      return { status, checks: { postgres: pgCheck.rows.length > 0 ? 'ok' : 'fail', nats: natsOk } };
    } catch {
      return reply.status(503).send({ status: 'down', checks: { postgres: 'fail', nats: 'unknown' } });
    }
  });

  // ── SAST Routes ───────────────────────────────────────────────────────

  app.post('/v1/sast/scan', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const source = body.source as string;
    const filePath = (body.file_path as string) || 'unknown.ts';
    const orgId = (body.org_id as string) || DEFAULT_ORG_ID;

    if (!source || typeof source !== 'string') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'source string required' } });
    }

    const scanId = await scanStore.createScan({ orgId, scanType: 'sast', target: filePath });

    const findings = scanSource(source, filePath, BUILTIN_RULES);
    const severitySummary: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, informational: 0 };
    for (const f of findings) severitySummary[f.severity] = (severitySummary[f.severity] || 0) + 1;

    // Persist findings
    await findingStore.bulkInsert(scanId, orgId, findings.map((f) => ({
      ruleId: f.ruleId,
      category: f.category,
      severity: f.severity,
      title: f.title,
      description: f.context,
      filePath: f.file,
      lineNumber: f.line,
      matchedText: f.matchedText,
      remediation: f.remediation,
      cweId: f.cweId,
      owaspRef: f.owaspCategory,
    })));

    await scanStore.completeScan(scanId, findings.length, severitySummary);

    // Publish events
    publisher.publishSastComplete(scanId, orgId, findings.length, severitySummary);
    for (const f of findings) {
      if (f.severity === 'critical') {
        publisher.publishCriticalFinding(scanId, orgId, f.ruleId, f.title, f.file, f.severity);
      }
    }

    return { success: true, data: { scan_id: scanId, findings, total: findings.length, severitySummary } };
  });

  app.post('/v1/sast/scan-files', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const files = body.files as Record<string, string>;
    const orgId = (body.org_id as string) || DEFAULT_ORG_ID;

    if (!files || typeof files !== 'object') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'files object required (path → source)' } });
    }

    const fileMap = new Map(Object.entries(files));
    const scanId = await scanStore.createScan({ orgId, scanType: 'sast', target: `${fileMap.size} files` });
    const report = scanFiles(fileMap, BUILTIN_RULES);

    await findingStore.bulkInsert(scanId, orgId, report.findings.map((f) => ({
      ruleId: f.ruleId,
      category: f.category,
      severity: f.severity,
      title: f.title,
      description: f.context,
      filePath: f.file,
      lineNumber: f.line,
      matchedText: f.matchedText,
      remediation: f.remediation,
      cweId: f.cweId,
      owaspRef: f.owaspCategory,
    })));

    await scanStore.completeScan(scanId, report.totalFindings, report.bySeverity as Record<string, number>);
    publisher.publishSastComplete(scanId, orgId, report.totalFindings, report.bySeverity as Record<string, number>);

    return { success: true, data: { scan_id: scanId, report } };
  });

  app.get('/v1/sast/rules', async () => {
    return { success: true, data: listRules() };
  });

  app.get<{ Params: { ruleId: string } }>('/v1/sast/rules/:ruleId', async (request, reply) => {
    const rule = getRule(request.params.ruleId);
    if (!rule) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Rule not found' } });
    return { success: true, data: rule };
  });

  // ── Dependency Audit Routes ───────────────────────────────────────────

  app.post('/v1/dependencies/audit', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const orgId = (body.org_id as string) || DEFAULT_ORG_ID;

    // Accept either pre-parsed deps or raw package.json format
    let deps: PackageDep[];
    if (Array.isArray(body.dependencies)) {
      deps = (body.dependencies as Record<string, unknown>[]).map((d) => ({
        name: d.name as string,
        version: d.version as string,
        isDev: (d.is_dev as boolean) || false,
        integrity: d.integrity as string | undefined,
      }));
    } else if (body.package_json && typeof body.package_json === 'object') {
      const pkg = body.package_json as Record<string, Record<string, string>>;
      deps = parseDependencies(pkg.dependencies, pkg.devDependencies);
    } else {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'dependencies array or package_json object required' } });
    }

    const knownVulns = (body.known_vulnerabilities as KnownVulnerability[]) || [];
    const licenses = new Map<string, string>(
      Object.entries((body.licenses as Record<string, string>) || {}),
    );

    const scanId = await scanStore.createScan({ orgId, scanType: 'dependency-audit', target: `${deps.length} packages` });
    const report = auditDependencies(deps, knownVulns, licenses);

    await findingStore.bulkInsert(scanId, orgId, report.findings.map((f) => ({
      ruleId: `DEP-${f.package}`,
      category: 'dependency',
      severity: f.riskLevel === 'none' ? 'informational' : f.riskLevel,
      title: `${f.package}@${f.version}: ${f.issues.join('; ')}`,
      description: f.issues.join('; '),
      remediation: f.remediation || '',
    })));

    await scanStore.completeScan(scanId, report.findings.length, report.byRisk as Record<string, number>);
    publisher.publishDepAuditComplete(scanId, orgId, report.findings.length, report.byRisk as Record<string, number>);

    return { success: true, data: { scan_id: scanId, report } };
  });

  app.post('/v1/dependencies/typosquat', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const packageName = body.package_name as string;
    if (!packageName) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'package_name string required' } });
    }
    return { success: true, data: checkTyposquat(packageName) };
  });

  app.post('/v1/dependencies/license', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const license = body.license as string;
    if (!license) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'license string required' } });
    }
    return { success: true, data: classifyLicense(license) };
  });

  // ── Secret Scanner Routes ─────────────────────────────────────────────

  app.post('/v1/secrets/scan', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const orgId = (body.org_id as string) || DEFAULT_ORG_ID;
    const content = body.content as string;
    const filePath = (body.file_path as string) || 'unknown';

    if (!content || typeof content !== 'string') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'content string required' } });
    }

    const scanId = await scanStore.createScan({ orgId, scanType: 'secret-scan', target: filePath });
    const files = new Map<string, string>([[filePath, content]]);
    const report = scanForSecrets(files);

    await findingStore.bulkInsert(scanId, orgId, report.findings.map((f) => ({
      ruleId: f.patternId,
      category: f.type,
      severity: f.severity,
      title: f.title,
      description: `Secret detected: ${f.redacted}`,
      filePath: f.file,
      lineNumber: f.line,
      matchedText: f.redacted, // redacted, never raw
    })));

    await scanStore.completeScan(scanId, report.secretsFound, report.bySeverity as Record<string, number>);
    publisher.publishSecretScanComplete(scanId, orgId, report.secretsFound, report.clean);

    // Alert on each secret found
    for (const f of report.findings) {
      publisher.publishSecretFound(scanId, orgId, f.type, f.severity, f.file, f.redacted);
      if (f.severity === 'critical') {
        publisher.publishCriticalFinding(scanId, orgId, f.patternId, f.title, f.file, f.severity);
      }
    }

    return { success: true, data: { scan_id: scanId, report } };
  });

  app.post('/v1/secrets/scan-files', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const orgId = (body.org_id as string) || DEFAULT_ORG_ID;
    const files = body.files as Record<string, string>;

    if (!files || typeof files !== 'object') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'files object required (path → content)' } });
    }

    const fileMap = new Map(Object.entries(files));
    const scanId = await scanStore.createScan({ orgId, scanType: 'secret-scan', target: `${fileMap.size} files` });
    const report = scanForSecrets(fileMap);

    await findingStore.bulkInsert(scanId, orgId, report.findings.map((f) => ({
      ruleId: f.patternId,
      category: f.type,
      severity: f.severity,
      title: f.title,
      description: `Secret detected: ${f.redacted}`,
      filePath: f.file,
      lineNumber: f.line,
      matchedText: f.redacted,
    })));

    await scanStore.completeScan(scanId, report.secretsFound, report.bySeverity as Record<string, number>);
    publisher.publishSecretScanComplete(scanId, orgId, report.secretsFound, report.clean);

    return { success: true, data: { scan_id: scanId, report } };
  });

  // ── Infrastructure Audit Routes ───────────────────────────────────────

  app.post('/v1/infra/docker', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const orgId = (body.org_id as string) || DEFAULT_ORG_ID;
    const services = body.services as DockerComposeService[];

    if (!Array.isArray(services) || services.length === 0) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'services array required' } });
    }

    const scanId = await scanStore.createScan({ orgId, scanType: 'infra-audit', target: `docker: ${services.length} services` });
    const findings = auditDockerCompose(services);
    const report = generateInfraReport(findings);

    await findingStore.bulkInsert(scanId, orgId, findings.map((f) => ({
      ruleId: f.id,
      category: f.category,
      severity: f.severity,
      title: f.title,
      description: f.description,
      filePath: f.location,
      remediation: f.remediation,
    })));

    await scanStore.completeScan(scanId, findings.length, report.bySeverity as Record<string, number>);
    publisher.publishInfraAuditComplete(scanId, orgId, findings.length, report.securityScore);

    return { success: true, data: { scan_id: scanId, report } };
  });

  app.post('/v1/infra/tls', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const orgId = (body.org_id as string) || DEFAULT_ORG_ID;
    const certs = body.certs as TlsCertInfo[];

    if (!Array.isArray(certs) || certs.length === 0) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'certs array required' } });
    }

    const scanId = await scanStore.createScan({ orgId, scanType: 'infra-audit', target: `tls: ${certs.length} certs` });
    const findings = auditTlsCerts(certs);
    const report = generateInfraReport(findings);

    await findingStore.bulkInsert(scanId, orgId, findings.map((f) => ({
      ruleId: f.id,
      category: f.category,
      severity: f.severity,
      title: f.title,
      description: f.description,
      filePath: f.location,
      remediation: f.remediation,
    })));

    await scanStore.completeScan(scanId, findings.length, report.bySeverity as Record<string, number>);
    publisher.publishInfraAuditComplete(scanId, orgId, findings.length, report.securityScore);

    return { success: true, data: { scan_id: scanId, report } };
  });

  app.post('/v1/infra/env', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const orgId = (body.org_id as string) || DEFAULT_ORG_ID;
    const content = body.content as string;
    const filePath = (body.file_path as string) || '.env';

    if (!content || typeof content !== 'string') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'content string required' } });
    }

    const scanId = await scanStore.createScan({ orgId, scanType: 'infra-audit', target: filePath });
    const findings = auditEnvFile(content, filePath);
    const report = generateInfraReport(findings);

    await findingStore.bulkInsert(scanId, orgId, findings.map((f) => ({
      ruleId: f.id,
      category: f.category,
      severity: f.severity,
      title: f.title,
      description: f.description,
      filePath: f.location,
      remediation: f.remediation,
    })));

    await scanStore.completeScan(scanId, findings.length, report.bySeverity as Record<string, number>);
    publisher.publishInfraAuditComplete(scanId, orgId, findings.length, report.securityScore);

    return { success: true, data: { scan_id: scanId, report } };
  });

  // ── Pentest Routes ────────────────────────────────────────────────────

  app.get('/v1/pentest/scenarios', async () => {
    return { success: true, data: listScenarios() };
  });

  app.get<{ Params: { id: string } }>('/v1/pentest/scenarios/:id', async (request, reply) => {
    const scenario = getScenario(request.params.id);
    if (!scenario) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Scenario not found' } });
    return { success: true, data: scenario };
  });

  app.post('/v1/pentest/runs', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const orgId = (body.org_id as string) || DEFAULT_ORG_ID;
    const scenarioId = body.scenario_id as string;
    const executedBy = (body.executed_by as string) || 'system';

    if (!scenarioId) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'scenario_id required' } });
    }

    const scenario = getScenario(scenarioId);
    if (!scenario) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Scenario not found' } });
    }

    const runId = await pentestStore.createRun({
      orgId,
      executedBy,
      scenarioId: scenario.id,
      scenarioName: scenario.name,
    });

    return { success: true, data: { run_id: runId, scenario: scenario.name } };
  });

  app.post<{ Params: { runId: string } }>('/v1/pentest/runs/:runId/complete', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const orgId = (body.org_id as string) || DEFAULT_ORG_ID;
    const stepResults = (body.step_results as StepResult[]) || [];
    const durationMs = (body.duration_ms as number) || 0;

    const run = await pentestStore.getRun(request.params.runId);
    if (!run) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Run not found' } });

    const result = createPentestResult(run.scenarioId, run.executedBy, stepResults, durationMs);

    await pentestStore.completeRun(request.params.runId, {
      status: result.status as 'passed' | 'failed' | 'error',
      durationMs,
      stepResults: result.stepResults as unknown[],
      vulnerabilities: result.vulnerabilitiesFound as unknown[],
      summary: result.summary,
    });

    publisher.publishPentestComplete(
      request.params.runId, orgId, run.scenarioId,
      result.status, result.vulnerabilitiesFound.length,
    );

    return { success: true, data: result };
  });

  app.get('/v1/pentest/runs', async (request) => {
    const query = request.query as Record<string, string>;
    const orgId = query.org_id || DEFAULT_ORG_ID;
    const runs = await pentestStore.listRuns(orgId);
    return { success: true, data: runs };
  });

  app.get<{ Params: { runId: string } }>('/v1/pentest/runs/:runId', async (request, reply) => {
    const run = await pentestStore.getRun(request.params.runId);
    if (!run) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Run not found' } });
    return { success: true, data: run };
  });

  // ── Security Posture Routes ───────────────────────────────────────────

  app.post('/v1/posture/generate', async (request) => {
    const body = request.body as Record<string, unknown>;
    const orgId = (body.org_id as string) || DEFAULT_ORG_ID;

    const posture = generateSecurityPosture({
      sast: body.sast as Parameters<typeof generateSecurityPosture>[0]['sast'],
      dependencies: body.dependencies as Parameters<typeof generateSecurityPosture>[0]['dependencies'],
      secrets: body.secrets as Parameters<typeof generateSecurityPosture>[0]['secrets'],
      infrastructure: body.infrastructure as Parameters<typeof generateSecurityPosture>[0]['infrastructure'],
      pentest: body.pentest as Parameters<typeof generateSecurityPosture>[0]['pentest'],
    });

    const scanIds = (body.scan_ids as string[]) || [];
    const postureId = await postureStore.record(orgId, posture, scanIds);
    const markdown = postureToMarkdown(posture);

    publisher.publishPostureGenerated(postureId, orgId, posture.grade, posture.overallScore);

    return { success: true, data: { posture_id: postureId, posture, markdown } };
  });

  app.get('/v1/posture/latest', async (request) => {
    const query = request.query as Record<string, string>;
    const orgId = query.org_id || DEFAULT_ORG_ID;
    const posture = await postureStore.getLatest(orgId);
    if (!posture) return { success: true, data: null };
    return { success: true, data: posture };
  });

  app.get('/v1/posture/history', async (request) => {
    const query = request.query as Record<string, string>;
    const orgId = query.org_id || DEFAULT_ORG_ID;
    const limit = Math.min(parseInt(query.limit || '30', 10), 100);
    const history = await postureStore.getHistory(orgId, limit);
    return { success: true, data: history };
  });

  app.get('/v1/posture/trend', async (request) => {
    const query = request.query as Record<string, string>;
    const orgId = query.org_id || DEFAULT_ORG_ID;
    const trend = await postureStore.getTrend(orgId);
    return { success: true, data: trend };
  });

  // ── Scan History & Findings Routes ────────────────────────────────────

  app.get('/v1/scans', async (request) => {
    const query = request.query as Record<string, string>;
    const orgId = query.org_id || DEFAULT_ORG_ID;
    const limit = Math.min(parseInt(query.limit || '50', 10), 500);
    const offset = parseInt(query.offset || '0', 10);
    const scans = await scanStore.listScans(orgId, limit, offset);
    return { success: true, data: scans };
  });

  app.get<{ Params: { scanId: string } }>('/v1/scans/:scanId', async (request, reply) => {
    const scan = await scanStore.getScan(request.params.scanId);
    if (!scan) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Scan not found' } });
    return { success: true, data: scan };
  });

  app.get<{ Params: { scanId: string } }>('/v1/scans/:scanId/findings', async (request) => {
    const findings = await findingStore.listByScan(request.params.scanId);
    return { success: true, data: findings };
  });

  app.get('/v1/findings', async (request) => {
    const query = request.query as Record<string, string>;
    const orgId = query.org_id || DEFAULT_ORG_ID;
    const severity = query.severity;
    const limit = Math.min(parseInt(query.limit || '100', 10), 500);
    const offset = parseInt(query.offset || '0', 10);
    const findings = await findingStore.listByOrg(orgId, severity, limit, offset);
    return { success: true, data: findings };
  });

  app.get('/v1/findings/severity-counts', async (request) => {
    const query = request.query as Record<string, string>;
    const orgId = query.org_id || DEFAULT_ORG_ID;
    const counts = await findingStore.getSeverityCounts(orgId);
    return { success: true, data: counts };
  });

  app.get('/v1/findings/category-counts', async (request) => {
    const query = request.query as Record<string, string>;
    const orgId = query.org_id || DEFAULT_ORG_ID;
    const counts = await findingStore.getCategoryCounts(orgId);
    return { success: true, data: counts };
  });

  app.post<{ Params: { findingId: string } }>('/v1/findings/:findingId/suppress', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const suppressedBy = (body.suppressed_by as string) || 'system';
    const ok = await findingStore.suppress(request.params.findingId, suppressedBy);
    if (!ok) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Finding not found' } });
    return { success: true };
  });

  app.post<{ Params: { findingId: string } }>('/v1/findings/:findingId/unsuppress', async (request, reply) => {
    const ok = await findingStore.unsuppress(request.params.findingId);
    if (!ok) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Finding not found' } });
    return { success: true };
  });

  app.get('/v1/stats', async (request) => {
    const query = request.query as Record<string, string>;
    const orgId = query.org_id || DEFAULT_ORG_ID;
    const stats = await scanStore.getStats(orgId);
    return { success: true, data: stats };
  });

  // ── Start Server ──────────────────────────────────────────────────────

  await app.listen({ host: HOST, port: PORT });
  logger.info(`Security toolkit service listening on ${HOST}:${PORT}`);

  // ── Graceful Shutdown ─────────────────────────────────────────────────

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`Received ${signal}, shutting down`);
    await app.close();
    await nc.drain();
    await pool.end();
    logger.info('Security toolkit service stopped');
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

/* ─── Run ────────────────────────────────────────────────────────────── */

main().catch((err) => {
  logger.error('Fatal startup error', { error: (err as Error).message, stack: (err as Error).stack });
  process.exit(1);
});

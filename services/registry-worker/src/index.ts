import fs from 'node:fs/promises';
import { Dirent } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import pg from 'pg';
import yaml from 'js-yaml';
import { createLogger } from '@sven/shared';

const logger = createLogger('registry-worker');
const DEFAULT_SCAN_INTERVAL_MS = 5 * 60 * 1000;
const MIN_SCAN_INTERVAL_MS = 1_000;
const MAX_SCAN_INTERVAL_MS = 24 * 60 * 60 * 1_000;

interface RegistrySourceRow {
  id: string;
  path: string | null;
  enabled: boolean;
  organization_id?: string | null;
}

interface SkillFrontmatter {
  name?: string;
  description?: string;
  version?: string;
  publisher?: string;
  inputs_schema?: Record<string, unknown>;
  outputs_schema?: Record<string, unknown>;
  permissions_required?: string[];
  allowlists?: Record<string, unknown>;
  limits?: Record<string, unknown>;
  entrypoint?: string;
  [key: string]: unknown;
}

interface OciIndexEntry {
  image?: string;
  digest?: string;
  name?: string;
  description?: string;
  version?: string;
  publisher?: string;
  labels?: Record<string, string>;
  manifest?: Record<string, unknown>;
}

function parseScanIntervalMs(raw: string | undefined, fallback: number): number {
  if (!raw || raw.trim().length === 0) {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    throw new Error(
      `Invalid REGISTRY_SCAN_INTERVAL_MS: expected a finite integer milliseconds value, got "${raw}"`,
    );
  }

  if (parsed < MIN_SCAN_INTERVAL_MS || parsed > MAX_SCAN_INTERVAL_MS) {
    throw new Error(
      `Invalid REGISTRY_SCAN_INTERVAL_MS: expected value between ${MIN_SCAN_INTERVAL_MS} and ${MAX_SCAN_INTERVAL_MS} ms, got "${raw}"`,
    );
  }

  return parsed;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function parseFrontmatter(content: string): SkillFrontmatter | null {
  const trimmed = content.trimStart();
  if (!trimmed.startsWith('---')) {
    return null;
  }

  const lines = trimmed.split('\n');
  let endIndex = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '---') {
      endIndex = i;
      break;
    }
  }

  if (endIndex === -1) {
    return null;
  }

  const yamlBlock = lines.slice(1, endIndex).join('\n');
  const data = yaml.load(yamlBlock);
  if (data && typeof data === 'object') {
    return data as SkillFrontmatter;
  }
  return null;
}

async function resolvePublisherId(pool: pg.Pool, name: string): Promise<string | null> {
  const res = await pool.query(
    `SELECT id
     FROM registry_publishers
     WHERE name = $1
     ORDER BY organization_id NULLS LAST
     LIMIT 1`,
    [name],
  );
  if (res.rows.length === 0) {
    logger.warn('Publisher not found for skill', { publisher: name });
    return null;
  }
  return res.rows[0].id;
}

async function resolveToolMeta(pool: pg.Pool, name: string): Promise<{ id: string; is_first_party: boolean } | null> {
  const res = await pool.query(
    `SELECT id, is_first_party FROM tools WHERE name = $1 LIMIT 1`,
    [name],
  );
  if (res.rows.length === 0) return null;
  return { id: res.rows[0].id, is_first_party: Boolean(res.rows[0].is_first_party) };
}

async function upsertCatalogEntry(
  pool: pg.Pool,
  sourceId: string,
  publisherId: string | null,
  name: string,
  description: string,
  version: string,
  format: 'openclaw' | 'oci' | 'nix',
  manifest: Record<string, unknown>,
  organizationId?: string | null,
): Promise<string> {
  const existing = await pool.query(
    `SELECT id FROM skills_catalog WHERE source_id = $1 AND name = $2 AND version = $3 AND format = $4`,
    [sourceId, name, version, format],
  );

  if (existing.rows.length > 0) {
    await pool.query(
      `UPDATE skills_catalog
       SET description = $1, publisher_id = $2, manifest = $3, organization_id = COALESCE($4, organization_id)
       WHERE id = $5`,
      [description, publisherId, JSON.stringify(manifest), organizationId ?? null, existing.rows[0].id],
    );
    return existing.rows[0].id;
  }

  const id = crypto.randomUUID();
  await pool.query(
    `INSERT INTO skills_catalog (id, organization_id, source_id, publisher_id, name, description, version, format, manifest, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
    [
      id,
      organizationId ?? null,
      sourceId,
      publisherId,
      name,
      description,
      version,
      format,
      JSON.stringify(manifest),
    ],
  );

  return id;
}

function normalizeImageRef(image: string, digest?: string): { imageRef?: string; digest?: string } {
  if (!image) return {};
  if (image.includes('@sha256:')) {
    const [base, dig] = image.split('@');
    return { imageRef: `${base}@${dig}`, digest: dig.replace('sha256:', '') };
  }
  if (digest && digest.startsWith('sha256:')) {
    return { imageRef: `${image}@${digest}`, digest: digest.replace('sha256:', '') };
  }
  return {};
}

function parseLabelJson(value?: string): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function getLabelValue(labels: Record<string, string>, key: string): string | undefined {
  return labels[key] || labels[`org.sven.${key}`] || labels[`sven.${key}`];
}

function mergeManifestLabel(
  labels: Record<string, string>,
  key: string,
  fallback: Record<string, unknown> | unknown[],
): Record<string, unknown> | unknown[] {
  const raw = getLabelValue(labels, key);
  const parsed = parseLabelJson(raw);
  return parsed ?? fallback;
}

async function verifyCosign(imageRef: string): Promise<{ signature?: string; error?: string }> {
  const cosignBin = process.env.COSIGN_BIN || 'cosign';
  const publicKey = process.env.COSIGN_PUBLIC_KEY;
  if (!publicKey) {
    return { error: 'cosign public key not configured' };
  }

  const { spawnSync } = await import('node:child_process');
  const result = spawnSync(cosignBin, ['verify', '--key', publicKey, '--output', 'json', imageRef], {
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    return { error: result.stderr || 'cosign verification failed' };
  }

  return { signature: result.stdout.trim() };
}

async function scanSource(pool: pg.Pool, source: RegistrySourceRow): Promise<void> {
  if (!source.path) {
    return;
  }

  let entries: Dirent[] = [];
  try {
    entries = await fs.readdir(source.path, { withFileTypes: true });
  } catch (err) {
    logger.error('Failed to read registry source path', { path: source.path, err: String(err) });
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillDir = path.join(source.path, entry.name);
    const skillFile = path.join(skillDir, 'SKILL.md');
    const fallbackFile = path.join(skillDir, 'skill.md');

    let content: string | null = null;
    try {
      content = await fs.readFile(skillFile, 'utf8');
    } catch {
      try {
        content = await fs.readFile(fallbackFile, 'utf8');
      } catch {
        continue;
      }
    }

    const frontmatter = parseFrontmatter(content || '');
    if (!frontmatter) {
      logger.warn('Missing or invalid SKILL.md frontmatter', { skill_dir: skillDir });
      continue;
    }

    const name = String(frontmatter.name || entry.name).trim();
    const description = String(frontmatter.description || '').trim();
    const version = String(frontmatter.version || '0.0.0').trim();
    const publisherName = typeof frontmatter.publisher === 'string' ? frontmatter.publisher.trim() : '';
    const publisherId = publisherName ? await resolvePublisherId(pool, publisherName) : null;
    const toolMeta = await resolveToolMeta(pool, name);

    const manifest: Record<string, unknown> = {
      ...frontmatter,
      source_path: skillDir,
      format: 'openclaw',
      inputs_schema: frontmatter.inputs_schema || {},
      outputs_schema: frontmatter.outputs_schema || {},
      permissions_required: frontmatter.permissions_required || [],
      allowlists: frontmatter.allowlists || {},
      limits: frontmatter.limits || {},
    };
    if (toolMeta) {
      manifest.tool_id = toolMeta.id;
      if (manifest.first_party === undefined) {
        manifest.first_party = toolMeta.is_first_party;
      }
    }

    await upsertCatalogEntry(
      pool,
      source.id,
      publisherId,
      name,
      description,
      version,
      'openclaw',
      manifest,
      source.organization_id,
    );
  }
}

async function loadOciIndex(sourcePath: string): Promise<OciIndexEntry[]> {
  const jsonPath = path.join(sourcePath, 'oci-index.json');
  const yamlPath = path.join(sourcePath, 'oci-index.yaml');
  const ymlPath = path.join(sourcePath, 'oci-index.yml');

  let content: string | null = null;
  try {
    content = await fs.readFile(jsonPath, 'utf8');
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) return parsed as OciIndexEntry[];
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.images)) {
      return parsed.images as OciIndexEntry[];
    }
  } catch {
    content = null;
  }

  try {
    content = await fs.readFile(yamlPath, 'utf8');
  } catch {
    try {
      content = await fs.readFile(ymlPath, 'utf8');
    } catch {
      content = null;
    }
  }

  if (!content) return [];
  const parsed = yaml.load(content);
  if (Array.isArray(parsed)) return parsed as OciIndexEntry[];
  if (parsed && typeof parsed === 'object' && Array.isArray((parsed as any).images)) {
    return (parsed as any).images as OciIndexEntry[];
  }
  return [];
}

async function scanOciIndex(pool: pg.Pool, source: RegistrySourceRow): Promise<void> {
  if (!source.path) return;
  const entries = await loadOciIndex(source.path);
  if (entries.length === 0) return;

  for (const entry of entries) {
    const image = entry.image || '';
    const digestInput = entry.digest || '';
    const normalized = normalizeImageRef(image, digestInput);
    if (!normalized.imageRef || !normalized.digest) {
      logger.warn('Skipping OCI entry without pinned digest', { image });
      continue;
    }

    const labels = entry.labels || {};
    const name = String(entry.name || getLabelValue(labels, 'name') || image).trim();
    const description = String(entry.description || getLabelValue(labels, 'description') || '').trim();
    const version = String(entry.version || getLabelValue(labels, 'version') || '0.0.0').trim();
    const publisherName = String(entry.publisher || getLabelValue(labels, 'publisher') || '').trim();
    const publisherId = publisherName ? await resolvePublisherId(pool, publisherName) : null;

    const cosignResult = await verifyCosign(normalized.imageRef);
    const manifest = {
      ...(entry.manifest || {}),
      image: normalized.imageRef,
      digest: `sha256:${normalized.digest}`,
      labels,
      format: 'oci',
      inputs_schema: mergeManifestLabel(labels, 'inputs_schema', {}),
      outputs_schema: mergeManifestLabel(labels, 'outputs_schema', {}),
      permissions_required: mergeManifestLabel(labels, 'permissions_required', []),
      allowlists: mergeManifestLabel(labels, 'allowlists', {}),
      limits: mergeManifestLabel(labels, 'limits', {}),
      cosign: cosignResult.signature
        ? { verified: true, signature: cosignResult.signature, public_key: process.env.COSIGN_PUBLIC_KEY || '' }
        : { verified: false, error: cosignResult.error || 'not verified' },
    };

    await upsertCatalogEntry(
      pool,
      source.id,
      publisherId,
      name,
      description,
      version,
      'oci',
      manifest,
      source.organization_id,
    );
  }
}

async function getFallbackOrgId(pool: pg.Pool): Promise<string | null> {
  const res = await pool.query(`SELECT id FROM organizations ORDER BY created_at ASC LIMIT 1`);
  if (res.rows.length === 0) return null;
  return String(res.rows[0].id);
}

async function ensureSourceOrganization(pool: pg.Pool, source: RegistrySourceRow): Promise<string | null> {
  if (source.organization_id) return source.organization_id;
  const orgId = await getFallbackOrgId(pool);
  if (!orgId) return null;
  await pool.query(
    `UPDATE registry_sources SET organization_id = $1 WHERE id = $2 AND organization_id IS NULL`,
    [orgId, source.id],
  );
  return orgId;
}

function computeRiskFromVuln(summary: Record<string, number>): 'low' | 'medium' | 'high' | 'critical' | 'unknown' {
  if ((summary.critical || 0) > 0) return 'critical';
  if ((summary.high || 0) > 0) return 'high';
  if ((summary.medium || 0) > 0) return 'medium';
  if ((summary.low || 0) > 0) return 'low';
  return 'unknown';
}

function runToolJson(bin: string, args: string[]): { ok: boolean; output?: any; error?: string; status?: number } {
  const result = spawnSync(bin, args, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  if (result.error) {
    const err = String(result.error.message || result.error);
    if (err.toLowerCase().includes('enoent')) {
      return { ok: false, error: 'not_configured', status: result.status ?? -1 };
    }
    return { ok: false, error: err, status: result.status ?? -1 };
  }
  if (result.status !== 0) {
    return { ok: false, error: String(result.stderr || 'command failed'), status: result.status ?? -1 };
  }
  try {
    const parsed = JSON.parse(String(result.stdout || '').trim());
    return { ok: true, output: parsed };
  } catch {
    return { ok: false, error: 'invalid_json', status: result.status ?? -1 };
  }
}

async function runStaticChecks(skillDir: string): Promise<{ status: string; checks: any[] }> {
  const checks: any[] = [];
  let status = 'passed';
  const skillFile = path.join(skillDir, 'SKILL.md');
  let handlerFile = 'handler.ts';
  try {
    const content = await fs.readFile(skillFile, 'utf8');
    const frontmatter = parseFrontmatter(content || '');
    if (!frontmatter) {
      status = 'failed';
      checks.push({ id: 'frontmatter', status: 'failed', message: 'Missing SKILL.md frontmatter' });
    } else {
      const required = ['name', 'description', 'version', 'handler_language', 'handler_file', 'inputs_schema', 'outputs_schema'];
      for (const key of required) {
        if (!String((frontmatter as any)[key] || '').trim()) {
          status = 'failed';
          checks.push({ id: `frontmatter.${key}`, status: 'failed', message: `Missing ${key}` });
        }
      }
      if (String((frontmatter as any).handler_file || '').trim()) {
        handlerFile = String((frontmatter as any).handler_file).trim();
      }
    }
  } catch (err) {
    status = 'failed';
    checks.push({ id: 'read', status: 'failed', message: `Failed to read SKILL.md: ${String(err)}` });
  }

  if (handlerFile) {
    try {
      const handlerPath = path.join(skillDir, handlerFile);
      await fs.access(handlerPath);
    } catch (err) {
      status = 'failed';
      checks.push({ id: 'handler', status: 'failed', message: `Missing ${handlerFile}: ${String(err)}` });
    }
  }

  return { status, checks };
}

async function scanQuarantinedSkills(pool: pg.Pool): Promise<void> {
  const rows = await pool.query(
    `SELECT qr.id AS report_id,
            qr.skill_id,
            qr.static_checks,
            qr.sbom,
            qr.vuln_scan,
            qr.overall_risk,
            sc.manifest,
            sc.name
     FROM skill_quarantine_reports qr
     JOIN skills_installed si ON si.id = qr.skill_id
     JOIN skills_catalog sc ON sc.id = si.catalog_entry_id
     WHERE si.trust_level = 'quarantined'`,
  );

  for (const row of rows.rows) {
    const manifest = (row.manifest || {}) as Record<string, unknown>;
    const skillDir = String(manifest.source_path || manifest.skill_dir || '').trim();
    if (!skillDir) {
      logger.warn('Quarantine scan skipped: missing skill path', { skill_id: row.skill_id, name: row.name });
      continue;
    }

    const staticChecks = await runStaticChecks(skillDir);

    const syftBin = process.env.SYFT_BIN || 'syft';
    const syft = runToolJson(syftBin, [`dir:${skillDir}`, '-o', 'json']);
    const sbom =
      syft.ok
        ? {
            status: 'completed',
            tool: 'syft',
            generated_at: new Date().toISOString(),
            source: { path: skillDir },
            summary: { packages: Array.isArray(syft.output?.artifacts) ? syft.output.artifacts.length : 0 },
          }
        : syft.error === 'not_configured'
          ? { status: 'skipped', tool: 'syft', reason: 'not configured' }
          : { status: 'error', tool: 'syft', error: syft.error };

    const grypeBin = process.env.GRYPE_BIN || 'grype';
    const grype = runToolJson(grypeBin, [`dir:${skillDir}`, '-o', 'json']);
    const vulnSummary: Record<string, number> = {};
    if (grype.ok && Array.isArray(grype.output?.matches)) {
      for (const match of grype.output.matches) {
        const sev = String(match?.vulnerability?.severity || '').toLowerCase();
        if (!sev) continue;
        vulnSummary[sev] = (vulnSummary[sev] || 0) + 1;
      }
    }
    const vuln =
      grype.ok
        ? {
            status: 'completed',
            tool: 'grype',
            generated_at: new Date().toISOString(),
            source: { path: skillDir },
            summary: vulnSummary,
          }
        : grype.error === 'not_configured'
          ? { status: 'skipped', tool: 'grype', reason: 'not configured' }
          : { status: 'error', tool: 'grype', error: grype.error };

    const overallRisk = grype.ok ? computeRiskFromVuln(vulnSummary) : String(row.overall_risk || 'unknown');

    await pool.query(
      `UPDATE skill_quarantine_reports
       SET static_checks = $1,
           sbom = $2,
           vuln_scan = $3,
           overall_risk = $4
       WHERE id = $5`,
      [JSON.stringify(staticChecks), JSON.stringify(sbom), JSON.stringify(vuln), overallRisk, row.report_id],
    );
  }
}

async function runScan(pool: pg.Pool): Promise<void> {
  const sources = await pool.query<RegistrySourceRow>(
    `SELECT id, path, enabled, organization_id FROM registry_sources WHERE type = 'local' AND enabled = TRUE`,
  );

  for (const source of sources.rows) {
    source.organization_id = await ensureSourceOrganization(pool, source);
    await scanSource(pool, source);
    await scanOciIndex(pool, source);
  }

  await scanQuarantinedSkills(pool);
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL || 'postgresql://sven:sven@localhost:5432/sven';
  const scanIntervalMs = parseScanIntervalMs(process.env.REGISTRY_SCAN_INTERVAL_MS, DEFAULT_SCAN_INTERVAL_MS);

  const pool = new pg.Pool({ connectionString, max: 5 });
  logger.info('Registry worker started', {
    scan_interval_ms: scanIntervalMs,
    scheduler_mode: 'periodic_serialized',
  });

  const tick = async () => {
    try {
      await runScan(pool);
    } catch (err) {
      logger.error('Registry scan failed', { err: String(err) });
    }
  };

  for (;;) {
    await tick();
    await sleep(scanIntervalMs);
  }
}

main().catch((err) => {
  logger.fatal('Registry worker failed', { err: String(err) });
  process.exit(1);
});

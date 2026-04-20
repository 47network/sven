// ---------------------------------------------------------------------------
// Auto-Publisher — scans skills/ directory and publishes listings to marketplace.
// Runs on startup + daily interval behind SVEN_AUTO_PUBLISH_ENABLED=1.
// ---------------------------------------------------------------------------

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createLogger } from '@sven/shared';

const logger = createLogger('auto-publisher');

const MARKETPLACE_URL = process.env.MARKETPLACE_URL || 'http://localhost:9478';
const SKILLS_DIR = process.env.SVEN_SKILLS_DIR || path.resolve(process.cwd(), '../../skills');
const PUBLISH_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_ORG_ID = process.env.SVEN_ORG_ID || 'org_sven';

interface SkillMeta {
  name: string;
  description: string;
  version: string;
  handler_language?: string;
  inputs_schema?: unknown;
  outputs_schema?: unknown;
}

function parseSkillMd(filePath: string): SkillMeta | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const match = raw.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return null;
    const frontmatter = match[1];
    const fields: Record<string, string> = {};
    for (const line of frontmatter.split('\n')) {
      const idx = line.indexOf(':');
      if (idx < 0) continue;
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      fields[key] = val;
    }
    if (!fields.name || !fields.description) return null;
    return {
      name: fields.name,
      description: fields.description,
      version: fields.version || '0.0.1',
      handler_language: fields.handler_language,
    };
  } catch {
    return null;
  }
}

export function discoverSkills(skillsDir: string = SKILLS_DIR): SkillMeta[] {
  const skills: SkillMeta[] = [];
  if (!fs.existsSync(skillsDir)) {
    logger.warn('Skills directory not found', { skillsDir });
    return skills;
  }
  const dirs = fs.readdirSync(skillsDir, { withFileTypes: true }).filter(d => d.isDirectory());
  for (const dir of dirs) {
    const skillMdPath = path.join(skillsDir, dir.name, 'SKILL.md');
    if (!fs.existsSync(skillMdPath)) continue;
    const meta = parseSkillMd(skillMdPath);
    if (meta) skills.push(meta);
  }
  logger.info('Discovered skills with SKILL.md', { count: skills.length });
  return skills;
}

function estimatePrice(skill: SkillMeta): string {
  const premium = ['trading', 'security', 'quantum', 'ai-agency', 'compute-mesh'];
  if (premium.some(p => skill.name.includes(p))) return '0.10';
  return '0.01';
}

async function fetchExistingListings(): Promise<Set<string>> {
  try {
    const res = await fetch(`${MARKETPLACE_URL}/v1/market/listings?limit=200`);
    if (!res.ok) return new Set();
    const data = (await res.json()) as { slug?: string }[];
    return new Set(data.map(l => l.slug).filter(Boolean));
  } catch {
    logger.warn('Could not fetch existing listings');
    return new Set();
  }
}

async function createListing(skill: SkillMeta): Promise<boolean> {
  const slug = `skill-${skill.name}`;
  const body = {
    orgId: DEFAULT_ORG_ID,
    title: `${skill.name} API`,
    description: skill.description,
    kind: 'skill_api',
    pricingModel: 'per_call',
    unitPrice: estimatePrice(skill),
    currency: 'USD',
    skillName: skill.name,
    endpointUrl: `/api/skills/${skill.name}/invoke`,
    slug,
    tags: [skill.name, skill.handler_language || 'typescript', 'auto-published'],
    status: 'draft',
  };
  try {
    const res = await fetch(`${MARKETPLACE_URL}/v1/market/listings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      logger.info('Listing created', { slug, name: skill.name });
      return true;
    }
    const err = await res.text();
    logger.warn('Listing creation failed', { slug, status: res.status, err: err.slice(0, 200) });
    return false;
  } catch (err) {
    logger.warn('Listing creation error', { slug, err: (err as Error).message });
    return false;
  }
}

export async function runAutoPublish(): Promise<{ created: number; skipped: number; errors: number }> {
  const skills = discoverSkills();
  const existing = await fetchExistingListings();
  let created = 0, skipped = 0, errors = 0;

  for (const skill of skills) {
    const slug = `skill-${skill.name}`;
    if (existing.has(slug)) {
      skipped++;
      continue;
    }
    const ok = await createListing(skill);
    if (ok) created++;
    else errors++;
  }

  logger.info('Auto-publish complete', { created, skipped, errors, total: skills.length });
  return { created, skipped, errors };
}

let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function startAutoPublisher(): void {
  if (process.env.SVEN_AUTO_PUBLISH_ENABLED !== '1') {
    logger.info('Auto-publisher disabled (set SVEN_AUTO_PUBLISH_ENABLED=1)');
    return;
  }
  logger.info('Auto-publisher starting');
  // Run immediately on startup
  runAutoPublish().catch(err =>
    logger.error('Auto-publish initial run failed', { err: (err as Error).message }),
  );
  // Then every 24 hours
  intervalHandle = setInterval(() => {
    runAutoPublish().catch(err =>
      logger.error('Auto-publish scheduled run failed', { err: (err as Error).message }),
    );
  }, PUBLISH_INTERVAL_MS);
}

export function stopAutoPublisher(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

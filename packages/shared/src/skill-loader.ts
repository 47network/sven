/**
 * Markdown + YAML frontmatter skill definition loader.
 *
 * Skills are defined as .md files with YAML frontmatter for metadata
 * and Markdown body for the prompt/instructions. Multi-source loading
 * with priority: system → organization → workspace → adapter.
 *
 * Prior art: Jekyll frontmatter (2008), Hugo, Gatsby, Obsidian,
 * MDX — the Markdown + YAML format is 15+ years old.
 */

import { createLogger } from './logger.js';
import { readdir, readFile, stat } from 'fs/promises';
import { join, basename, extname } from 'path';

const logger = createLogger('skill-loader');

// ──── Types ──────────────────────────────────────────────────────

export interface SkillDefinition {
  /** Unique skill name (kebab-case, derived from filename) */
  name: string;
  /** Human-readable display name */
  displayName: string;
  /** Short description of what this skill does */
  description: string;
  /** When the LLM should choose this skill */
  whenToUse?: string;
  /** Tools this skill is allowed to invoke */
  allowedTools: string[];
  /** Effort estimate: 'low' | 'medium' | 'high' or a custom range */
  effort?: string;
  /** Minimum effort time in minutes */
  effortMin?: number;
  /** Maximum effort time in minutes */
  effortMax?: number;
  /** Arguments this skill accepts (extracted from {variable} in body) */
  argumentNames: string[];
  /** Optional argument hint for the user */
  argumentHint?: string;
  /** Model override for this skill */
  model?: string;
  /** Loading source priority */
  source: SkillSource;
  /** Source directory path */
  sourcePath: string;
  /** Full Markdown body (prompt template) */
  body: string;
  /** Estimated token count of frontmatter (for budget calculation) */
  frontmatterTokenEstimate: number;
  /** Whether the skill can be invoked by users directly */
  userInvocable: boolean;
  /** Optional version string */
  version?: string;
}

export type SkillSource = 'system' | 'organization' | 'workspace' | 'adapter' | 'plugin';

/** Priority order — lower index = higher priority */
const SOURCE_PRIORITY: SkillSource[] = ['system', 'organization', 'workspace', 'adapter', 'plugin'];

export interface SkillLoadOptions {
  /** System skills directory (built-in) */
  systemDir?: string;
  /** Organization skills directory */
  organizationDir?: string;
  /** Workspace skills directory */
  workspaceDir?: string;
  /** Adapter-specific skills directory */
  adapterDir?: string;
  /** Plugin skills directories */
  pluginDirs?: string[];
}

// ──── Frontmatter Parser ─────────────────────────────────────────

interface ParsedSkillFile {
  frontmatter: Record<string, unknown>;
  body: string;
}

/**
 * Parse YAML frontmatter from a Markdown string.
 * Supports the standard --- delimited format.
 */
function parseFrontmatter(content: string): ParsedSkillFile {
  const trimmed = content.trimStart();
  if (!trimmed.startsWith('---')) {
    return { frontmatter: {}, body: content };
  }

  const endIdx = trimmed.indexOf('\n---', 3);
  if (endIdx === -1) {
    return { frontmatter: {}, body: content };
  }

  const yamlBlock = trimmed.slice(4, endIdx).trim();
  const body = trimmed.slice(endIdx + 4).trim();

  // Simple YAML parser for flat key-value pairs and arrays
  // (avoids adding js-yaml as a dependency to shared)
  const frontmatter: Record<string, unknown> = {};

  const lines = yamlBlock.split('\n');
  let currentKey = '';

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('#')) continue;

    // Array item continuation
    if (trimmedLine.startsWith('- ') && currentKey) {
      const existing = frontmatter[currentKey];
      const value = trimmedLine.slice(2).trim();
      if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        frontmatter[currentKey] = [value];
      }
      continue;
    }

    // Key: value pair
    const colonIdx = trimmedLine.indexOf(':');
    if (colonIdx > 0) {
      const key = trimmedLine.slice(0, colonIdx).trim();
      const value = trimmedLine.slice(colonIdx + 1).trim();
      currentKey = key;

      if (value === '') {
        // Could be a multi-line value or array — leave empty and wait
        frontmatter[key] = [];
      } else if (value.startsWith('[') && value.endsWith(']')) {
        // Inline array: [a, b, c]
        frontmatter[key] = value
          .slice(1, -1)
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean);
      } else if (value === 'true') {
        frontmatter[key] = true;
      } else if (value === 'false') {
        frontmatter[key] = false;
      } else if (/^\d+$/.test(value)) {
        frontmatter[key] = parseInt(value, 10);
      } else {
        // Strip surrounding quotes
        frontmatter[key] = value.replace(/^['"]|['"]$/g, '');
      }
    }
  }

  return { frontmatter, body };
}

// ──── Argument Extraction ────────────────────────────────────────

/**
 * Extract {variable} argument names from skill body text.
 */
function extractArgumentNames(body: string): string[] {
  const matches = body.match(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g);
  if (!matches) return [];
  const names = new Set(matches.map((m) => m.slice(1, -1)));
  return Array.from(names);
}

/**
 * Substitute arguments in the skill body.
 */
export function substituteSkillArguments(
  body: string,
  args: Record<string, string>,
): string {
  let result = body;
  for (const [key, value] of Object.entries(args)) {
    result = result.replaceAll(`{${key}}`, value);
  }
  return result;
}

// ──── Token Estimation ───────────────────────────────────────────

/**
 * Rough token estimation: ~4 characters per token (English text).
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ──── Loader ─────────────────────────────────────────────────────

/**
 * Load a single skill file from disk.
 */
async function loadSkillFile(
  filePath: string,
  source: SkillSource,
): Promise<SkillDefinition | null> {
  try {
    const content = await readFile(filePath, 'utf-8');
    const { frontmatter, body } = parseFrontmatter(content);

    const name =
      typeof frontmatter['name'] === 'string'
        ? frontmatter['name']
        : basename(filePath, extname(filePath));

    const displayName =
      typeof frontmatter['display-name'] === 'string'
        ? frontmatter['display-name']
        : name.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

    const description =
      typeof frontmatter['description'] === 'string'
        ? frontmatter['description']
        : `Skill: ${displayName}`;

    const allowedTools: string[] = Array.isArray(frontmatter['allowed-tools'])
      ? (frontmatter['allowed-tools'] as string[])
      : typeof frontmatter['allowed-tools'] === 'string'
        ? frontmatter['allowed-tools'].split(',').map((s: string) => s.trim())
        : [];

    const frontmatterText = [name, description, frontmatter['when-to-use'] as string]
      .filter(Boolean)
      .join(' ');

    return {
      name,
      displayName,
      description,
      whenToUse: typeof frontmatter['when-to-use'] === 'string' ? frontmatter['when-to-use'] : undefined,
      allowedTools,
      effort: typeof frontmatter['effort'] === 'string' ? frontmatter['effort'] : undefined,
      effortMin: typeof frontmatter['effort-min'] === 'number' ? frontmatter['effort-min'] : undefined,
      effortMax: typeof frontmatter['effort-max'] === 'number' ? frontmatter['effort-max'] : undefined,
      argumentNames: extractArgumentNames(body),
      argumentHint: typeof frontmatter['argument-hint'] === 'string' ? frontmatter['argument-hint'] : undefined,
      model: typeof frontmatter['model'] === 'string' ? frontmatter['model'] : undefined,
      source,
      sourcePath: filePath,
      body,
      frontmatterTokenEstimate: estimateTokens(frontmatterText),
      userInvocable: frontmatter['user-invocable'] !== false,
      version: typeof frontmatter['version'] === 'string' ? frontmatter['version'] : undefined,
    };
  } catch (err: any) {
    logger.warn('Failed to load skill file', { path: filePath, error: err.message });
    return null;
  }
}

/**
 * Load all .md skill files from a directory (non-recursive).
 */
async function loadSkillsFromDir(
  dirPath: string,
  source: SkillSource,
): Promise<SkillDefinition[]> {
  try {
    const dirStat = await stat(dirPath);
    if (!dirStat.isDirectory()) return [];
  } catch {
    return []; // Directory doesn't exist — not an error
  }

  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    const skills: SkillDefinition[] = [];

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!entry.name.endsWith('.md')) continue;
      if (entry.name.startsWith('.') || entry.name.startsWith('_')) continue;

      const skill = await loadSkillFile(join(dirPath, entry.name), source);
      if (skill) skills.push(skill);
    }

    logger.debug('Loaded skills from directory', {
      dir: dirPath,
      source,
      count: skills.length,
    });
    return skills;
  } catch (err: any) {
    logger.warn('Failed to read skills directory', { dir: dirPath, error: err.message });
    return [];
  }
}

/**
 * Load skills from all configured sources with deduplication.
 * Higher-priority sources override lower-priority ones by name.
 *
 * Priority: system > organization > workspace > adapter > plugin
 */
export async function loadAllSkills(
  options: SkillLoadOptions,
): Promise<SkillDefinition[]> {
  const allSkills = new Map<string, SkillDefinition>();

  // Load in REVERSE priority order so higher-priority overwrites lower
  const sources: Array<{ dir?: string; dirs?: string[]; source: SkillSource }> = [
    { dirs: options.pluginDirs, source: 'plugin' },
    { dir: options.adapterDir, source: 'adapter' },
    { dir: options.workspaceDir, source: 'workspace' },
    { dir: options.organizationDir, source: 'organization' },
    { dir: options.systemDir, source: 'system' },
  ];

  for (const { dir, dirs, source } of sources) {
    const dirsToLoad = dirs || (dir ? [dir] : []);
    for (const d of dirsToLoad) {
      const skills = await loadSkillsFromDir(d, source);
      for (const skill of skills) {
        allSkills.set(skill.name, skill);
      }
    }
  }

  const result = Array.from(allSkills.values());
  logger.info('All skills loaded', {
    total: result.length,
    bySource: result.reduce(
      (acc, s) => {
        acc[s.source] = (acc[s.source] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    ),
  });

  return result;
}

/**
 * Find a skill by name from a pre-loaded list.
 */
export function findSkill(
  skills: SkillDefinition[],
  name: string,
): SkillDefinition | undefined {
  return skills.find((s) => s.name === name);
}

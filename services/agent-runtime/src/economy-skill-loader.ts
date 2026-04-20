// ---------------------------------------------------------------------------
// Economy Skill Loader — scans skills/autonomous-economy/ and registers
// them in the tools table so Sven can discover & invoke them via chat.
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import type pg from 'pg';
import { createLogger } from '@sven/shared';

const logger = createLogger('economy-skill-loader');

export interface SkillMeta {
  name: string;
  description: string;
  version: string;
  handler_language: string;
  handler_file: string;
  inputs_schema: Record<string, unknown>;
  outputs_schema: Record<string, unknown>;
}

/**
 * Parse YAML-like frontmatter from SKILL.md.
 * Handles simple key: value pairs and nested JSON-ish blocks.
 */
export function parseSkillFrontmatter(content: string): Partial<SkillMeta> {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return {};

  const raw = fmMatch[1];
  const result: Record<string, unknown> = {};
  let currentKey = '';
  let currentBlock: string[] = [];
  let inBlock = false;

  for (const line of raw.split('\n')) {
    // Detect top-level key: value (no leading spaces)
    const kvMatch = line.match(/^(\w[\w_]*)\s*:\s*(.*)$/);
    if (kvMatch && !line.startsWith(' ') && !line.startsWith('\t')) {
      // Flush previous block
      if (inBlock && currentKey) {
        try {
          // Try parsing the indented YAML-like block as JSON
          const jsonStr = currentBlock.join('\n')
            .replace(/(\w+):/g, '"$1":')
            .replace(/:\s*\[([^\]]*)\]/g, (_, items) => {
              const parts = items.split(',').map((s: string) => `"${s.trim()}"`).join(',');
              return `: [${parts}]`;
            });
          result[currentKey] = JSON.parse(`{${jsonStr}}`);
        } catch {
          result[currentKey] = currentBlock.join('\n');
        }
      }

      currentKey = kvMatch[1];
      const val = kvMatch[2].trim();
      if (val) {
        result[currentKey] = val;
        inBlock = false;
      } else {
        inBlock = true;
        currentBlock = [];
      }
    } else if (inBlock) {
      currentBlock.push(line.replace(/^ {2}/, ''));
    }
  }

  // Flush last block
  if (inBlock && currentKey) {
    try {
      const jsonStr = currentBlock.join('\n')
        .replace(/(\w+):/g, '"$1":')
        .replace(/:\s*\[([^\]]*)\]/g, (_, items) => {
          const parts = items.split(',').map((s: string) => `"${s.trim()}"`).join(',');
          return `: [${parts}]`;
        });
      result[currentKey] = JSON.parse(`{${jsonStr}}`);
    } catch {
      result[currentKey] = currentBlock.join('\n');
    }
  }

  return result as Partial<SkillMeta>;
}

/**
 * Scan the skills/autonomous-economy/ directory and return metadata
 * for each skill that has a valid SKILL.md.
 */
export function discoverEconomySkills(
  skillsRoot: string = path.resolve(process.cwd(), '../../skills/autonomous-economy'),
): SkillMeta[] {
  if (!fs.existsSync(skillsRoot)) {
    logger.debug('Skills directory not found', { skillsRoot });
    return [];
  }

  const skills: SkillMeta[] = [];
  const dirs = fs.readdirSync(skillsRoot, { withFileTypes: true });

  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;
    const mdPath = path.join(skillsRoot, dir.name, 'SKILL.md');
    if (!fs.existsSync(mdPath)) continue;

    try {
      const content = fs.readFileSync(mdPath, 'utf-8');
      const meta = parseSkillFrontmatter(content);
      if (meta.name && meta.description) {
        skills.push({
          name: meta.name,
          description: meta.description || '',
          version: meta.version || '0.1.0',
          handler_language: meta.handler_language || 'typescript',
          handler_file: meta.handler_file || 'handler.ts',
          inputs_schema: (meta.inputs_schema as Record<string, unknown>) || {},
          outputs_schema: (meta.outputs_schema as Record<string, unknown>) || {},
        });
      }
    } catch (err) {
      logger.warn('Failed to parse SKILL.md', { dir: dir.name, err: (err as Error).message });
    }
  }

  logger.info(`Discovered ${skills.length} economy skills`);
  return skills;
}

/**
 * Upsert economy skills into the `tools` table so they appear in
 * Sven's available tools prompt.
 */
export async function registerEconomySkills(
  pool: pg.Pool,
  skills?: SkillMeta[],
): Promise<number> {
  const discovered = skills ?? discoverEconomySkills();
  if (discovered.length === 0) return 0;

  let registered = 0;
  for (const skill of discovered) {
    const toolName = `economy.${skill.name}`;
    try {
      await pool.query(
        `INSERT INTO tools (
           id, name, display_name, category, description, version,
           execution_mode, inputs_schema, outputs_schema,
           is_first_party, trust_level, status
         ) VALUES (
           $1, $2, $3, 'economy', $4, $5,
           'in_process', $6::jsonb, $7::jsonb,
           true, 'trusted', 'active'
         )
         ON CONFLICT (name) DO UPDATE SET
           description = EXCLUDED.description,
           version = EXCLUDED.version,
           inputs_schema = EXCLUDED.inputs_schema,
           outputs_schema = EXCLUDED.outputs_schema,
           status = 'active',
           updated_at = NOW()`,
        [
          `economy-skill-${skill.name}`,
          toolName,
          skill.name.replace(/-/g, ' '),
          skill.description,
          skill.version,
          JSON.stringify(skill.inputs_schema),
          JSON.stringify(skill.outputs_schema),
        ],
      );
      registered++;
    } catch (err) {
      logger.warn('Failed to register economy skill', { toolName, err: (err as Error).message });
    }
  }

  logger.info(`Registered ${registered}/${discovered.length} economy skills in tools table`);
  return registered;
}

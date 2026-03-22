import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type DynamicSkillDirResolution =
  | {
      ok: true;
      resolvedSkillDir: string;
      source: 'workspace' | 'local_fallback';
      dynamicRoot: string;
      localSkillsRoot: string;
    }
  | {
      ok: false;
      error: string;
      dynamicRoot: string;
      localSkillsRoot: string;
    };

function normalizeRoot(inputPath: string): string {
  return path.resolve(inputPath);
}

export function isPathWithinDirectory(candidatePath: string, directoryPath: string): boolean {
  const candidate = path.resolve(candidatePath);
  const directory = path.resolve(directoryPath);
  const relative = path.relative(directory, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function resolveCanonicalExistingPath(inputPath: string): string | null {
  try {
    return fs.realpathSync(inputPath);
  } catch {
    return null;
  }
}

function isWithinRoot(candidatePath: string, rootPath: string): boolean {
  return isPathWithinDirectory(candidatePath, rootPath);
}

function deriveLocalFallbackCandidate(skillDir: string, localSkillsRoot: string): string | null {
  const normalized = skillDir.replace(/\\/g, '/');
  const marker = '/registry/';
  const idx = normalized.lastIndexOf(marker);
  if (idx === -1) return null;
  const suffix = normalized.slice(idx + marker.length).replace(/^\/+/, '');
  if (!suffix) return null;
  const segments = suffix
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments.length === 0) return null;

  for (const segment of segments) {
    if (segment === '.' || segment === '..') return null;
    if (!/^[a-zA-Z0-9._-]+$/.test(segment)) return null;
  }

  return path.join(localSkillsRoot, ...segments);
}

export function resolveDynamicSkillDirectory(params: {
  skillDir: string;
  allowLocalFallback: boolean;
}): DynamicSkillDirResolution {
  const dynamicRoot = normalizeRoot(
    process.env.SVEN_DYNAMIC_SKILLS_DIR || path.join(os.homedir(), '.sven', 'workspace', 'skills'),
  );
  const localSkillsRoot = normalizeRoot(
    process.env.SVEN_LOCAL_SKILLS_DIR || path.join(process.cwd(), 'skills'),
  );
  const requestedDir = normalizeRoot(params.skillDir);
  const dynamicRootCanonical = resolveCanonicalExistingPath(dynamicRoot);
  const localSkillsRootCanonical = resolveCanonicalExistingPath(localSkillsRoot);
  const requestedCanonical = resolveCanonicalExistingPath(requestedDir);

  if (
    requestedCanonical
    && dynamicRootCanonical
    && isWithinRoot(requestedCanonical, dynamicRootCanonical)
  ) {
    return {
      ok: true,
      resolvedSkillDir: requestedCanonical,
      source: 'workspace',
      dynamicRoot,
      localSkillsRoot,
    };
  }

  if (!params.allowLocalFallback) {
    return {
      ok: false,
      error: 'Dynamic skill path is outside the allowed workspace root',
      dynamicRoot,
      localSkillsRoot,
    };
  }

  const fallbackCandidate = deriveLocalFallbackCandidate(params.skillDir, localSkillsRoot);
  if (!fallbackCandidate) {
    return {
      ok: false,
      error: 'Dynamic skill fallback path could not be derived from manifest skill_dir',
      dynamicRoot,
      localSkillsRoot,
    };
  }

  const resolvedFallback = normalizeRoot(fallbackCandidate);
  const fallbackCanonical = resolveCanonicalExistingPath(resolvedFallback);
  if (!fallbackCanonical || !localSkillsRootCanonical || !isWithinRoot(fallbackCanonical, localSkillsRootCanonical)) {
    return {
      ok: false,
      error: 'Dynamic skill fallback path is outside local skills root',
      dynamicRoot,
      localSkillsRoot,
    };
  }

  return {
    ok: true,
    resolvedSkillDir: fallbackCanonical,
    source: 'local_fallback',
    dynamicRoot,
    localSkillsRoot,
  };
}

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { isPathWithinDirectory, resolveDynamicSkillDirectory } from '../src/dynamic-skill-paths';

describe('resolveDynamicSkillDirectory', () => {
  const previousDynamicRoot = process.env.SVEN_DYNAMIC_SKILLS_DIR;
  const previousLocalRoot = process.env.SVEN_LOCAL_SKILLS_DIR;

  afterEach(() => {
    if (previousDynamicRoot === undefined) delete process.env.SVEN_DYNAMIC_SKILLS_DIR;
    else process.env.SVEN_DYNAMIC_SKILLS_DIR = previousDynamicRoot;
    if (previousLocalRoot === undefined) delete process.env.SVEN_LOCAL_SKILLS_DIR;
    else process.env.SVEN_LOCAL_SKILLS_DIR = previousLocalRoot;
  });

  it('resolves direct workspace paths when inside dynamic root', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'sven-dyn-workspace-'));
    const dynamicRoot = path.join(tmp, 'workspace-skills');
    const skillDir = path.join(dynamicRoot, 'email-generic');
    await fs.mkdir(skillDir, { recursive: true });

    process.env.SVEN_DYNAMIC_SKILLS_DIR = dynamicRoot;
    process.env.SVEN_LOCAL_SKILLS_DIR = path.join(tmp, 'local-skills');

    const resolved = resolveDynamicSkillDirectory({
      skillDir,
      allowLocalFallback: true,
    });

    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.source).toBe('workspace');
    expect(resolved.resolvedSkillDir).toBe(path.resolve(skillDir));
  });

  it('falls back to repo local skills for /opt/sven/registry manifests', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'sven-dyn-local-'));
    const localRoot = path.join(tmp, 'skills');
    const fallbackDir = path.join(localRoot, 'email-generic');
    await fs.mkdir(fallbackDir, { recursive: true });

    process.env.SVEN_DYNAMIC_SKILLS_DIR = path.join(tmp, 'workspace-skills');
    process.env.SVEN_LOCAL_SKILLS_DIR = localRoot;

    const resolved = resolveDynamicSkillDirectory({
      skillDir: '/opt/sven/registry/email-generic',
      allowLocalFallback: true,
    });

    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.source).toBe('local_fallback');
    expect(resolved.resolvedSkillDir).toBe(path.resolve(fallbackDir));
  });

  it('maps full registry relative path (not only first segment) for fallback', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'sven-dyn-local-nested-'));
    const localRoot = path.join(tmp, 'skills');
    const nestedFallbackDir = path.join(localRoot, 'publisher-a', 'email-generic');
    await fs.mkdir(nestedFallbackDir, { recursive: true });

    process.env.SVEN_DYNAMIC_SKILLS_DIR = path.join(tmp, 'workspace-skills');
    process.env.SVEN_LOCAL_SKILLS_DIR = localRoot;

    const resolved = resolveDynamicSkillDirectory({
      skillDir: '/opt/sven/registry/publisher-a/email-generic',
      allowLocalFallback: true,
    });

    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.source).toBe('local_fallback');
    expect(resolved.resolvedSkillDir).toBe(path.resolve(nestedFallbackDir));
  });

  it('rejects fallback derivation for non-conforming registry segments (no lossy sanitization)', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'sven-dyn-local-invalid-'));
    const localRoot = path.join(tmp, 'skills');
    await fs.mkdir(localRoot, { recursive: true });

    process.env.SVEN_DYNAMIC_SKILLS_DIR = path.join(tmp, 'workspace-skills');
    process.env.SVEN_LOCAL_SKILLS_DIR = localRoot;

    const resolved = resolveDynamicSkillDirectory({
      skillDir: '/opt/sven/registry/publisher a/email-generic',
      allowLocalFallback: true,
    });

    expect(resolved.ok).toBe(false);
    if (resolved.ok) return;
    expect(resolved.error).toMatch(/could not be derived/i);
  });

  it('rejects out-of-root paths when local fallback is disabled', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'sven-dyn-reject-'));
    process.env.SVEN_DYNAMIC_SKILLS_DIR = path.join(tmp, 'workspace-skills');
    process.env.SVEN_LOCAL_SKILLS_DIR = path.join(tmp, 'local-skills');

    const resolved = resolveDynamicSkillDirectory({
      skillDir: '/opt/sven/registry/email-generic',
      allowLocalFallback: false,
    });

    expect(resolved.ok).toBe(false);
    if (resolved.ok) return;
    expect(resolved.error).toMatch(/outside the allowed workspace root/i);
  });

  it('rejects workspace symlink directories that resolve outside dynamic root', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'sven-dyn-symlink-'));
    const dynamicRoot = path.join(tmp, 'workspace-skills');
    const outsideRoot = path.join(tmp, 'outside');
    const outsideSkill = path.join(outsideRoot, 'email-generic');
    const symlinkPath = path.join(dynamicRoot, 'email-generic');
    await fs.mkdir(dynamicRoot, { recursive: true });
    await fs.mkdir(outsideSkill, { recursive: true });
    await fs.symlink(
      outsideSkill,
      symlinkPath,
      process.platform === 'win32' ? 'junction' : 'dir',
    );

    process.env.SVEN_DYNAMIC_SKILLS_DIR = dynamicRoot;
    process.env.SVEN_LOCAL_SKILLS_DIR = path.join(tmp, 'local-skills');

    const resolved = resolveDynamicSkillDirectory({
      skillDir: symlinkPath,
      allowLocalFallback: false,
    });

    expect(resolved.ok).toBe(false);
    if (resolved.ok) return;
    expect(resolved.error).toMatch(/outside the allowed workspace root/i);
  });

  it('enforces segment-safe containment (sibling-prefix escape does not pass)', () => {
    const base = path.resolve('/tmp/skills/foo');
    const escaped = path.resolve('/tmp/skills/foobar/handler.py');
    const contained = path.resolve('/tmp/skills/foo/handler.py');

    expect(isPathWithinDirectory(contained, base)).toBe(true);
    expect(isPathWithinDirectory(escaped, base)).toBe(false);
  });
});

import { mkdtemp, mkdir, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from '@jest/globals';
import { buildProjectTreePrompt, ProjectTreeContextCache } from '../project-tree-context';

describe('Project tree context', () => {
  it('integration: includes directory tree for active project workspace', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sven-tree-'));
    await mkdir(join(root, 'src'), { recursive: true });
    await writeFile(join(root, 'src', 'index.ts'), 'export const ok = true;\n', 'utf8');
    await writeFile(join(root, 'README.md'), '# test\n', 'utf8');

    const prompt = await buildProjectTreePrompt({
      workspacePath: root,
      maxDepth: 3,
      maxFilesPerDir: 50,
      customExcludePatterns: [],
    });
    expect(prompt).toContain('Project directory tree');
    expect(prompt).toContain('src/');
    expect(prompt).toContain('index.ts');
    expect(prompt).toContain('README.md');
  });

  it('integration: respects .gitignore and excludes node_modules', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sven-tree-ignore-'));
    await mkdir(join(root, 'node_modules', 'leftpad'), { recursive: true });
    await mkdir(join(root, 'src'), { recursive: true });
    await writeFile(join(root, '.gitignore'), 'node_modules\n', 'utf8');
    await writeFile(join(root, 'node_modules', 'leftpad', 'index.js'), 'module.exports = {}\n', 'utf8');
    await writeFile(join(root, 'src', 'app.ts'), 'console.log("ok");\n', 'utf8');

    const prompt = await buildProjectTreePrompt({
      workspacePath: root,
      maxDepth: 3,
      maxFilesPerDir: 50,
      customExcludePatterns: [],
    });
    expect(prompt).toContain('src/');
    expect(prompt).toContain('app.ts');
    expect(prompt).not.toContain('node_modules');
    expect(prompt).not.toContain('leftpad');
  });

  it('debounces tree refreshes for repeated calls', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sven-tree-cache-'));
    await writeFile(join(root, 'a.txt'), 'a\n', 'utf8');
    const cache = new ProjectTreeContextCache();

    const first = await cache.getPrompt({
      workspacePath: root,
      maxDepth: 3,
      maxFilesPerDir: 50,
      customExcludePatterns: [],
      debounceMs: 30_000,
      allowedRoots: [root],
    });
    await writeFile(join(root, 'b.txt'), 'b\n', 'utf8');
    const second = await cache.getPrompt({
      workspacePath: root,
      maxDepth: 3,
      maxFilesPerDir: 50,
      customExcludePatterns: [],
      debounceMs: 30_000,
      allowedRoots: [root],
    });
    expect(second).toBe(first);
  });

  it('evicts least-recently-used entries when cache exceeds maxEntries', async () => {
    const roots: string[] = [];
    for (let i = 0; i < 6; i += 1) {
      const root = await mkdtemp(join(tmpdir(), `sven-tree-lru-${i}-`));
      roots.push(root);
      await writeFile(join(root, `f${i}.txt`), `${i}\n`, 'utf8');
    }

    const cache = new ProjectTreeContextCache({ maxEntries: 3, maxIdleMs: 60_000 });
    for (const root of roots) {
      await cache.getPrompt({
        workspacePath: root,
        maxDepth: 2,
        maxFilesPerDir: 10,
        customExcludePatterns: [],
        debounceMs: 30_000,
        allowedRoots: [root],
      });
    }

    const internal = (cache as any).cache as Map<string, unknown>;
    expect(internal.size).toBeLessThanOrEqual(3);
    expect(internal.has(resolve(roots[0]))).toBe(false);
    expect(internal.has(resolve(roots[5]))).toBe(true);
  });

  it('prunes idle cache entries before serving prompts', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sven-tree-idle-'));
    await writeFile(join(root, 'x.txt'), 'x\n', 'utf8');

    const cache = new ProjectTreeContextCache({ maxEntries: 10, maxIdleMs: 50 });
    await cache.getPrompt({
      workspacePath: root,
      maxDepth: 2,
      maxFilesPerDir: 10,
      customExcludePatterns: [],
      debounceMs: 30_000,
      allowedRoots: [root],
    });

    // Force internal entry stale to avoid timing flakiness.
    const internal = (cache as any).cache as Map<string, any>;
    const key = resolve(root);
    const existing = internal.get(key);
    expect(existing).toBeDefined();
    existing.lastAccessedAt = Date.now() - 60_000;
    internal.set(key, existing);

    const otherRoot = await mkdtemp(join(tmpdir(), 'sven-tree-idle-other-'));
    await writeFile(join(otherRoot, 'y.txt'), 'y\n', 'utf8');
    await cache.getPrompt({
      workspacePath: otherRoot,
      maxDepth: 2,
      maxFilesPerDir: 10,
      customExcludePatterns: [],
      debounceMs: 30_000,
      allowedRoots: [otherRoot],
    });

    expect(internal.has(key)).toBe(false);
  });

  it('returns empty when workspace is outside configured allowed roots', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sven-tree-outside-'));
    await writeFile(join(root, 'a.txt'), 'a\n', 'utf8');
    const cache = new ProjectTreeContextCache();

    const prompt = await cache.getPrompt({
      workspacePath: root,
      maxDepth: 3,
      maxFilesPerDir: 50,
      customExcludePatterns: [],
      debounceMs: 30_000,
      allowedRoots: [join(root, 'allowed-root-does-not-contain-workspace')],
    });

    expect(prompt).toBe('');
  });

  it('returns empty when workspace path is a symlink escaping allowed root', async () => {
    const allowedRoot = await mkdtemp(join(tmpdir(), 'sven-tree-allowed-'));
    const outsideRoot = await mkdtemp(join(tmpdir(), 'sven-tree-outside-real-'));
    await writeFile(join(outsideRoot, 'secret.txt'), 'secret\n', 'utf8');

    const linkPath = join(allowedRoot, 'workspace-link');
    await symlink(
      outsideRoot,
      linkPath,
      process.platform === 'win32' ? 'junction' : 'dir',
    );

    const cache = new ProjectTreeContextCache();
    const prompt = await cache.getPrompt({
      workspacePath: linkPath,
      maxDepth: 3,
      maxFilesPerDir: 50,
      customExcludePatterns: [],
      debounceMs: 30_000,
      allowedRoots: [allowedRoot],
    });

    expect(prompt).toBe('');
  });
});

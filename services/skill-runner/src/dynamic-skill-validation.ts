import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

type HandlerSyntaxValidationDeps = {
  fsApi?: Pick<typeof fs, 'mkdtemp' | 'writeFile' | 'rm'>;
  spawnSyncImpl?: typeof spawnSync;
  tmpdir?: () => string;
};

export async function validateHandlerSyntax(
  language: 'typescript' | 'python' | 'shell',
  handlerCode: string,
  deps: HandlerSyntaxValidationDeps = {},
): Promise<{ ok: boolean; error?: string }> {
  if (!handlerCode.trim()) return { ok: false, error: 'handler_code is required' };

  const fsApi = deps.fsApi || fs;
  const spawnSyncImpl = deps.spawnSyncImpl || spawnSync;
  const tmpRoot = (deps.tmpdir || os.tmpdir)();
  const tmpDir = await fsApi.mkdtemp(path.join(tmpRoot, 'sven-skill-validate-'));
  const ext = language === 'python' ? 'py' : language === 'shell' ? 'sh' : 'ts';
  const filePath = path.join(tmpDir, `validate.${ext}`);
  await fsApi.writeFile(filePath, handlerCode, 'utf8');

  try {
    if (language === 'shell') {
      const check = spawnSyncImpl('sh', ['-n', filePath], { encoding: 'utf8' });
      if (check.status !== 0) {
        return { ok: false, error: String(check.stderr || check.stdout || 'shell syntax error') };
      }
      return { ok: true };
    }

    if (language === 'python') {
      const check = spawnSyncImpl('python', ['-m', 'py_compile', filePath], { encoding: 'utf8' });
      if (check.error && /ENOENT/i.test(String(check.error))) return { ok: true };
      if (check.status !== 0) {
        return { ok: false, error: String(check.stderr || check.stdout || 'python syntax error') };
      }
      return { ok: true };
    }

    if (!/export\s+default|module\.exports|function|const|class/.test(handlerCode)) {
      return { ok: false, error: 'TypeScript handler must include executable code' };
    }
    return { ok: true };
  } finally {
    await fsApi.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export type NativeShellInputs = Record<string, unknown>;

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_BYTES = 256 * 1024;
const MAX_TIMEOUT_MS = 120_000;
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;

const DEFAULT_ALLOWLIST = [
  'pwd',
  'ls',
  'dir',
  'echo',
  'cat',
  'type',
  'rg',
  'git',
  'npm',
  'pnpm',
  'yarn',
  'Get-ChildItem',
  'Get-Content',
];

const DEFAULT_ENV_ALLOWLIST = [
  'PATH',
  'HOME',
  'USERPROFILE',
  'TMP',
  'TEMP',
  'SystemRoot',
  'ComSpec',
  'PATHEXT',
  'LANG',
  'LC_ALL',
  'TERM',
];

function parseBooleanEnv(value: string | undefined): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(Math.round(parsed), max));
}

function trimOutput(value: string, maxBytes: number): string {
  if (Buffer.byteLength(value, 'utf8') <= maxBytes) return value;
  return value.slice(0, maxBytes);
}

function isMaxBufferExceededError(error: string | undefined): boolean {
  const value = String(error || '').toLowerCase();
  return value.includes('maxbuffer') || value.includes('max buffer') || value.includes('stdio maxbuffer');
}

function toCanonicalPath(targetPath: string, realpath: (target: string) => string): string {
  return path.resolve(realpath(path.resolve(targetPath)));
}

function resolveAllowedRoots(cwd: string, rootsRaw: string, realpath: (target: string) => string): string[] {
  const roots = rootsRaw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => toCanonicalPath(entry, realpath));
  if (roots.length > 0) return roots;
  return [cwd];
}

function isWithinRoot(targetDir: string, allowedRoots: string[]): boolean {
  const resolved = path.resolve(targetDir);
  return allowedRoots.some((root) => {
    const normalizedRoot = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
    return resolved === root || resolved.startsWith(normalizedRoot);
  });
}

function firstToken(command: string): string {
  const match = command.trim().match(/^([^\s]+)/);
  return match ? match[1] : '';
}

function detectCommandObfuscation(command: string): string | null {
  const normalized = String(command || '');
  const lower = normalized.toLowerCase();

  const patterns: Array<{ id: string; regex: RegExp }> = [
    { id: 'base64_decode_pipeline', regex: /(?:\bbase64\b[^\n\r]*\b-d\b|\bfrombase64string\s*\(|\[\s*convert\s*\]::frombase64string\s*\()/i },
    { id: 'dynamic_eval', regex: /(?:\beval\b|\binvoke-expression\b|\biex\b)/i },
    { id: 'command_substitution', regex: /(?:\$\([^)]+\)|`[^`]+`)/ },
    { id: 'shell_control_operator', regex: /(?:&&|\|\||;)/ },
    { id: 'pipeline_chaining', regex: /\|/ },
    { id: 'redirection_operator', regex: /(?:^|\s)(?:\d?>>?|<|>>)(?:\s|$)/ },
    { id: 'background_operator', regex: /(?:^|\s)&(?:\s|$)/ },
    { id: 'pipe_to_shell', regex: /(?:\|\s*(?:sh|bash|zsh|pwsh|powershell(?:\.exe)?)\b)/i },
  ];

  for (const pattern of patterns) {
    if (pattern.regex.test(normalized)) {
      return pattern.id;
    }
  }

  if (lower.includes('%comspec%')) {
    return 'comspec_indirection';
  }

  return null;
}

function buildShellEnv(hostEnv: Record<string, string | undefined>): Record<string, string> {
  const allowlistRaw = String(hostEnv.SVEN_NATIVE_SHELL_ENV_ALLOWLIST || '').trim();
  const allowlist = (allowlistRaw
    ? allowlistRaw.split(',').map((entry) => entry.trim()).filter(Boolean)
    : DEFAULT_ENV_ALLOWLIST);

  const shellEnv: Record<string, string> = {};
  for (const key of allowlist) {
    const value = hostEnv[key];
    if (typeof value === 'string') {
      shellEnv[key] = value;
    }
  }
  return shellEnv;
}

export function executeNativeShellTool(
  inputs: NativeShellInputs,
  deps?: {
    env?: Record<string, string | undefined>;
    cwd?: string;
    realpath?: (target: string) => string;
    run?: (args: {
      shellPath: string;
      shellArgs: string[];
      cwd: string;
      timeoutMs: number;
      maxBytes: number;
      env: Record<string, string>;
    }) => {
      stdout: string;
      stderr: string;
      exitCode: number | null;
      timedOut: boolean;
      signal: string | null;
      error?: string;
      outputTooLarge?: boolean;
    };
  },
): { outputs: Record<string, unknown>; error?: string } {
  const env = deps?.env || process.env;
  const isNativeMode = parseBooleanEnv(env.SVEN_NATIVE_MODE);
  if (!isNativeMode) {
    return { outputs: {}, error: 'shell.exec is disabled unless SVEN_NATIVE_MODE=true' };
  }

  const command = String(inputs.command || '').trim();
  if (!command) {
    return { outputs: {}, error: 'inputs.command is required' };
  }

  if (command.includes('\n') || command.includes('\r')) {
    return { outputs: {}, error: 'multi-line shell commands are not allowed' };
  }

  const obfuscationReason = detectCommandObfuscation(command);
  if (obfuscationReason) {
    return {
      outputs: {
        command,
        obfuscation_reason: obfuscationReason,
      },
      error: 'shell command rejected: potential obfuscation detected',
    };
  }

  const allowlistRaw = String(env.SVEN_NATIVE_SHELL_ALLOWLIST || '').trim();
  const allowlist = (allowlistRaw
    ? allowlistRaw.split(',').map((entry) => entry.trim()).filter(Boolean)
    : DEFAULT_ALLOWLIST);
  const commandToken = firstToken(command);
  if (!commandToken || !allowlist.includes(commandToken)) {
    return {
      outputs: {
        command,
        allowed_commands: allowlist,
      },
      error: `command "${commandToken || '(empty)'}" is not allowlisted`,
    };
  }

  const realpath = deps?.realpath || ((target: string) => fs.realpathSync(target));
  const workspaceCwdRaw = path.resolve(deps?.cwd || process.cwd());
  let workspaceCwd: string;
  try {
    workspaceCwd = toCanonicalPath(workspaceCwdRaw, realpath);
  } catch {
    return { outputs: {}, error: `workspace cwd is not accessible: ${workspaceCwdRaw}` };
  }
  const targetCwdRaw = typeof inputs.cwd === 'string' ? inputs.cwd.trim() : '';
  const targetCwdInput = path.resolve(targetCwdRaw || workspaceCwdRaw);
  let targetCwd: string;
  try {
    targetCwd = toCanonicalPath(targetCwdInput, realpath);
  } catch {
    return {
      outputs: {
        command,
        cwd: targetCwdInput,
      },
      error: 'cwd does not exist or is not accessible',
    };
  }
  const allowedRoots = resolveAllowedRoots(workspaceCwd, String(env.SVEN_NATIVE_SHELL_ALLOWED_ROOTS || ''), realpath);
  if (!isWithinRoot(targetCwd, allowedRoots)) {
    return {
      outputs: {
        command,
        cwd: targetCwd,
        allowed_roots: allowedRoots,
      },
      error: 'cwd is outside allowed roots',
    };
  }

  const timeoutMs = clampNumber(inputs.timeout_ms, DEFAULT_TIMEOUT_MS, 1_000, MAX_TIMEOUT_MS);
  const maxBytes = clampNumber(inputs.max_bytes, DEFAULT_MAX_BYTES, 1_024, MAX_OUTPUT_BYTES);

  const shellOverride = String(env.SVEN_NATIVE_SHELL_PATH || '').trim();
  const isWindows = process.platform === 'win32';
  const shellPath = shellOverride || (isWindows ? 'powershell.exe' : '/bin/bash');
  const shellArgs = isWindows
    ? ['-NoProfile', '-NonInteractive', '-Command', command]
    : ['-lc', command];

  const startedAt = Date.now();
  const shellEnv = buildShellEnv(env);
  const run = deps?.run || ((args) => {
    const result = spawnSync(args.shellPath, args.shellArgs, {
      cwd: args.cwd,
      timeout: args.timeoutMs,
      encoding: 'utf8',
      env: args.env,
      maxBuffer: args.maxBytes,
    });
    const errorMessage = result.error ? String(result.error.message || result.error) : undefined;
    return {
      stdout: String(result.stdout || ''),
      stderr: String(result.stderr || ''),
      exitCode: result.status,
      signal: result.signal,
      timedOut: Boolean(result.error && String(result.error.message || '').toLowerCase().includes('timed out')),
      error: errorMessage,
      outputTooLarge: isMaxBufferExceededError(errorMessage),
    };
  });

  const result = run({
    shellPath,
    shellArgs,
    cwd: targetCwd,
    timeoutMs,
    maxBytes,
    env: shellEnv,
  });

  const stdout = trimOutput(String(result.stdout || ''), maxBytes);
  const stderr = trimOutput(String(result.stderr || ''), maxBytes);
  const durationMs = Math.max(0, Date.now() - startedAt);

  const outputs: Record<string, unknown> = {
    command,
    cwd: targetCwd,
    shell: shellPath,
    stdout,
    stderr,
    exit_code: result.exitCode,
    timed_out: result.timedOut,
    signal: result.signal || undefined,
    duration_ms: durationMs,
  };

  if (result.outputTooLarge) {
    return { outputs, error: `shell output exceeded max_bytes limit (${maxBytes} bytes)` };
  }
  if (result.error && !result.timedOut) {
    return { outputs, error: `shell execution failed: ${result.error}` };
  }
  if (result.timedOut) {
    return { outputs, error: `shell command timed out after ${timeoutMs}ms` };
  }
  if (typeof result.exitCode === 'number' && result.exitCode !== 0) {
    const stderrLine = String(stderr || '').trim().split('\n')[0] || `exit code ${result.exitCode}`;
    return { outputs, error: stderrLine };
  }
  return { outputs };
}

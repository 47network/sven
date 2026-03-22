import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

export type NativeMediaInputs = Record<string, unknown>;

const DEFAULT_CAPTURE_DIR = 'artifacts/native-capture';
const DEFAULT_AUDIO_SECONDS = 5;
const MAX_AUDIO_SECONDS = 120;
const DEFAULT_CAPTURE_LOG_BYTES = 8 * 1024;
const MAX_CAPTURE_LOG_BYTES_CAP = 256 * 1024;

type ProcResult = {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: unknown;
};

type RunProc = (cmd: string, args: string[], opts?: { timeoutMs?: number }) => ProcResult;

function parseBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  }
  return fallback;
}

function clamp(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function sanitizeFileName(value: string, fallback: string): string {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  return raw.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function resolveAllowedRoots(raw: string, cwd: string, fallbackRoot: string): string[] {
  const parts = String(raw || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => path.resolve(entry));
  if (parts.length > 0) return parts;
  return [path.resolve(cwd), path.resolve(fallbackRoot)];
}

function isWithinRoots(target: string, roots: string[]): boolean {
  const resolved = path.resolve(target);
  return roots.some((root) => {
    const normalizedRoot = path.resolve(root);
    const normalizedRootWithSep = normalizedRoot.endsWith(path.sep)
      ? normalizedRoot
      : `${normalizedRoot}${path.sep}`;
    return resolved === normalizedRoot || resolved.startsWith(normalizedRootWithSep);
  });
}

async function resolveCanonicalRoots(
  roots: string[],
): Promise<string[]> {
  const resolved = await Promise.all(
    roots.map(async (root) => {
      try {
        return await fs.realpath(path.resolve(root));
      } catch {
        return null;
      }
    }),
  );
  return Array.from(new Set(resolved.filter((root): root is string => Boolean(root))));
}

async function resolveExistingCanonicalPath(inputPath: string): Promise<string> {
  let cursor = path.resolve(inputPath);
  for (;;) {
    try {
      const canonical = await fs.realpath(cursor);
      if (cursor === inputPath) {
        return canonical;
      }
      const suffix = path.relative(cursor, inputPath);
      return path.resolve(canonical, suffix);
    } catch {
      const parent = path.dirname(cursor);
      if (parent === cursor) {
        throw new Error(`path does not exist for canonical resolution: ${inputPath}`);
      }
      cursor = parent;
    }
  }
}

function defaultRunProc(cmd: string, args: string[], opts?: { timeoutMs?: number }): ProcResult {
  const run = spawnSync(cmd, args, {
    encoding: 'utf8',
    timeout: opts?.timeoutMs,
    env: process.env,
  });
  return {
    status: run.status,
    stdout: String(run.stdout || ''),
    stderr: String(run.stderr || ''),
    error: run.error,
  };
}

function resolveCaptureLogMaxBytes(env: Record<string, string | undefined>): number {
  const raw = Number(env.SVEN_NATIVE_CAPTURE_MAX_LOG_BYTES || DEFAULT_CAPTURE_LOG_BYTES);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_CAPTURE_LOG_BYTES;
  return Math.min(Math.max(Math.floor(raw), 1024), MAX_CAPTURE_LOG_BYTES_CAP);
}

function clampLogOutput(value: string, maxBytes: number): string {
  const raw = String(value || '');
  const byteLength = Buffer.byteLength(raw, 'utf8');
  if (byteLength <= maxBytes) return raw;
  const marker = `\n...[truncated ${byteLength - maxBytes} bytes]`;
  const markerBytes = Buffer.byteLength(marker, 'utf8');
  const keepBytes = Math.max(0, maxBytes - markerBytes);
  const kept = Buffer.from(raw, 'utf8').subarray(0, keepBytes).toString('utf8');
  return `${kept}${marker}`;
}

async function buildOutputPath(
  inputs: NativeMediaInputs,
  cwd: string,
  env: Record<string, string | undefined>,
  ext: string,
): Promise<{ ok: true; outputPath: string; outputDir: string } | { ok: false; error: string; outputs?: Record<string, unknown> }> {
  const configuredDir = String(env.SVEN_NATIVE_CAPTURE_OUTPUT_DIR || '').trim();
  const outputDir = path.resolve(configuredDir || path.resolve(cwd, DEFAULT_CAPTURE_DIR));
  const allowedRoots = resolveAllowedRoots(String(env.SVEN_NATIVE_CAPTURE_ALLOWED_ROOTS || ''), cwd, outputDir);
  const canonicalAllowedRoots = await resolveCanonicalRoots(allowedRoots);
  if (canonicalAllowedRoots.length === 0) {
    return {
      ok: false,
      error: 'no valid canonical allowed roots configured for native media capture',
      outputs: { allowed_roots: allowedRoots },
    };
  }

  const canonicalOutputDirCandidate = await resolveExistingCanonicalPath(outputDir).catch(() => outputDir);
  if (!isWithinRoots(canonicalOutputDirCandidate, canonicalAllowedRoots)) {
    return {
      ok: false,
      error: 'capture output directory is outside allowed roots',
      outputs: { output_dir: outputDir, allowed_roots: canonicalAllowedRoots },
    };
  }

  const filenameInput = typeof inputs.filename === 'string' ? inputs.filename : '';
  const filename = sanitizeFileName(filenameInput, `${Date.now()}.${ext}`);
  const outputPathName = filename.endsWith(`.${ext}`) ? filename : `${filename}.${ext}`;
  const outputPath = path.resolve(outputDir, outputPathName);
  if (!isWithinRoots(outputPath, canonicalAllowedRoots)) {
    return {
      ok: false,
      error: 'output path is outside allowed roots',
      outputs: { output_path: outputPath, allowed_roots: canonicalAllowedRoots },
    };
  }
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const canonicalOutputDir = await fs.realpath(path.dirname(outputPath)).catch(() => path.dirname(outputPath));
  if (!isWithinRoots(canonicalOutputDir, canonicalAllowedRoots)) {
    return {
      ok: false,
      error: 'capture output directory resolved outside allowed roots',
      outputs: { output_dir: canonicalOutputDir, allowed_roots: canonicalAllowedRoots },
    };
  }
  const canonicalOutputPath = path.resolve(canonicalOutputDir, outputPathName);
  if (!isWithinRoots(canonicalOutputPath, canonicalAllowedRoots)) {
    return {
      ok: false,
      error: 'output path resolved outside allowed roots',
      outputs: { output_path: canonicalOutputPath, allowed_roots: canonicalAllowedRoots },
    };
  }
  return { ok: true, outputPath: canonicalOutputPath, outputDir: canonicalOutputDir };
}

function platformScreenshotCommand(targetPath: string): { cmd: string; args: string[]; timeoutMs: number } | null {
  const platform = process.platform;
  if (platform === 'win32') {
    const script = [
      'Add-Type -AssemblyName System.Windows.Forms;',
      'Add-Type -AssemblyName System.Drawing;',
      '$bounds=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds;',
      '$bmp=New-Object System.Drawing.Bitmap($bounds.Width,$bounds.Height);',
      '$g=[System.Drawing.Graphics]::FromImage($bmp);',
      '$g.CopyFromScreen($bounds.Location,[System.Drawing.Point]::Empty,$bounds.Size);',
      `$bmp.Save('${targetPath.replace(/'/g, "''")}');`,
      '$g.Dispose();',
      '$bmp.Dispose();',
    ].join(' ');
    return { cmd: 'powershell.exe', args: ['-NoProfile', '-NonInteractive', '-Command', script], timeoutMs: 15000 };
  }
  if (platform === 'darwin') {
    return { cmd: 'screencapture', args: ['-x', targetPath], timeoutMs: 15000 };
  }
  if (platform === 'linux') {
    // ffmpeg x11grab is broadly available on native Linux hosts with display access.
    return { cmd: 'ffmpeg', args: ['-y', '-f', 'x11grab', '-frames:v', '1', '-i', ':0.0', targetPath], timeoutMs: 20000 };
  }
  return null;
}

function platformAudioCommand(targetPath: string, seconds: number): { cmd: string; args: string[]; timeoutMs: number } {
  const platform = process.platform;
  if (platform === 'win32') {
    return {
      cmd: 'ffmpeg',
      args: ['-y', '-f', 'dshow', '-i', 'audio=default', '-t', String(seconds), targetPath],
      timeoutMs: seconds * 1000 + 15000,
    };
  }
  if (platform === 'darwin') {
    return {
      cmd: 'ffmpeg',
      args: ['-y', '-f', 'avfoundation', '-i', ':0', '-t', String(seconds), targetPath],
      timeoutMs: seconds * 1000 + 15000,
    };
  }
  return {
    cmd: 'ffmpeg',
    args: ['-y', '-f', 'pulse', '-i', 'default', '-t', String(seconds), targetPath],
    timeoutMs: seconds * 1000 + 15000,
  };
}

export async function executeScreenCaptureTool(
  inputs: NativeMediaInputs,
  deps?: { env?: Record<string, string | undefined>; cwd?: string; runProc?: RunProc },
): Promise<{ outputs: Record<string, unknown>; error?: string }> {
  const env = deps?.env || process.env;
  const nativeMode = parseBool(env.SVEN_NATIVE_MODE, false);
  if (!nativeMode) {
    return { outputs: {}, error: 'screen.capture is disabled unless SVEN_NATIVE_MODE=true' };
  }

  const cwd = path.resolve(deps?.cwd || process.cwd());
  const ext = 'png';
  const output = await buildOutputPath(inputs, cwd, env, ext);
  if (!output.ok) {
    return { outputs: output.outputs || {}, error: output.error };
  }

  const spec = platformScreenshotCommand(output.outputPath);
  if (!spec) {
    return { outputs: {}, error: `unsupported platform for screen.capture: ${process.platform}` };
  }

  const run = deps?.runProc || defaultRunProc;
  const startedAt = Date.now();
  const result = run(spec.cmd, spec.args, { timeoutMs: spec.timeoutMs });
  const durationMs = Math.max(0, Date.now() - startedAt);
  const exists = await fs.stat(output.outputPath).then(() => true).catch(() => false);
  const maxLogBytes = resolveCaptureLogMaxBytes(env);

  const outputs: Record<string, unknown> = {
    file_path: output.outputPath,
    format: ext,
    duration_ms: durationMs,
    stdout: clampLogOutput(result.stdout, maxLogBytes),
    stderr: clampLogOutput(result.stderr, maxLogBytes),
  };

  if (result.error || result.status !== 0 || !exists) {
    const errMsg = String((result.error as { message?: string } | undefined)?.message || result.stderr || 'screen capture failed').trim();
    return { outputs, error: errMsg };
  }
  return { outputs };
}

export async function executeAudioRecordTool(
  inputs: NativeMediaInputs,
  deps?: { env?: Record<string, string | undefined>; cwd?: string; runProc?: RunProc },
): Promise<{ outputs: Record<string, unknown>; error?: string }> {
  const env = deps?.env || process.env;
  const nativeMode = parseBool(env.SVEN_NATIVE_MODE, false);
  if (!nativeMode) {
    return { outputs: {}, error: 'audio.record is disabled unless SVEN_NATIVE_MODE=true' };
  }

  const seconds = clamp(inputs.seconds, DEFAULT_AUDIO_SECONDS, 1, MAX_AUDIO_SECONDS);
  const formatRaw = String(inputs.format || 'wav').trim().toLowerCase();
  const format = formatRaw === 'mp3' ? 'mp3' : 'wav';

  const cwd = path.resolve(deps?.cwd || process.cwd());
  const output = await buildOutputPath(inputs, cwd, env, format);
  if (!output.ok) {
    return { outputs: output.outputs || {}, error: output.error };
  }

  const spec = platformAudioCommand(output.outputPath, seconds);
  const run = deps?.runProc || defaultRunProc;
  const startedAt = Date.now();
  const result = run(spec.cmd, spec.args, { timeoutMs: spec.timeoutMs });
  const durationMs = Math.max(0, Date.now() - startedAt);
  const exists = await fs.stat(output.outputPath).then(() => true).catch(() => false);
  const maxLogBytes = resolveCaptureLogMaxBytes(env);

  const outputs: Record<string, unknown> = {
    file_path: output.outputPath,
    format,
    requested_seconds: seconds,
    duration_ms: durationMs,
    stdout: clampLogOutput(result.stdout, maxLogBytes),
    stderr: clampLogOutput(result.stderr, maxLogBytes),
  };

  if (result.error || result.status !== 0 || !exists) {
    const errMsg = String((result.error as { message?: string } | undefined)?.message || result.stderr || 'audio recording failed').trim();
    return { outputs, error: errMsg };
  }
  return { outputs };
}

const fs = require('fs');
const path = require('path');

function resolveFirstExisting(paths) {
  for (const candidate of paths) {
    if (!candidate) continue;
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      // Ignore invalid candidates and continue.
    }
  }
  return '';
}

function resolveSoakRuntimeEnv() {
  try {
    const runPath = path.resolve(__dirname, '..', '..', 'docs', 'release', 'status', 'soak-72h-run.json');
    if (!fs.existsSync(runPath)) return { databaseUrl: '', natsUrl: '' };
    const raw = fs.readFileSync(runPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (String(parsed?.status || '') !== 'running') return { databaseUrl: '', natsUrl: '' };
    return {
      databaseUrl: String(parsed?.database_url || '').trim(),
      natsUrl: String(parsed?.nats_url || '').trim(),
    };
  } catch {
    return { databaseUrl: '', natsUrl: '' };
  }
}

const soakRuntime = resolveSoakRuntimeEnv();
const nodeExe =
  process.env.SVEN_NODE_EXE ||
  resolveFirstExisting([
    'C:\\Users\\hantz\\AppData\\Local\\Programs\\cursor\\resources\\app\\resources\\helpers\\node.exe',
    'C:\\Program Files\\nodejs\\node.exe',
    'C:\\Users\\hantz\\AppData\\Local\\ms-playwright-go\\1.50.1\\node.exe',
  ]) ||
  process.execPath;
const webApiUrl =
  process.env.SVEN_WEB_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://127.0.0.1:3000';
const searxngUrl =
  process.env.SEARXNG_URL ||
  'http://searxng.localtest.me:18080';
const nasRoot =
  process.env.SVEN_NAS_ROOT ||
  path.resolve(__dirname, '..', '..', '.runtime', 'nas');
const storageRoot =
  process.env.ARTIFACT_STORAGE_ROOT ||
  process.env.SVEN_STORAGE_ROOT ||
  path.resolve(__dirname, '..', '..', 'storage');
module.exports = {
  apps: [
    {
      name: 'sven-gateway-api',
      cwd: 'services/gateway-api',
      script: 'dist/index.js',
      interpreter: nodeExe,
      env: {
        NODE_ENV: 'production',
        SVEN_HARDENING_PROFILE: 'strict',
        AUTH_DISABLE_TOKEN_EXCHANGE: 'true',
        GATEWAY_PORT: '3000',
        GATEWAY_HOST: '127.0.0.1',
        DATABASE_URL:
          soakRuntime.databaseUrl ||
          process.env.SVEN_RUNTIME_DATABASE_URL ||
          process.env.DATABASE_URL ||
          'postgresql://sven:sven-dev-47@127.0.0.1:5432/sven',
        COMMUNITY_DATABASE_URL:
          process.env.COMMUNITY_DATABASE_URL ||
          soakRuntime.databaseUrl ||
          process.env.SVEN_RUNTIME_DATABASE_URL ||
          process.env.DATABASE_URL ||
          'postgresql://sven:sven-dev-47@127.0.0.1:5432/sven',
        NATS_URL: soakRuntime.natsUrl || process.env.SVEN_RUNTIME_NATS_URL || process.env.NATS_URL || 'nats://127.0.0.1:59530',
        SVEN_NAS_ROOT: nasRoot,
        ARTIFACT_STORAGE_ROOT: storageRoot,
        SVEN_STORAGE_ROOT: storageRoot,
        SEARXNG_URL: searxngUrl,
        SVEN_EDITOR_ENABLED: process.env.SVEN_EDITOR_ENABLED || 'true',
        COOKIE_SECRET:
          process.env.COOKIE_SECRET || 'replace-this-with-a-real-64-char-cookie-secret-before-production',
      },
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
      time: true,
    },
    {
      name: 'sven-agent-runtime',
      cwd: 'services/agent-runtime',
      script: 'dist/index.js',
      interpreter: nodeExe,
      env: {
        NODE_ENV: 'production',
        DATABASE_URL:
          soakRuntime.databaseUrl ||
          process.env.SVEN_RUNTIME_DATABASE_URL ||
          process.env.DATABASE_URL ||
          'postgresql://sven:sven-dev-47@127.0.0.1:5432/sven',
        NATS_URL: soakRuntime.natsUrl || process.env.SVEN_RUNTIME_NATS_URL || process.env.NATS_URL || 'nats://127.0.0.1:59530',
        AGENT_RUNTIME_METRICS_PORT: process.env.AGENT_RUNTIME_METRICS_PORT || '39100',
        OLLAMA_URL: process.env.OLLAMA_URL || 'http://127.0.0.1:11434',
        LITELLM_URL: process.env.LITELLM_URL || 'http://127.0.0.1:4000',
        SEARXNG_URL: searxngUrl,
        SVEN_PROJECT_CONTEXT_ALLOWED_ROOTS:
          process.env.SVEN_PROJECT_CONTEXT_ALLOWED_ROOTS ||
          path.resolve(__dirname, '..', '..'),
      },
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
      time: true,
    },
    {
      name: 'sven-admin-ui',
      cwd: 'apps/admin-ui',
      script: path.resolve(__dirname, '..', '..', 'node_modules', 'next', 'dist', 'bin', 'next'),
      args: 'start --port 3100',
      interpreter: nodeExe,
      env: {
        NODE_ENV: 'production',
        PORT: '3100',
        NEXT_PUBLIC_API_URL: webApiUrl,
      },
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
      time: true,
    },
    {
      name: 'sven-canvas-ui',
      cwd: 'apps/canvas-ui',
      script: path.resolve(__dirname, '..', '..', 'node_modules', 'next', 'dist', 'bin', 'next'),
      args: 'start --port 3200',
      interpreter: nodeExe,
      env: {
        NODE_ENV: 'production',
        PORT: '3200',
        NEXT_PUBLIC_API_URL: webApiUrl,
      },
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
      time: true,
    },
  ],
};

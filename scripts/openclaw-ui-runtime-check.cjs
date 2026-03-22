#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const outDir = path.join(root, 'docs', 'release', 'status');
const outJson = path.join(outDir, 'openclaw-ui-runtime-latest.json');
const outMd = path.join(outDir, 'openclaw-ui-runtime-latest.md');

function rel(filePath) {
  return path.relative(root, filePath).replace(/\\/g, '/');
}

function readUtf8(relPath) {
  const full = path.join(root, relPath);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';
}

function exists(relPath) {
  return fs.existsSync(path.join(root, relPath));
}

function hasAll(source, values) {
  return values.every((value) => source.includes(value));
}

function runNpm(args) {
  if (process.platform === 'win32') {
    const cmdline = `npm ${args.join(' ')}`;
    return spawnSync('cmd.exe', ['/d', '/s', '/c', cmdline], {
      cwd: root,
      encoding: 'utf8',
      stdio: 'pipe',
    });
  }
  return spawnSync('npm', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: 'pipe',
  });
}

function resultPayload(id, command, result) {
  const exitCode = typeof result.status === 'number' ? result.status : 1;
  return {
    id,
    command,
    exit_code: exitCode,
    pass: exitCode === 0,
    error: result.error ? String(result.error.message || result.error) : null,
    stdout_excerpt: String(result.stdout || '').split(/\r?\n/).slice(-25),
    stderr_excerpt: String(result.stderr || '').split(/\r?\n/).slice(-25),
  };
}

function run() {
  const checks = [];
  const commandRuns = [];

  const gatewayUiTestsRun = runNpm([
    '--prefix',
    'services/gateway-api',
    'run',
    'test',
    '--',
    'a2ui.e2e.test.js',
    'action-buttons.e2e.ts',
    'embeddable-widget.test.ts',
    '--runInBand',
  ]);
  commandRuns.push(resultPayload(
    'gateway_ui_runtime_tests_check',
    'npm --prefix services/gateway-api run test -- a2ui.e2e.test.js action-buttons.e2e.ts embeddable-widget.test.ts --runInBand',
    gatewayUiTestsRun,
  ));

  checks.push({
    id: 'gateway_ui_runtime_tests_pass',
    pass: commandRuns.find((runItem) => runItem.id === 'gateway_ui_runtime_tests_check')?.pass === true,
    detail: 'A2UI stream/action buttons/embeddable widget runtime tests pass',
  });

  const adminOverviewSource = readUtf8('apps/admin-ui/src/app/overview/page.tsx');
  const adminLayoutSource = readUtf8('apps/admin-ui/src/components/layout/AppShell.tsx');
  checks.push({
    id: 'admin_control_ui_surface_present',
    pass: hasAll(adminOverviewSource, ['PageHeader', 'StatCard', 'OverviewPage']) && hasAll(adminLayoutSource, ['Sidebar', 'Header', 'RuntimeBanner']),
    detail: 'admin control UI layout and overview runtime surface exist',
  });

  const canvasHomeSource = readUtf8('apps/canvas-ui/src/app/page.tsx');
  const canvasChatSource = readUtf8('apps/canvas-ui/src/app/c/[chatId]/page.tsx');
  checks.push({
    id: 'webchat_ui_surface_present',
    pass: hasAll(canvasHomeSource, ['Sven Conversations', 'handleCreateChat', 'premium-panel-strong']) && hasAll(canvasChatSource, ['EventSource', 'api.a2ui.', 'sanitizeA2uiHtml']),
    detail: 'webchat/canvas UI and live chat page surface are implemented',
  });

  checks.push({
    id: 'desktop_companion_surface_present',
    pass: exists('apps/companion-desktop-tauri/src-tauri/tauri.conf.json') && exists('apps/companion-desktop-tauri/src-tauri/icons/icon.ico'),
    detail: 'desktop companion (tauri config + icon assets) is present',
  });

  checks.push({
    id: 'mobile_companion_surface_present',
    pass:
      exists('apps/companion-user-flutter/android') &&
      exists('apps/companion-user-flutter/ios') &&
      exists('apps/companion-user-flutter/lib/features/auth/login_page.dart'),
    detail: 'mobile companion app source exists for Android+iOS with auth flow',
  });

  const canvasLayoutSource = readUtf8('apps/canvas-ui/src/app/layout.tsx');
  const pwaControlsSource = readUtf8('apps/canvas-ui/src/components/PwaControls.tsx');
  checks.push({
    id: 'pwa_surface_present',
    pass:
      exists('apps/canvas-ui/public/manifest.json') &&
      hasAll(canvasLayoutSource, ["manifest: '/manifest.json'", "icon-192.png", 'icon-512.png']) &&
      pwaControlsSource.includes('beforeinstallprompt'),
    detail: 'PWA manifest/icons/install controls are wired in canvas UI',
  });

  const a2uiApiSource = readUtf8('apps/canvas-ui/src/lib/api.ts');
  checks.push({
    id: 'live_canvas_a2ui_surface_present',
    pass: hasAll(a2uiApiSource, ['/a2ui/snapshot', '/a2ui/push', '/a2ui/reset', '/a2ui/eval', '/a2ui/interaction']),
    detail: 'live canvas A2UI API endpoints (snapshot/push/reset/eval/interaction) are present',
  });

  const adminThemeSource = readUtf8('apps/admin-ui/src/lib/store.ts');
  const canvasThemeSource = readUtf8('apps/canvas-ui/src/lib/store.ts');
  checks.push({
    id: 'dark_mode_surface_present',
    pass: hasAll(adminThemeSource, ['dark: false', "classList.toggle('dark'"]) && hasAll(canvasThemeSource, ['dark: true', "classList.toggle('dark'"]),
    detail: 'admin/canvas theme stores implement dark-mode toggling and persisted class application',
  });

  const status = checks.every((check) => check.pass) ? 'pass' : 'fail';
  const payload = {
    generated_at: new Date().toISOString(),
    status,
    mapped_openclaw_rows: ['7.1', '7.2', '7.3', '7.4', '7.5', '7.6', '7.7', '7.8'],
    checks,
    command_runs: commandRuns,
    source_files: [
      'services/gateway-api/src/__tests__/a2ui.e2e.test.js',
      'services/gateway-api/src/__tests__/action-buttons.e2e.ts',
      'services/gateway-api/src/__tests__/embeddable-widget.test.ts',
      'apps/admin-ui/src/app/overview/page.tsx',
      'apps/admin-ui/src/components/layout/AppShell.tsx',
      'apps/canvas-ui/src/app/page.tsx',
      'apps/canvas-ui/src/app/c/[chatId]/page.tsx',
      'apps/canvas-ui/src/lib/api.ts',
      'apps/canvas-ui/src/app/layout.tsx',
      'apps/canvas-ui/src/components/PwaControls.tsx',
      'apps/admin-ui/src/lib/store.ts',
      'apps/canvas-ui/src/lib/store.ts',
      'apps/companion-desktop-tauri/src-tauri/tauri.conf.json',
      'apps/companion-user-flutter/lib/features/auth/login_page.dart',
    ],
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# OpenClaw UI Runtime Check',
      '',
      `Generated: ${payload.generated_at}`,
      `Status: ${status}`,
      '',
      `Mapped OpenClaw rows: ${payload.mapped_openclaw_rows.join(', ')}`,
      '',
      '## Checks',
      ...checks.map((check) => `- [${check.pass ? 'x' : ' '}] ${check.id}: ${check.detail}`),
      '',
      '## Command Runs',
      ...commandRuns.map((runItem) => `- ${runItem.id}: exit_code=${runItem.exit_code} (\`${runItem.command}\`)`),
      '',
    ].join('\n'),
    'utf8',
  );

  console.log(`Wrote ${rel(outJson)}`);
  console.log(`Wrote ${rel(outMd)}`);
  console.log(`openclaw-ui-runtime-check: ${status}`);
  if (strict && status !== 'pass') {
    process.exit(2);
  }
}

run();

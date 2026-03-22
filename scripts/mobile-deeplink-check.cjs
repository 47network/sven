#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const strict = process.argv.includes('--strict');

function rel(p) { return path.relative(root, p).replace(/\\/g, '/'); }
function read(relPath) { return fs.readFileSync(path.join(root, relPath), 'utf8'); }

function resolveOnPath(commandName) {
  const lookup = process.platform === 'win32'
    ? spawnSync('where', [commandName], { encoding: 'utf8' })
    : spawnSync('which', ['-a', commandName], { encoding: 'utf8' });
  if (lookup.status !== 0) return [];
  const raw = String(lookup.stdout || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const normalized = [];
  const seen = new Set();
  for (const item of raw) {
    const key = process.platform === 'win32' ? item.toLowerCase() : item;
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(item);
  }
  return normalized;
}

function resolveFlutterExecutable() {
  const flutterCommand = process.platform === 'win32' ? 'flutter.bat' : 'flutter';
  const envFlutter = String(process.env.FLUTTER_BIN || '').trim();
  if (envFlutter) {
    if (envFlutter.includes(path.sep)) {
      if (!fs.existsSync(envFlutter)) {
        throw new Error(`FLUTTER_BIN is set but does not exist: ${envFlutter}`);
      }
      return {
        command: envFlutter,
        resolution_method: 'env_path',
        path_candidates: [envFlutter],
      };
    }
    const envMatches = resolveOnPath(envFlutter);
    if (envMatches.length > 1) {
      throw new Error(`FLUTTER_BIN resolved ambiguously on PATH (${envMatches.length} matches): ${envMatches.join(', ')}`);
    }
    if (envMatches.length === 1) {
      return {
        command: envMatches[0],
        resolution_method: 'env_command',
        path_candidates: envMatches,
      };
    }
    return {
      command: envFlutter,
      resolution_method: 'env_command_unresolved_path_probe',
      path_candidates: [],
    };
  }

  const projectFvmFlutter = path.join(
    root,
    'apps',
    'companion-user-flutter',
    '.fvm',
    'flutter_sdk',
    'bin',
    process.platform === 'win32' ? 'flutter.bat' : 'flutter',
  );
  if (fs.existsSync(projectFvmFlutter)) {
    return {
      command: projectFvmFlutter,
      resolution_method: 'project_fvm_sdk',
      path_candidates: [projectFvmFlutter],
    };
  }

  const pathMatches = resolveOnPath(flutterCommand);
  if (pathMatches.length > 1) {
    throw new Error(`Flutter command is ambiguous on PATH (${pathMatches.length} matches): ${pathMatches.join(', ')}`);
  }
  if (pathMatches.length === 1) {
    return {
      command: pathMatches[0],
      resolution_method: 'path_unique',
      path_candidates: pathMatches,
    };
  }
  return {
    command: flutterCommand,
    resolution_method: 'path_fallback_unresolved',
    path_candidates: [],
  };
}

function runFlutterTest() {
  let flutter;
  try {
    flutter = resolveFlutterExecutable();
  } catch (error) {
    return {
      resolution: {
        command: null,
        resolution_method: 'resolution_error',
        path_candidates: [],
        error: String(error && error.message ? error.message : error),
      },
      result: {
        status: 127,
        stdout: '',
        stderr: String(error && error.message ? error.message : error),
      },
    };
  }

  if (process.platform === 'win32') {
    return {
      resolution: flutter,
      result: spawnSync(
      flutter.command,
      ['test', 'test/deep_link_test.dart'],
      {
        cwd: path.join(root, 'apps', 'companion-user-flutter'),
        encoding: 'utf8',
        timeout: 240000,
        shell: true,
      },
    ) };
  }
  return {
    resolution: flutter,
    result: spawnSync(
    flutter.command,
    ['test', 'test/deep_link_test.dart'],
    {
      cwd: path.join(root, 'apps', 'companion-user-flutter'),
      encoding: 'utf8',
      timeout: 240000,
    },
  ) };
}

function run() {
  const androidManifest = 'apps/companion-user-flutter/android/app/src/main/AndroidManifest.xml';
  const iosInfoPlist = 'apps/companion-user-flutter/ios/Runner/Info.plist';
  const appEntrypoint = 'apps/companion-user-flutter/lib/app/sven_user_app.dart';
  const deepLinkParser = 'apps/companion-user-flutter/lib/app/deep_link.dart';

  const androidBody = read(androidManifest);
  const iosBody = read(iosInfoPlist);
  const appBody = read(appEntrypoint);
  const parserBody = read(deepLinkParser);

  const flutterTest = runFlutterTest();
  const testRun = flutterTest.result;
  const flutterTestPass = testRun.status === 0;

  const checks = [
    {
      id: 'android_custom_scheme_registered',
      pass: androidBody.includes('android:scheme="sven"'),
      detail: androidManifest,
    },
    {
      id: 'ios_custom_scheme_registered',
      pass: iosBody.includes('<key>CFBundleURLTypes</key>') && iosBody.includes('<string>sven</string>'),
      detail: iosInfoPlist,
    },
    {
      id: 'runtime_deep_link_listener_wired',
      pass: appBody.includes('AppLinks()') && appBody.includes('uriLinkStream.listen(_handleDeepLink)'),
      detail: appEntrypoint,
    },
    {
      id: 'deep_link_parser_supports_expected_routes',
      pass: parserBody.includes("segments.first == 'approvals'") && parserBody.includes("segments.first == 'chat'"),
      detail: deepLinkParser,
    },
    {
      id: 'deep_link_unit_test_passes',
      pass: flutterTestPass,
      detail: flutterTestPass ? 'flutter test test/deep_link_test.dart passed' : `exit=${testRun.status}; stderr=${(testRun.stderr || '').trim().slice(0, 400)}`,
    },
  ];

  const report = {
    generated_at: new Date().toISOString(),
    status: checks.some((c) => !c.pass) ? 'fail' : 'pass',
    checks,
    flutter_binary: flutterTest.resolution,
    flutter_test: {
      exit_code: testRun.status,
      stdout_tail: (testRun.stdout || '').trim().slice(-1200),
      stderr_tail: (testRun.stderr || '').trim().slice(-1200),
    },
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'mobile-deeplink-latest.json');
  const outMd = path.join(outDir, 'mobile-deeplink-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const md = [
    '# Mobile Deep Link Validation Check',
    '',
    `Generated: ${report.generated_at}`,
    `Status: ${report.status}`,
    '',
    '## Checks',
    ...checks.map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`),
    '',
  ];
  fs.writeFileSync(outMd, `${md.join('\n')}\n`, 'utf8');

  console.log(`Wrote ${rel(outJson)}`);
  console.log(`Wrote ${rel(outMd)}`);
  if (strict && report.status !== 'pass') process.exit(2);
}

run();

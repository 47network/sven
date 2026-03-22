#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const mobileDir = path.join(root, 'apps', 'companion-mobile');
const appJsonPath = path.join(mobileDir, 'app.json');
const gradlePropsPath = path.join(mobileDir, 'android', 'gradle.properties');
const outDir = path.join(root, 'docs', 'release', 'status');

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function check() {
  const appJson = JSON.parse(readText(appJsonPath));
  const gradleProps = readText(gradlePropsPath);

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  const expoCfg = appJson?.expo || {};
  add('expo_new_arch_enabled', expoCfg.newArchEnabled === true, `expo.newArchEnabled=${String(expoCfg.newArchEnabled)}`);
  add('android_js_engine_hermes', expoCfg?.android?.jsEngine === 'hermes', `android.jsEngine=${String(expoCfg?.android?.jsEngine)}`);
  add('ios_js_engine_hermes', expoCfg?.ios?.jsEngine === 'hermes', `ios.jsEngine=${String(expoCfg?.ios?.jsEngine)}`);

  const newArchProp = /(?:^|\n)\s*newArchEnabled\s*=\s*true\s*(?:\n|$)/.test(gradleProps);
  const hermesProp = /(?:^|\n)\s*hermesEnabled\s*=\s*true\s*(?:\n|$)/.test(gradleProps);
  add('gradle_new_arch_enabled', newArchProp, 'android/gradle.properties newArchEnabled=true');
  add('gradle_hermes_enabled', hermesProp, 'android/gradle.properties hermesEnabled=true');

  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.length - passed;
  const status = failed === 0 ? 'pass' : 'fail';
  const at = new Date().toISOString();

  const result = { at, status, passed, failed, checks };
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'mobile-newarch-release-check-latest.json'), JSON.stringify(result, null, 2) + '\n');

  const lines = [
    '# Mobile New Architecture Release Check',
    '',
    `- Time: ${at}`,
    `- Status: ${status}`,
    `- Passed: ${passed}`,
    `- Failed: ${failed}`,
    '',
    '## Checks',
    ...checks.map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`),
    '',
  ];
  fs.writeFileSync(path.join(outDir, 'mobile-newarch-release-check-latest.md'), lines.join('\n'));

  console.log(JSON.stringify(result, null, 2));
  if (failed > 0) process.exit(2);
}

check();

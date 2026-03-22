#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const outDir = path.join(root, 'docs', 'release', 'status');

function parseGradleApplicationId() {
  const gradlePath = path.join(root, 'apps', 'companion-user-flutter', 'android', 'app', 'build.gradle.kts');
  if (!fs.existsSync(gradlePath)) return { value: null, path: gradlePath };
  const body = fs.readFileSync(gradlePath, 'utf8');
  const match = body.match(/applicationId\s*=\s*"([^"]+)"/);
  return { value: match ? String(match[1]).trim() : null, path: gradlePath };
}

function parseWorkflow() {
  const workflowPath = path.join(root, '.github', 'workflows', 'flutter-user-release.yml');
  if (!fs.existsSync(workflowPath)) return { body: null, path: workflowPath };
  return { body: fs.readFileSync(workflowPath, 'utf8'), path: workflowPath };
}

function writeReport(report) {
  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'mobile-play-package-parity-latest.json');
  const outMd = path.join(outDir, 'mobile-play-package-parity-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# Mobile Play Package Parity Check',
      '',
      `Generated: ${report.generated_at}`,
      `Status: ${report.status}`,
      '',
      '## Checks',
      ...report.checks.map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`),
      '',
    ].join('\n'),
    'utf8',
  );
  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
}

function run() {
  const gradle = parseGradleApplicationId();
  const workflow = parseWorkflow();

  const workflowBody = workflow.body || '';
  const workflowUsesEnvPackage = /packageName:\s*\$\{\{\s*env\.ANDROID_PACKAGE_NAME\s*\}\}/.test(workflowBody);
  const hasGradleResolutionStep = /Resolve Android package ID from Gradle config/.test(workflowBody);
  const expectedPackageDefaultMatch = workflowBody.match(
    /EXPECTED_PACKAGE_ID="\$\{EXPECTED_ANDROID_PACKAGE_NAME:-([^"}]+)\}"/,
  );
  const expectedPackageDefault = expectedPackageDefaultMatch ? String(expectedPackageDefaultMatch[1]).trim() : null;

  const checks = [
    {
      id: 'android_gradle_application_id_parseable',
      pass: Boolean(gradle.value),
      detail: gradle.value ? `applicationId=${gradle.value}` : `failed to parse applicationId (${gradle.path})`,
    },
    {
      id: 'play_workflow_uses_resolved_env_package_name',
      pass: workflowUsesEnvPackage,
      detail: workflowUsesEnvPackage
        ? 'packageName uses ${{ env.ANDROID_PACKAGE_NAME }}'
        : `missing env packageName binding in ${workflow.path}`,
    },
    {
      id: 'play_workflow_has_gradle_package_resolution_step',
      pass: hasGradleResolutionStep,
      detail: hasGradleResolutionStep
        ? 'workflow resolves ANDROID_PACKAGE_NAME from Gradle config'
        : `missing Gradle package resolution step in ${workflow.path}`,
    },
    {
      id: 'play_workflow_expected_package_default_matches_gradle_application_id',
      pass: Boolean(expectedPackageDefault && gradle.value && expectedPackageDefault === gradle.value),
      detail: `expected_default=${expectedPackageDefault || 'missing'}; gradle=${gradle.value || 'missing'}`,
    },
  ];

  const status = checks.some((check) => !check.pass) ? 'fail' : 'pass';
  const report = {
    generated_at: new Date().toISOString(),
    status,
    checks,
    artifacts: {
      workflow: path.relative(root, workflow.path),
      gradle_config: path.relative(root, gradle.path),
      gradle_application_id: gradle.value,
      expected_package_default: expectedPackageDefault,
    },
  };

  writeReport(report);
  if (strict && status !== 'pass') process.exit(2);
}

run();


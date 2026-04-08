#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const strict = process.argv.includes('--strict');

function rel(p) {
  return path.relative(root, p).replace(/\\/g, '/');
}

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function hasServiceHealthcheck(composeSource, serviceName) {
  const match = composeSource.match(new RegExp(`\\n  ${serviceName}:\\n([\\s\\S]*?)(?=\\n  [a-z0-9][a-z0-9-]*:|$)`));
  if (!match) return false;
  return /\n    healthcheck:\n/.test(match[1]);
}

function run() {
  const vm5ComposePath = 'deploy/multi-vm/docker-compose.vm5-ai.yml';
  const vm7ComposePath = 'deploy/multi-vm/docker-compose.vm7-adapters.yml';
  const vm5Source = read(vm5ComposePath);
  const vm7Source = read(vm7ComposePath);

  const vm5ServicesRequiringHealthchecks = ['ollama', 'litellm', 'piper', 'wake-word'];
  const vm7ServicesRequiringHealthchecks = [
    'adapter-teams',
    'adapter-whatsapp',
    'adapter-webchat',
    'adapter-google-chat',
    'adapter-zalo',
    'adapter-feishu',
    'adapter-mattermost',
    'adapter-irc',
    'adapter-nostr',
    'adapter-twitch',
    'adapter-line',
    'adapter-voice-call',
    'adapter-tlon',
    'adapter-nextcloud-talk',
  ];

  const vm5Missing = vm5ServicesRequiringHealthchecks.filter((service) => !hasServiceHealthcheck(vm5Source, service));
  const vm7Missing = vm7ServicesRequiringHealthchecks.filter((service) => !hasServiceHealthcheck(vm7Source, service));
  const runbook = read('deploy/multi-vm/RUNBOOK.md');

  const checks = [
    {
      id: 'vm5_restart_services_have_healthchecks',
      pass: vm5Missing.length === 0,
      detail: vm5Missing.length ? vm5Missing.join(', ') : vm5ServicesRequiringHealthchecks.join(', '),
    },
    {
      id: 'vm7_restart_services_have_healthchecks',
      pass: vm7Missing.length === 0,
      detail: vm7Missing.length ? vm7Missing.join(', ') : vm7ServicesRequiringHealthchecks.join(', '),
    },
    {
      id: 'runbook_documents_waited_restart_sequence',
      pass:
        runbook.includes('docker-compose.vm5-ai.yml --env-file deploy/multi-vm/.env up -d --wait')
        && runbook.includes('docker-compose.vm7-adapters.yml --env-file deploy/multi-vm/.env --profile adapters --profile tunnel up -d --wait')
        && runbook.includes('release:multi-vm:restart:health:check'),
      detail: 'VM5/VM7 waited restart commands + repo regression check documented',
    },
  ];

  const status = checks.some((check) => !check.pass) ? 'fail' : 'pass';
  const report = {
    generated_at: new Date().toISOString(),
    status,
    strict_mode: strict,
    vm5_compose: vm5ComposePath,
    vm7_compose: vm7ComposePath,
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'multi-vm-restart-health-latest.json');
  const outMd = path.join(outDir, 'multi-vm-restart-health-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# Multi-VM Restart Health Check',
      '',
      `Generated: ${report.generated_at}`,
      `Status: ${report.status}`,
      '',
      '## Checks',
      ...checks.map((check) => `- [${check.pass ? 'x' : ' '}] ${check.id}: ${check.detail}`),
      '',
    ].join('\n'),
    'utf8',
  );

  console.log(`Wrote ${rel(outJson)}`);
  console.log(`Wrote ${rel(outMd)}`);
  if (strict && status !== 'pass') {
    process.exit(2);
  }
}

run();

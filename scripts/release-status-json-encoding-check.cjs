#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const statusDir = path.join(root, 'docs', 'release', 'status');
const outJson = path.join(statusDir, 'status-json-encoding-latest.json');
const outMd = path.join(statusDir, 'status-json-encoding-latest.md');

function check(id, pass, detail) {
  return { id, status: pass ? 'pass' : 'fail', detail };
}

function listJsonFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) {
    return out;
  }
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
        out.push(full);
      }
    }
  }
  return out.sort((a, b) => a.localeCompare(b));
}

function detectEncodingIssue(buf) {
  if (buf.length >= 2) {
    // UTF-16 LE BOM
    if (buf[0] === 0xff && buf[1] === 0xfe) {
      return 'utf16le_bom';
    }
    // UTF-16 BE BOM
    if (buf[0] === 0xfe && buf[1] === 0xff) {
      return 'utf16be_bom';
    }
  }
  if (buf.length >= 3) {
    // UTF-8 BOM
    if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
      return 'utf8_bom';
    }
  }
  return null;
}

function main() {
  const files = listJsonFiles(statusDir).filter((file) => {
    const base = path.basename(file).toLowerCase();
    return base !== 'status-json-encoding-latest.json';
  });

  const checks = [];
  const failures = [];
  let parseableCount = 0;

  checks.push(
    check(
      'status_json_files_present',
      files.length > 0,
      files.length > 0 ? `found=${files.length}` : 'no JSON files found under docs/release/status',
    ),
  );

  for (const file of files) {
    const rel = path.relative(root, file);
    let buf = null;
    try {
      buf = fs.readFileSync(file);
    } catch (error) {
      failures.push(`${rel}: read_error:${String(error && error.message ? error.message : error)}`);
      continue;
    }

    const encodingIssue = detectEncodingIssue(buf);
    if (encodingIssue) {
      failures.push(`${rel}: ${encodingIssue}`);
      continue;
    }

    try {
      const text = buf.toString('utf8');
      JSON.parse(text);
      parseableCount += 1;
    } catch (error) {
      failures.push(`${rel}: json_parse_error:${String(error && error.message ? error.message : error)}`);
    }
  }

  checks.push(
    check(
      'status_json_encoding_utf8_without_bom',
      failures.length === 0,
      failures.length === 0 ? `all ${parseableCount} files parse via direct JSON.parse(utf8)` : failures.join('; '),
    ),
  );

  const failed = checks.filter((item) => item.status !== 'pass');
  const status = {
    generated_at: new Date().toISOString(),
    status: failed.length === 0 ? 'pass' : 'fail',
    totals: {
      discovered_files: files.length,
      parseable_files: parseableCount,
      failed_files: failures.length,
    },
    failures,
    checks,
  };

  fs.mkdirSync(statusDir, { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(status, null, 2)}\n`, 'utf8');

  const lines = [
    '# Release Status JSON Encoding Check',
    '',
    `Status: ${status.status}`,
    `Generated: ${status.generated_at}`,
    '',
    '## Summary',
    '',
    `- discovered_files: ${status.totals.discovered_files}`,
    `- parseable_files: ${status.totals.parseable_files}`,
    `- failed_files: ${status.totals.failed_files}`,
    '',
    '## Checks',
    '',
    ...checks.map((item) => `- ${item.id}: ${item.status} (${item.detail})`),
    '',
  ];

  if (failures.length > 0) {
    lines.push('## Failing Files');
    lines.push('');
    for (const failure of failures) {
      lines.push(`- ${failure}`);
    }
    lines.push('');
  }

  fs.writeFileSync(outMd, `${lines.join('\n')}\n`, 'utf8');

  console.log(JSON.stringify(status, null, 2));
  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);

  if (strict && failed.length > 0) {
    process.exit(2);
  }
}

main();

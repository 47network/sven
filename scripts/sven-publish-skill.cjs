#!/usr/bin/env node
// ---------------------------------------------------------------------------
// sven-publish-skill.cjs
//
// Publish an existing skill as a paid API listing on market.sven.systems.
// Creates the marketplace listing and (optionally) flips it to 'published'.
//
// Usage:
//   node scripts/sven-publish-skill.cjs \
//     --skill ocr/receipt-scanner \
//     --org <orgId> \
//     --payout-account <treasuryAccountId> \
//     --price 0.05 --pricing per_call \
//     --endpoint https://api.sven.systems/v1/skills/ocr/receipt-scanner \
//     [--title "Receipt OCR"] [--description "..."] [--tags ocr,receipt] \
//     [--publish] [--api http://127.0.0.1:9478]
// ---------------------------------------------------------------------------

'use strict';

const fs = require('node:fs');
const path = require('node:path');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const nxt = argv[i + 1];
    if (nxt === undefined || nxt.startsWith('--')) { out[key] = true; continue; }
    out[key] = nxt; i++;
  }
  return out;
}

function readSkillManifest(relPath) {
  const repoRoot = path.resolve(__dirname, '..');
  const md = path.join(repoRoot, 'skills', relPath, 'SKILL.md');
  if (!fs.existsSync(md)) {
    throw new Error(`SKILL.md not found at skills/${relPath}/SKILL.md`);
  }
  const raw = fs.readFileSync(md, 'utf8');
  const m = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return { name: path.basename(relPath), description: '' };
  const front = m[1];
  const name = (front.match(/^name:\s*(.+)$/m) || [])[1]?.trim();
  const description = (front.match(/^description:\s*(.+)$/m) || [])[1]?.trim();
  return {
    name: name || path.basename(relPath),
    description: description || '',
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const required = ['skill', 'org', 'payout-account', 'price'];
  const missing = required.filter((k) => !args[k]);
  if (missing.length) {
    console.error(`Missing required args: ${missing.map((k) => '--' + k).join(', ')}`);
    process.exit(2);
  }

  const manifest = readSkillManifest(args.skill);
  const api = args.api || process.env.MARKETPLACE_API || 'http://127.0.0.1:9478';
  const price = Number(args.price);
  if (!Number.isFinite(price) || price < 0) {
    console.error('--price must be a non-negative number');
    process.exit(2);
  }

  const body = {
    orgId: args.org,
    sellerAgentId: args['seller-agent'] || null,
    title: args.title || manifest.name.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    description: args.description || manifest.description || `Programmatic access to the ${manifest.name} skill.`,
    kind: 'skill_api',
    pricingModel: args.pricing || 'per_call',
    unitPrice: price,
    currency: args.currency || 'USD',
    payoutAccountId: args['payout-account'],
    skillName: manifest.name,
    endpointUrl: args.endpoint || null,
    tags: typeof args.tags === 'string' ? args.tags.split(',').map((s) => s.trim()).filter(Boolean) : [],
    metadata: { skillPath: args.skill },
  };

  console.log(`→ Creating listing for skill ${args.skill} on ${api}`);
  const res = await fetch(`${api}/v1/market/listings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error('Create listing failed:', res.status, await res.text());
    process.exit(1);
  }
  const created = await res.json();
  const listing = created?.data?.listing;
  if (!listing) {
    console.error('Unexpected response:', created);
    process.exit(1);
  }
  console.log(`✓ Listing ${listing.id} (slug ${listing.slug}) created in status=${listing.status}`);

  if (args.publish) {
    const pub = await fetch(`${api}/v1/market/listings/${listing.id}/publish`, { method: 'POST' });
    if (!pub.ok) {
      console.error('Publish failed:', pub.status, await pub.text());
      process.exit(1);
    }
    const published = await pub.json();
    console.log(`✓ Published: ${published?.data?.listing?.status}`);
  }

  console.log(`\n🌐 https://market.sven.systems/listings/${listing.slug}`);
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});

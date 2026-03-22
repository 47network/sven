#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

const root = process.cwd();
const baselineDefault = path.join("config", "release", "worktree-lane-baseline.local.json");
const outDir = path.join("docs", "release", "status");
const outJson = path.join(outDir, "worktree-lane-hygiene-latest.json");
const outMd = path.join(outDir, "worktree-lane-hygiene-latest.md");

function toPosix(p) {
  return String(p || "").replace(/\\/g, "/");
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function parseArgs(argv) {
  const args = {
    strict: false,
    initBaseline: false,
    baselinePath: baselineDefault,
    allowPrefixes: [],
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--strict") {
      args.strict = true;
      continue;
    }
    if (token === "--init-baseline") {
      args.initBaseline = true;
      continue;
    }
    if (token === "--baseline") {
      args.baselinePath = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === "--allow") {
      args.allowPrefixes.push(toPosix(argv[i + 1] || ""));
      i += 1;
      continue;
    }
  }
  const fromEnv = (process.env.WORKTREE_LANE_ALLOW || "")
    .split(",")
    .map((s) => toPosix(s.trim()))
    .filter(Boolean);
  args.allowPrefixes = [...new Set([...args.allowPrefixes, ...fromEnv])];
  return args;
}

function safeStat(filePath) {
  try {
    return fs.lstatSync(filePath);
  } catch {
    return null;
  }
}

function fileFingerprint(absPath) {
  const st = safeStat(absPath);
  if (!st) return "deleted";
  if (st.isDirectory()) return "dir";
  if (st.isSymbolicLink()) {
    try {
      return `symlink:${fs.readlinkSync(absPath)}`;
    } catch {
      return "symlink:unreadable";
    }
  }
  const hash = crypto.createHash("sha256");
  const content = fs.readFileSync(absPath);
  hash.update(content);
  return `sha256:${hash.digest("hex")}`;
}

function readGitPorcelain() {
  const out = execFileSync(
    "git",
    ["status", "--porcelain=v1", "-z", "--untracked-files=all"],
    { cwd: root, encoding: "utf8" },
  );
  const parts = out.split("\0").filter(Boolean);
  const entries = [];

  for (let i = 0; i < parts.length; i += 1) {
    const row = parts[i];
    const xy = row.slice(0, 2);
    const sourcePath = row.slice(3);
    let finalPath = sourcePath;
    let oldPath = null;
    const isRenameLike = xy[0] === "R" || xy[0] === "C" || xy[1] === "R" || xy[1] === "C";
    if (isRenameLike) {
      oldPath = sourcePath;
      finalPath = parts[i + 1] || sourcePath;
      i += 1;
    }

    const rel = toPosix(finalPath);
    const abs = path.join(root, finalPath);
    entries.push({
      path: rel,
      xy,
      old_path: oldPath ? toPosix(oldPath) : null,
      fingerprint: fileFingerprint(abs),
    });
  }
  return entries.sort((a, b) => a.path.localeCompare(b.path));
}

function toMap(entries) {
  const m = new Map();
  for (const e of entries) m.set(e.path, e);
  return m;
}

function loadBaseline(relPath) {
  const abs = path.resolve(root, relPath);
  if (!fs.existsSync(abs)) return null;
  const parsed = JSON.parse(fs.readFileSync(abs, "utf8"));
  const entries = Array.isArray(parsed.entries) ? parsed.entries : [];
  return {
    abs,
    parsed,
    entries,
    map: toMap(entries),
  };
}

function inAllowedLane(relPath, prefixes) {
  if (!prefixes || prefixes.length === 0) return false;
  const p = toPosix(relPath);
  return prefixes.some((prefix) => {
    const normalized = toPosix(prefix).replace(/\/+$/, "");
    return p === normalized || p.startsWith(`${normalized}/`);
  });
}

function diffAgainstBaseline(currentEntries, baselineEntries) {
  const current = toMap(currentEntries);
  const base = toMap(baselineEntries);

  const newPaths = [];
  const removedPaths = [];
  const changedPaths = [];

  for (const [p, cur] of current.entries()) {
    const old = base.get(p);
    if (!old) {
      newPaths.push(cur);
      continue;
    }
    if (old.xy !== cur.xy || old.fingerprint !== cur.fingerprint || old.old_path !== cur.old_path) {
      changedPaths.push({ before: old, after: cur });
    }
  }
  for (const [p, old] of base.entries()) {
    if (!current.has(p)) removedPaths.push(old);
  }

  return { newPaths, removedPaths, changedPaths };
}

function summarizeByTop(entries) {
  const counts = {};
  for (const e of entries) {
    const key = e.path.includes("/") ? e.path.split("/")[0] : e.path;
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]));
}

function writeJson(relPath, data) {
  const abs = path.resolve(root, relPath);
  ensureDir(path.dirname(abs));
  fs.writeFileSync(abs, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function writeMarkdown(report) {
  ensureDir(path.join(root, outDir));
  const lines = [
    "# Worktree Lane Hygiene",
    "",
    `- Generated at: ${report.generated_at}`,
    `- Baseline file: \`${report.baseline.file}\``,
    `- Baseline exists: ${report.baseline.exists ? "yes" : "no"}`,
    `- Current dirty entries: ${report.current.total}`,
    `- Lane allow prefixes: ${report.allow_prefixes.length > 0 ? report.allow_prefixes.map((v) => `\`${v}\``).join(", ") : "(none)"}`,
    `- Status: **${report.status}**`,
    "",
    "## Delta vs Baseline",
    "",
    `- New paths: ${report.delta.new_paths}`,
    `- Changed baseline paths: ${report.delta.changed_paths}`,
    `- Removed baseline paths: ${report.delta.removed_paths}`,
    `- Outside-lane delta count: ${report.delta.outside_lane_total}`,
    "",
    "## Outside-Lane Delta",
    "",
  ];
  if (report.delta.outside_lane_examples.length === 0) {
    lines.push("- none");
  } else {
    for (const item of report.delta.outside_lane_examples) {
      lines.push(`- \`${item.kind}\` \`${item.path}\``);
    }
  }
  lines.push("", "## Current Top-Level Dirty Summary", "");
  for (const [k, v] of Object.entries(report.current.by_top_level)) {
    lines.push(`- \`${k}\`: ${v}`);
  }
  lines.push("");
  fs.writeFileSync(path.join(root, outMd), lines.join("\n"), "utf8");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const baselinePath = toPosix(args.baselinePath);
  const currentEntries = readGitPorcelain();
  const baselineAbs = path.resolve(root, baselinePath);

  if (args.initBaseline) {
    const payload = {
      schema_version: 1,
      generated_at: new Date().toISOString(),
      note: "Local baseline for pre-existing dirty worktree isolation. Safe to regenerate intentionally.",
      entries: currentEntries,
    };
    writeJson(baselinePath, payload);
    const message = {
      status: "pass",
      action: "baseline_initialized",
      baseline_file: toPosix(path.relative(root, baselineAbs)),
      entry_count: currentEntries.length,
    };
    console.log(JSON.stringify(message, null, 2));
    return;
  }

  const baseline = loadBaseline(baselinePath);
  let status = "pass";
  let outsideLane = [];
  let delta = {
    newPaths: [],
    removedPaths: [],
    changedPaths: [],
  };

  if (!baseline) {
    status = args.strict ? "fail" : "warn";
  } else {
    delta = diffAgainstBaseline(currentEntries, baseline.entries);
    outsideLane = [
      ...delta.newPaths.map((e) => ({ kind: "new", path: e.path })),
      ...delta.changedPaths.map((e) => ({ kind: "changed", path: e.after.path })),
      ...delta.removedPaths.map((e) => ({ kind: "removed", path: e.path })),
    ].filter((item) => !inAllowedLane(item.path, args.allowPrefixes));

    if (outsideLane.length > 0) status = args.strict ? "fail" : "warn";
  }

  const report = {
    status,
    generated_at: new Date().toISOString(),
    baseline: {
      file: baselinePath,
      exists: Boolean(baseline),
      entry_count: baseline ? baseline.entries.length : 0,
    },
    allow_prefixes: args.allowPrefixes,
    current: {
      total: currentEntries.length,
      by_top_level: summarizeByTop(currentEntries),
    },
    delta: {
      new_paths: delta.newPaths.length,
      changed_paths: delta.changedPaths.length,
      removed_paths: delta.removedPaths.length,
      outside_lane_total: outsideLane.length,
      outside_lane_examples: outsideLane.slice(0, 50),
    },
    guidance: baseline
      ? [
          "If this lane intentionally edits additional paths, rerun with --allow <prefix> for those paths.",
          "If the pre-existing dirty set changed intentionally, refresh the baseline with --init-baseline.",
        ]
      : [
          "Initialize baseline once: npm run repo:worktree:lane:baseline",
          "Then run strict checks with lane allow prefixes: npm run repo:worktree:lane:check -- --allow docs --allow scripts",
        ],
  };

  writeJson(outJson, report);
  writeMarkdown(report);
  console.log(JSON.stringify(report, null, 2));

  if (args.strict && status === "fail") process.exit(1);
}

main();

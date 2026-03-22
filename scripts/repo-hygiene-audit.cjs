#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const root = process.cwd();

const requiredFiles = [
  "README.md",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "SUPPORT.md",
  "LICENSE",
  "RELEASE.md",
  "MAINTAINERS.md",
  ".editorconfig",
  ".gitattributes",
  ".gitignore",
  ".github/CODEOWNERS",
  ".github/pull_request_template.md",
  ".github/ISSUE_TEMPLATE/bug_report.yml",
  ".github/ISSUE_TEMPLATE/feature_request.yml",
  ".github/release.yml",
  "docs/README.md",
  "docs/CURRENT_FEATURES_AND_SETUP.md",
];

const allowedRootMarkdown = new Set([
  "README.md",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "SUPPORT.md",
  "CODE_OF_CONDUCT.md",
  "RELEASE.md",
  "MAINTAINERS.md",
]);

const rootClutterPatterns = [
  /^.*\.png$/i,
  /^.*\.jpe?g$/i,
  /^.*\.xml$/i,
  /^device_.*\.txt$/i,
];

function exists(relPath) {
  return fs.existsSync(path.join(root, relPath));
}

function auditRequiredFiles() {
  const missing = requiredFiles.filter((f) => !exists(f));
  return { missing };
}

function auditRootClutter() {
  const entries = fs.readdirSync(root, { withFileTypes: true });
  const files = entries.filter((e) => e.isFile()).map((e) => e.name);
  return files.filter((name) => rootClutterPatterns.some((rx) => rx.test(name)));
}

function auditTopLevelTempDirs() {
  const tempDirNames = [".tmp", ".tmp_run_artifacts", "test-results", "playwright-report"];
  return tempDirNames.filter((d) => exists(d));
}

function auditRootMarkdownDrift() {
  const entries = fs.readdirSync(root, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".md"))
    .map((e) => e.name)
    .filter((name) => !allowedRootMarkdown.has(name));
}

function main() {
  const required = auditRequiredFiles();
  const clutterFiles = auditRootClutter();
  const tempDirs = auditTopLevelTempDirs();
  const rootMarkdownDrift = auditRootMarkdownDrift();

  const findings = [];
  if (required.missing.length > 0) {
    findings.push({
      id: "required_files_missing",
      severity: "high",
      details: required.missing,
    });
  }
  if (clutterFiles.length > 0) {
    findings.push({
      id: "root_clutter_files_present",
      severity: "medium",
      details: clutterFiles,
    });
  }
  if (tempDirs.length > 0) {
    findings.push({
      id: "top_level_temp_dirs_present",
      severity: "low",
      details: tempDirs,
    });
  }
  if (rootMarkdownDrift.length > 0) {
    findings.push({
      id: "root_markdown_drift_present",
      severity: "medium",
      details: rootMarkdownDrift,
    });
  }

  const status = findings.length === 0 ? "pass" : "warn";
  const output = {
    status,
    generated_at: new Date().toISOString(),
    findings,
  };

  console.log(JSON.stringify(output, null, 2));
  process.exit(0);
}

main();

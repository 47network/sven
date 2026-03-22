#!/usr/bin/env node
/* eslint-disable no-console */
const { writeFileSync, readFileSync, mkdirSync } = require('node:fs');
const { dirname } = require('node:path');

const mode = process.argv[2] || '';
const API_URL = process.env.API_URL || 'http://localhost:3000';
const COOKIE = process.env.F3_POLICY_COOKIE || process.env.COOKIE || process.env.SVEN_SESSION_COOKIE || '';
const STATE_FILE =
  process.env.F3_POLICY_STATE_FILE ||
  'docs/release/status/f3-invalid-policy-state.json';
const SIM_TOOL = process.env.F3_POLICY_SIM_TOOL || 'search.web';
const SIM_ACTION = process.env.F3_POLICY_SIM_ACTION || 'query';

function writeState(data) {
  mkdirSync(dirname(STATE_FILE), { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function readState() {
  return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
}

function requireCookie() {
  if (!COOKIE) {
    throw new Error('Missing F3_POLICY_COOKIE/COOKIE/SVEN_SESSION_COOKIE');
  }
}

async function admin(method, path, body) {
  const res = await fetch(`${API_URL}/v1/admin${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Cookie: COOKIE,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  return { status: res.status, data };
}

async function induce() {
  requireCookie();
  const scope = `${SIM_TOOL}.${SIM_ACTION}`;
  const created = await admin('POST', '/permissions', {
    scope,
    effect: 'deny',
    target_type: 'global',
  });
  if (created.status !== 201 || created.data?.success !== true) {
    throw new Error(`Failed to inject deny policy. HTTP ${created.status} body=${JSON.stringify(created.data)}`);
  }
  const id = String(created.data?.data?.id || '');
  if (!id) {
    throw new Error('Injected policy permission id missing');
  }
  writeState({
    created_at: new Date().toISOString(),
    permission_id: id,
    scope,
    sim_tool: SIM_TOOL,
    sim_action: SIM_ACTION,
  });
  console.log(`f3-invalid-policy: injected deny rule ${id} for scope ${scope}`);
}

async function verifyDegraded() {
  requireCookie();
  const state = readState();
  const sim = await admin('POST', '/policy/simulate', {
    tool_name: state.sim_tool || SIM_TOOL,
    action: state.sim_action || SIM_ACTION,
    context: {},
  });
  if (sim.status !== 200 || sim.data?.success !== true) {
    throw new Error(`Policy simulate failed. HTTP ${sim.status} body=${JSON.stringify(sim.data)}`);
  }
  const matched = Array.isArray(sim.data?.data?.matched_rules) ? sim.data.data.matched_rules : [];
  const hasInjected = matched.some((r) => String(r.id || '') === String(state.permission_id || ''));
  const allowed = Boolean(sim.data?.data?.allowed);
  if (!hasInjected || allowed) {
    throw new Error(`Expected injected deny rule to block policy. allowed=${allowed} matched=${JSON.stringify(matched)}`);
  }
  console.log('f3-invalid-policy: degraded detection passed (invalid deny policy active)');
}

async function recover() {
  requireCookie();
  const state = readState();
  const id = String(state.permission_id || '');
  if (!id) throw new Error('Missing permission_id in state file');
  const del = await admin('DELETE', `/permissions/${encodeURIComponent(id)}`);
  if (del.status !== 200 || del.data?.success !== true) {
    throw new Error(`Failed to remove injected deny policy. HTTP ${del.status} body=${JSON.stringify(del.data)}`);
  }
  writeState({
    ...state,
    recovered_at: new Date().toISOString(),
    removed: true,
  });
  console.log(`f3-invalid-policy: removed deny rule ${id}`);
}

async function verifyRecovered() {
  requireCookie();
  const state = readState();
  const sim = await admin('POST', '/policy/simulate', {
    tool_name: state.sim_tool || SIM_TOOL,
    action: state.sim_action || SIM_ACTION,
    context: {},
  });
  if (sim.status !== 200 || sim.data?.success !== true) {
    throw new Error(`Policy simulate failed after recovery. HTTP ${sim.status} body=${JSON.stringify(sim.data)}`);
  }
  const matched = Array.isArray(sim.data?.data?.matched_rules) ? sim.data.data.matched_rules : [];
  const hasInjected = matched.some((r) => String(r.id || '') === String(state.permission_id || ''));
  if (hasInjected) {
    throw new Error(`Injected deny rule still present after recovery. matched=${JSON.stringify(matched)}`);
  }
  console.log('f3-invalid-policy: recovery verification passed (injected invalid policy removed)');
}

async function main() {
  if (mode === 'induce') return induce();
  if (mode === 'verify-degraded') return verifyDegraded();
  if (mode === 'recover') return recover();
  if (mode === 'verify-recovered') return verifyRecovered();
  throw new Error('Usage: node scripts/failure-mode/f3-invalid-policy-configuration.cjs <induce|verify-degraded|recover|verify-recovered>');
}

main().catch((err) => {
  console.error('f3-invalid-policy failed:', err);
  process.exit(1);
});


#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { loadCombinedServerSpec } = require('./load_server_specs');

const root = process.cwd();
const specPath = process.argv[2] || path.join(root, 'SERVER_SPEC.json');
const spec = process.argv[2] ? JSON.parse(fs.readFileSync(specPath, 'utf8')) : loadCombinedServerSpec();
const errors = [];
const warnings = [];
const fail = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

function has(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj || {}, key);
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function oneOf(value, allowed, label) {
  if (!allowed.includes(value)) fail(`${label} ${value} not in allowed set ${allowed.join(',')}`);
}

if (spec.spec_mode !== 'canonical_structured_spec_not_progress_log') fail('spec_mode must mark SERVER_SPEC.json as structured spec, not progress log');
if (!has(spec, 'developer_tooling_policy')) fail('developer_tooling_policy missing');
if (!has(spec, 'auth_port_policy')) fail('auth_port_policy missing');
if (!has(spec, 'fixture_validation_plan')) fail('fixture_validation_plan missing');
if (!has(spec, 'fixture_validation_matrix')) fail('fixture_validation_matrix missing');
if (!has(spec, 'fixture_suite')) fail('fixture_suite missing');
if (!Array.isArray(spec?.fixture_suite?.fixtures)) fail('fixture_suite.fixtures must be an array');

const planFields = list(spec?.fixture_validation_plan?.required_fields);
const required = planFields.length ? planFields : ['id', 'surface', 'principal', 'profile', 'domain', 'risk', 'res', 'op', 'decision', 'code', 'rule'];
const matrix = spec.fixture_validation_matrix || {};
const allowed = matrix.allowed_values || {};
const byId = matrix.expected_by_fixture_id || {};
const codeRules = matrix.reason_code_rules || {};
const ruleConstraints = matrix.rule_constraints || {};
const fixtures = Array.isArray(spec?.fixture_suite?.fixtures) ? spec.fixture_suite.fixtures : [];
const ids = new Set();
const observedCodes = new Set();
const observedRules = new Set();

for (const f of fixtures) {
  for (const k of required) if (!has(f, k) || f[k] === '') fail(`fixture ${f.id || '<missing id>'} missing ${k}`);
  if (ids.has(f.id)) fail(`duplicate fixture id ${f.id}`);
  ids.add(f.id);
  observedCodes.add(f.code);
  observedRules.add(f.rule);

  for (const [field, allowedSet] of Object.entries(allowed)) {
    if (has(f, field)) oneOf(f[field], allowedSet, `fixture ${f.id} field ${field}`);
  }

  if (!byId[f.id]) fail(`fixture ${f.id} missing expected_by_fixture_id matrix entry`);
  if (byId[f.id]) {
    for (const [k, v] of Object.entries(byId[f.id])) {
      if (f[k] !== v) fail(`fixture ${f.id} ${k}=${f[k]} does not match matrix ${v}`);
    }
  }

  if (!codeRules[f.code]) fail(`reason code ${f.code} missing reason_code_rules entry`);
  if (codeRules[f.code] && !codeRules[f.code].includes(f.rule)) {
    fail(`fixture ${f.id} code ${f.code} cannot use rule ${f.rule}`);
  }

  if (!ruleConstraints[f.rule]) fail(`rule ${f.rule} missing rule_constraints entry`);
  const rc = ruleConstraints[f.rule];
  if (rc) {
    for (const k of ['decision', 'domain', 'risk', 'res', 'op']) {
      if (Array.isArray(rc[k]) && rc[k].length && !rc[k].includes(f[k])) {
        fail(`fixture ${f.id} field ${k}=${f[k]} violates rule ${f.rule} constraint ${rc[k].join(',')}`);
      }
    }
  }
}

const requiredIds = list(matrix.required_fixture_ids);
for (const id of requiredIds) if (!ids.has(id)) fail(`required fixture missing ${id}`);
for (const id of Object.keys(byId)) if (!ids.has(id)) fail(`matrix contains expected fixture id not present in suite: ${id}`);

if (spec?.auth_port_policy?.default_ports?.none !== 3009) fail('auth_port_policy.default_ports.none must be 3009');
if (spec?.runtime_boundary?.runtime_behavior_changed !== false) fail('runtime_boundary.runtime_behavior_changed must be false');
if (spec?.developer_tooling_policy?.approval_required_for && !String(spec.developer_tooling_policy.approval_required_for).includes('server runtime')) warn('developer_tooling_policy approval boundary should mention server runtime');

const result = {
  ok: errors.length === 0,
  spec_path: specPath,
  fixture_count: fixtures.length,
  reason_code_count: observedCodes.size,
  rule_count: observedRules.size,
  matrix_fixture_count: Object.keys(byId).length,
  checked_required_fields: required,
  matrix_enforced: true,
  errors,
  warnings
};
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);

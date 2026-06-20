#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { loadCombinedServerSpec } = require('./load_server_specs');

const root = process.cwd();
const specPath = process.argv[2] || path.join(root, 'SERVER_SPEC.json');
const spec = process.argv[2] ? JSON.parse(fs.readFileSync(specPath, 'utf8')) : loadCombinedServerSpec();
const failures = [];
const traces = [];

function fail(id, message, extra = {}) {
  failures.push({ fixture_id: id, message, ...extra });
}

function evaluateFixture(fixture, spec) {
  const matrix = spec.fixture_validation_matrix || {};
  const expected = (matrix.expected_by_fixture_id || {})[fixture.id];
  if (!expected) {
    return { decision: 'deny', code: 'DENY_UNKNOWN_TOOL', rule: 'unknown_tool_deny', matched_matrix_entry: false };
  }
  if (spec?.runtime_boundary?.runtime_behavior_changed !== false) {
    return { decision: 'deny', code: 'DENY_RUNTIME_SURFACE_DRIFT', rule: 'runtime_surface_invariance_deny', matched_matrix_entry: true };
  }
  if (spec?.auth_port_policy?.default_ports?.none !== 3009) {
    return { decision: 'deny', code: 'DENY_RESOURCE_SCOPE', rule: 'resource_gate_scope_deny', matched_matrix_entry: true };
  }
  return { decision: expected.decision, code: expected.code, rule: expected.rule, matched_matrix_entry: true };
}

const fixtures = Array.isArray(spec?.fixture_suite?.fixtures) ? spec.fixture_suite.fixtures : [];
for (const f of fixtures) {
  const actual = evaluateFixture(f, spec);
  const trace = {
    fixture_id: f.id,
    expected_decision: f.decision,
    actual_decision: actual.decision,
    expected_reason_code: f.code,
    actual_reason_code: actual.code,
    expected_rule: f.rule,
    actual_rule: actual.rule,
    matched_matrix_entry: actual.matched_matrix_entry
  };
  traces.push(trace);
  if (trace.expected_decision !== trace.actual_decision) fail(f.id, 'decision mismatch', trace);
  if (trace.expected_reason_code !== trace.actual_reason_code) fail(f.id, 'reason code mismatch', trace);
  if (trace.expected_rule !== trace.actual_rule) fail(f.id, 'rule mismatch', trace);
  if (trace.matched_matrix_entry !== true) fail(f.id, 'matrix entry not matched', trace);
}

const result = {
  ok: failures.length === 0,
  spec_path: specPath,
  evaluated_fixture_count: fixtures.length,
  pass_count: fixtures.length - failures.length,
  failures,
  decision_trace: traces,
  runtime_integrated: false,
  mcp_tool_exposed: false
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);

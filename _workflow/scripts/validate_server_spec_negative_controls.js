#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadCombinedServerSpec } = require('./load_server_specs');
const { spawnSync } = require('child_process');

const root = process.cwd();
const specPath = process.argv[2] || path.join(root, 'SERVER_SPEC.json');
const validator = path.join(root, '_workflow', 'scripts', 'validate_server_spec_fixtures.js');
const base = process.argv[2] ? JSON.parse(fs.readFileSync(specPath, 'utf8')) : loadCombinedServerSpec();
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-spec-neg-'));
const controls = [
  {
    id: 'bad_decision_value',
    mutate(spec) { spec.fixture_suite.fixtures[0].decision = 'maybe'; },
    expect: 'field decision'
  },
  {
    id: 'bad_reason_rule_mapping',
    mutate(spec) { spec.fixture_suite.fixtures[0].code = 'DENY_PROCESS_EXECUTION'; },
    expect: 'does not match matrix'
  },
  {
    id: 'bad_rule_constraint',
    mutate(spec) { spec.fixture_suite.fixtures.find(f => f.id === 'process_execute_deny').op = 'read'; },
    expect: 'does not match matrix'
  },
  {
    id: 'missing_matrix_entry',
    mutate(spec) { delete spec.fixture_validation_matrix.expected_by_fixture_id[spec.fixture_suite.fixtures[0].id]; },
    expect: 'missing expected_by_fixture_id'
  },
  {
    id: 'extra_matrix_entry',
    mutate(spec) { spec.fixture_validation_matrix.expected_by_fixture_id.__ghost = { decision: 'deny' }; },
    expect: 'not present in suite'
  },
  {
    id: 'bad_auth_port',
    mutate(spec) { spec.auth_port_policy.default_ports.none = 3010; },
    expect: 'default_ports.none'
  },
  {
    id: 'runtime_boundary_true',
    mutate(spec) { spec.runtime_boundary.runtime_behavior_changed = true; },
    expect: 'runtime_boundary.runtime_behavior_changed'
  }
];

const results = [];
try {
  for (const c of controls) {
    const spec = JSON.parse(JSON.stringify(base));
    c.mutate(spec);
    const file = path.join(tmpRoot, `${c.id}.json`);
    fs.writeFileSync(file, JSON.stringify(spec, null, 2) + '\n');
    const run = spawnSync(process.execPath, [validator, file], { cwd: root, encoding: 'utf8' });
    const output = `${run.stdout || ''}\n${run.stderr || ''}`;
    const failed = run.status !== 0;
    const matched = output.includes(c.expect);
    results.push({ id: c.id, failed, matched, expect: c.expect });
    if (!failed) throw new Error(`negative control ${c.id} unexpectedly passed`);
    if (!matched) throw new Error(`negative control ${c.id} failed but did not expose expected marker ${c.expect}`);
  }
  const summary = { ok: true, negative_control_count: results.length, results };
  console.log(JSON.stringify(summary, null, 2));
} finally {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
}

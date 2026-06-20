#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadCombinedServerSpec } = require('./load_server_specs');
const { spawnSync } = require('child_process');

const root = process.cwd();
const specPath = process.argv[2] || path.join(root, 'SERVER_SPEC.json');
const evaluator = path.join(root, '_workflow', 'scripts', 'evaluate_server_spec_decisions.js');
const base = process.argv[2] ? JSON.parse(fs.readFileSync(specPath, 'utf8')) : loadCombinedServerSpec();
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-decision-neg-'));

const controls = [
  {
    id: 'fixture_decision_mismatch',
    mutate(spec) { spec.fixture_suite.fixtures[0].decision = spec.fixture_suite.fixtures[0].decision === 'allow' ? 'deny' : 'allow'; },
    expect: 'decision mismatch'
  },
  {
    id: 'fixture_reason_code_mismatch',
    mutate(spec) { spec.fixture_suite.fixtures[0].code = 'DENY_UNKNOWN_TOOL'; },
    expect: 'reason code mismatch'
  },
  {
    id: 'fixture_rule_mismatch',
    mutate(spec) { spec.fixture_suite.fixtures[0].rule = 'default_deny'; },
    expect: 'rule mismatch'
  },
  {
    id: 'missing_matrix_entry',
    mutate(spec) { delete spec.fixture_validation_matrix.expected_by_fixture_id[spec.fixture_suite.fixtures[0].id]; },
    expect: 'matrix entry not matched'
  },
  {
    id: 'matrix_decision_mismatch',
    mutate(spec) { const f = spec.fixture_suite.fixtures[0]; spec.fixture_validation_matrix.expected_by_fixture_id[f.id].decision = f.decision === 'allow' ? 'deny' : 'allow'; },
    expect: 'decision mismatch'
  },
  {
    id: 'matrix_reason_code_mismatch',
    mutate(spec) { const f = spec.fixture_suite.fixtures[0]; spec.fixture_validation_matrix.expected_by_fixture_id[f.id].code = 'DENY_UNKNOWN_TOOL'; },
    expect: 'reason code mismatch'
  },
  {
    id: 'runtime_boundary_violation',
    mutate(spec) { spec.runtime_boundary.runtime_behavior_changed = true; },
    expect: 'reason code mismatch'
  },
  {
    id: 'auth_port_policy_violation',
    mutate(spec) { spec.auth_port_policy.default_ports.none = 3010; },
    expect: 'reason code mismatch'
  }
];

const results = [];
try {
  for (const control of controls) {
    const spec = JSON.parse(JSON.stringify(base));
    control.mutate(spec);
    const file = path.join(tmpRoot, `${control.id}.json`);
    fs.writeFileSync(file, JSON.stringify(spec, null, 2) + '\n');
    const run = spawnSync(process.execPath, [evaluator, file], { cwd: root, encoding: 'utf8' });
    const output = `${run.stdout || ''}\n${run.stderr || ''}`;
    const failed = run.status !== 0;
    const matched = output.includes(control.expect);
    results.push({ id: control.id, failed, matched, expect: control.expect });
    if (!failed) throw new Error(`negative control ${control.id} unexpectedly passed`);
    if (!matched) throw new Error(`negative control ${control.id} failed without expected marker ${control.expect}`);
  }
  console.log(JSON.stringify({ ok: true, negative_control_count: results.length, results }, null, 2));
} finally {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
}

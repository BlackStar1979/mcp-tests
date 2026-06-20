#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadCombinedServerSpec } = require('./load_server_specs');
const { spawnSync } = require('child_process');

const root = process.cwd();
const specPath = process.argv[2] || path.join(root, 'SERVER_SPEC.json');
const validator = path.join(root, '_workflow', 'scripts', 'validate_decision_runtime_interface_contract.js');
const base = process.argv[2] ? JSON.parse(fs.readFileSync(specPath, 'utf8')) : loadCombinedServerSpec();
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-runtime-iface-neg-'));

const controls = [
  {
    id: 'missing_contract_object',
    mutate(spec) { delete spec.decision_runtime_interface_contract; },
    expect: 'decision_runtime_interface_contract must be an object'
  },
  {
    id: 'bad_contract_status',
    mutate(spec) { spec.decision_runtime_interface_contract.status = 'runtime_implemented'; },
    expect: 'decision_runtime_interface_contract.status must be'
  },
  {
    id: 'bad_contract_mode',
    mutate(spec) { spec.decision_runtime_interface_contract.mode = 'runtime_enforced'; },
    expect: 'decision_runtime_interface_contract.mode must be'
  },
  {
    id: 'runtime_implementation_ready_true',
    mutate(spec) { spec.decision_runtime_interface_contract.runtime_implementation_ready = true; },
    expect: 'decision_runtime_interface_contract.runtime_implementation_ready must be false'
  },
  {
    id: 'server_runtime_integrated_true',
    mutate(spec) { spec.decision_runtime_interface_contract.server_runtime_integrated = true; },
    expect: 'decision_runtime_interface_contract.server_runtime_integrated must be false'
  },
  {
    id: 'input_required_field_removed',
    mutate(spec) {
      spec.decision_runtime_interface_contract.input_contract.required_fields = spec.decision_runtime_interface_contract.input_contract.required_fields.filter((field) => field !== 'policy_version');
    },
    expect: 'missing required values: policy_version'
  },
  {
    id: 'input_unknown_fields_policy_changed',
    mutate(spec) { spec.decision_runtime_interface_contract.input_contract.unknown_fields_policy = 'reject_unknown_fields'; },
    expect: 'input_contract.unknown_fields_policy must be'
  },
  {
    id: 'input_mutation_allowed_true',
    mutate(spec) { spec.decision_runtime_interface_contract.input_contract.mutation_allowed = true; },
    expect: 'input_contract.mutation_allowed must be false'
  },
  {
    id: 'output_decision_values_incomplete',
    mutate(spec) { spec.decision_runtime_interface_contract.output_contract.decision_values = ['allow']; },
    expect: 'output_contract.decision_values must equal allow, deny'
  },
  {
    id: 'output_surface_effect_removed',
    mutate(spec) {
      spec.decision_runtime_interface_contract.output_contract.surface_effect_values = spec.decision_runtime_interface_contract.output_contract.surface_effect_values.filter((value) => value !== 'deny_resource');
    },
    expect: 'output_contract.surface_effect_values must equal none, allow_invocation, deny_invocation, deny_resource'
  },
  {
    id: 'audit_receipt_required_for_deny_false',
    mutate(spec) { spec.decision_runtime_interface_contract.output_contract.audit_receipt_required_for_deny = false; },
    expect: 'output_contract.audit_receipt_required_for_deny must be true'
  },
  {
    id: 'audit_required_field_removed',
    mutate(spec) {
      spec.decision_runtime_interface_contract.audit_receipt_contract.required_fields = spec.decision_runtime_interface_contract.audit_receipt_contract.required_fields.filter((field) => field !== 'runtime_surface_hash');
    },
    expect: 'missing required values: runtime_surface_hash'
  },
  {
    id: 'audit_secret_material_allowed_true',
    mutate(spec) { spec.decision_runtime_interface_contract.audit_receipt_contract.secret_material_allowed = true; },
    expect: 'audit_receipt_contract.secret_material_allowed must be false'
  },
  {
    id: 'fail_closed_default_allow',
    mutate(spec) { spec.decision_runtime_interface_contract.fail_closed_semantics.default_decision = 'allow'; },
    expect: 'fail_closed_semantics.default_decision must be'
  },
  {
    id: 'fail_closed_deny_on_unknown_tool_false',
    mutate(spec) { spec.decision_runtime_interface_contract.fail_closed_semantics.deny_on_unknown_tool = false; },
    expect: 'fail_closed_semantics.deny_on_unknown_tool must be true'
  },
  {
    id: 'integration_prerequisite_operator_approval_false',
    mutate(spec) { spec.decision_runtime_interface_contract.integration_prerequisites.operator_approval_required_before_runtime_integration = false; },
    expect: 'integration_prerequisites.operator_approval_required_before_runtime_integration must be true'
  },
  {
    id: 'runtime_boundary_changed_true',
    mutate(spec) { spec.runtime_boundary.runtime_behavior_changed = true; },
    expect: 'runtime_boundary.runtime_behavior_changed must be false'
  }
];

const results = [];
try {
  for (const control of controls) {
    const spec = JSON.parse(JSON.stringify(base));
    control.mutate(spec);
    const file = path.join(tmpRoot, `${control.id}.json`);
    fs.writeFileSync(file, JSON.stringify(spec, null, 2) + '\n');
    const run = spawnSync(process.execPath, [validator, file], { cwd: root, encoding: 'utf8' });
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

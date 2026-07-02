#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { loadCombinedServerSpec } = require('./load_server_specs');

const root = process.cwd();
const specPath = process.argv[2] || path.join(root, 'SERVER_SPEC.json');
const statePath = process.argv[3] || path.join(root, '_workflow', 'state.json');
const spec = process.argv[2] ? JSON.parse(fs.readFileSync(specPath, 'utf8')) : loadCombinedServerSpec();
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
const errors = [];
const warnings = [];

function fail(message) {
  errors.push(message);
}

function warn(message) {
  warnings.push(message);
}

function has(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj || {}, key);
}

function requireObject(obj, label) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    fail(`${label} must be an object`);
    return {};
  }
  return obj;
}

function requireBool(obj, key, expected, label) {
  if (!has(obj, key)) {
    fail(`${label}.${key} missing`);
    return;
  }
  if (obj[key] !== expected) fail(`${label}.${key} must be ${expected}`);
}

function requireEqual(obj, key, expected, label) {
  if (!has(obj, key)) {
    fail(`${label}.${key} missing`);
    return;
  }
  if (obj[key] !== expected) fail(`${label}.${key} must be ${JSON.stringify(expected)}`);
}

function requireIncludes(list, value, label) {
  if (!Array.isArray(list)) {
    fail(`${label} must be an array`);
    return;
  }
  if (!list.includes(value)) fail(`${label} must include ${value}`);
}

function requireFile(relativePath, label = relativePath) {
  if (typeof relativePath !== 'string' || relativePath.length === 0) {
    fail(`${label} path must be a non-empty string`);
    return;
  }
  if (path.isAbsolute(relativePath) || relativePath.includes('..')) {
    fail(`${label} path must be safe relative path`);
    return;
  }
  if (!fs.existsSync(path.join(root, relativePath))) fail(`${label} must exist: ${relativePath}`);
}

function requireBackup(relativePath, label = relativePath) {
  if (typeof relativePath !== 'string' || !relativePath.startsWith('_workflow/control_plane/snapshots/')) {
    fail(`${label} must point under _workflow/control_plane/snapshots`);
    return;
  }
  requireFile(relativePath, label);
}

function sectionText(relativePath) {
  const file = path.join(root, relativePath);
  if (!fs.existsSync(file)) return '';
  return fs.readFileSync(file, 'utf8');
}

function documentMentionsCurrentWorkflow(text) {
  const current = state.current_work_package || {};
  return Boolean((current.id && text.includes(current.id)) || (current.label && text.includes(current.label)));
}

function step26RetainedHistorically() {
  const done = Array.isArray(state.completed_work_packages) ? state.completed_work_packages : [];
  return Boolean(
    spec.decision_runtime_interface_contract_readiness_gate ||
    (state.current_work_package || {}).id === 'stage12_step26_decision_runtime_interface_contract_readiness_gate' ||
    (state.previous_work_package || {}).id === 'stage12_step26_decision_runtime_interface_contract_readiness_gate' ||
    done.some((item) => item && item.id === 'stage12_step26_decision_runtime_interface_contract_readiness_gate')
  );
}

if (spec.spec_mode !== 'canonical_structured_spec_not_progress_log') {
  fail('SERVER_SPEC.json must remain canonical structured spec, not progress log');
}

const runtimeBoundary = requireObject(spec.runtime_boundary, 'runtime_boundary');
for (const key of [
  'runtime_behavior_changed',
  'server_js_changed',
  'tools_list_changed',
  'fingerprints_changed',
  'restart_required',
  'connector_refresh_required'
]) {
  requireBool(runtimeBoundary, key, false, 'runtime_boundary');
}

const contract = requireObject(spec.decision_runtime_interface_contract, 'decision_runtime_interface_contract');
requireEqual(contract, 'status', 'contract_written_not_implemented', 'decision_runtime_interface_contract');
requireEqual(contract, 'mode', 'runtime_interface_contract_only', 'decision_runtime_interface_contract');
for (const key of [
  'runtime_implementation_ready',
  'shadow_mode_ready',
  'server_runtime_integrated',
  'mcp_tool_exposed',
  'connector_visible_change_allowed'
]) {
  requireBool(contract, key, false, 'decision_runtime_interface_contract');
}

const validator = requireObject(contract.validator, 'decision_runtime_interface_contract.validator');
requireEqual(validator, 'status', 'passing', 'decision_runtime_interface_contract.validator');
requireEqual(validator, 'script', '_workflow/scripts/validate_decision_runtime_interface_contract.js', 'decision_runtime_interface_contract.validator');
requireBool(validator, 'runtime_integrated', false, 'decision_runtime_interface_contract.validator');
requireBool(validator, 'mcp_tool_exposed', false, 'decision_runtime_interface_contract.validator');
requireFile(validator.script, 'contract validator script');

const negativeControls = requireObject(contract.negative_controls, 'decision_runtime_interface_contract.negative_controls');
requireEqual(negativeControls, 'status', 'passing', 'decision_runtime_interface_contract.negative_controls');
requireEqual(negativeControls, 'tool', '_workflow/scripts/validate_decision_runtime_interface_contract_negative_controls.js', 'decision_runtime_interface_contract.negative_controls');
requireEqual(negativeControls, 'smoke', '_tests/smoke_decision_runtime_interface_contract_negative_controls.js', 'decision_runtime_interface_contract.negative_controls');
requireEqual(negativeControls, 'control_count', 17, 'decision_runtime_interface_contract.negative_controls');
requireBool(negativeControls, 'runtime_integrated', false, 'decision_runtime_interface_contract.negative_controls');
requireBool(negativeControls, 'mcp_tool_exposed', false, 'decision_runtime_interface_contract.negative_controls');
requireBool(negativeControls, 'connector_visible_change_allowed', false, 'decision_runtime_interface_contract.negative_controls');
requireFile(negativeControls.tool, 'contract negative controls tool');
requireFile(negativeControls.smoke, 'contract negative controls smoke');
for (const control of [
  'missing_contract_object',
  'bad_contract_status',
  'bad_contract_mode',
  'runtime_implementation_ready_true',
  'server_runtime_integrated_true',
  'input_required_field_removed',
  'input_unknown_fields_policy_changed',
  'input_mutation_allowed_true',
  'output_decision_values_incomplete',
  'output_surface_effect_removed',
  'audit_receipt_required_for_deny_false',
  'audit_required_field_removed',
  'audit_secret_material_allowed_true',
  'fail_closed_default_allow',
  'fail_closed_deny_on_unknown_tool_false',
  'integration_prerequisite_operator_approval_false',
  'runtime_boundary_changed_true'
]) {
  requireIncludes(negativeControls.controls, control, 'decision_runtime_interface_contract.negative_controls.controls');
}

const gate = requireObject(spec.decision_runtime_interface_contract_readiness_gate, 'decision_runtime_interface_contract_readiness_gate');
requireEqual(gate, 'status', 'passed_for_runtime_integration_planning_only', 'decision_runtime_interface_contract_readiness_gate');
requireEqual(gate, 'mode', 'readiness_gate_only_no_runtime_change', 'decision_runtime_interface_contract_readiness_gate');
requireBool(gate, 'runtime_behavior_changed', false, 'decision_runtime_interface_contract_readiness_gate');
requireBool(gate, 'server_runtime_integrated', false, 'decision_runtime_interface_contract_readiness_gate');
requireBool(gate, 'mcp_tool_exposed', false, 'decision_runtime_interface_contract_readiness_gate');
requireBool(gate, 'connector_visible_change_allowed', false, 'decision_runtime_interface_contract_readiness_gate');

const gateInputs = requireObject(gate.gate_inputs, 'decision_runtime_interface_contract_readiness_gate.gate_inputs');
for (const key of [
  'contract_validator_ok',
  'contract_negative_controls_ok',
  'fixture_validator_ok',
  'fixture_negative_controls_ok',
  'decision_evaluator_ok',
  'decision_evaluator_negative_controls_ok',
  'workflow_state_smoke_ok',
  'documentation_state_audit_ok',
  'runtime_boundary_preserved'
]) {
  requireBool(gateInputs, key, true, 'decision_runtime_interface_contract_readiness_gate.gate_inputs');
}
requireEqual(gateInputs, 'pre_gate_full_smoke_skip_network', 'ok_true_105_results_version_0_29_0', 'decision_runtime_interface_contract_readiness_gate.gate_inputs');
requireEqual(gateInputs, 'expected_full_smoke_results_after_registration', 106, 'decision_runtime_interface_contract_readiness_gate.gate_inputs');

const gateDecision = requireObject(gate.gate_decision, 'decision_runtime_interface_contract_readiness_gate.gate_decision');
requireBool(gateDecision, 'ready_for_runtime_integration_planning', true, 'decision_runtime_interface_contract_readiness_gate.gate_decision');
for (const key of [
  'runtime_implementation_ready',
  'shadow_mode_ready',
  'prototype_shadow_mode_allowed_next',
  'server_runtime_integrated',
  'mcp_tool_exposed',
  'connector_visible_change_allowed',
  'stage12_closable',
  'new_stage_allowed',
  'direct_runtime_implementation_allowed'
]) {
  requireBool(gateDecision, key, false, 'decision_runtime_interface_contract_readiness_gate.gate_decision');
}
if (!['stage12_step27_decision_runtime_integration_plan', 'stage12_step28_decision_runtime_integration_plan_validator_or_operator_approval_gate'].includes(gateDecision.next_planned_step)) {
  fail('decision_runtime_interface_contract_readiness_gate.gate_decision.next_planned_step must be stage12_step27_decision_runtime_integration_plan or later approved Step 28 gate');
}

const docAudit = requireObject(gate.documentation_audit, 'decision_runtime_interface_contract_readiness_gate.documentation_audit');
requireEqual(docAudit, 'status', 'complete', 'decision_runtime_interface_contract_readiness_gate.documentation_audit');
for (const key of [
  'state_current_package_recorded',
  'state_previous_package_recorded',
  'state_validation_evidence_recorded',
  'state_recent_completed_work_packages_updated',
  'server_spec_gate_recorded',
  'handoff_rendered',
  'working_course_rendered',
  'longterm_doc_written',
  'policy_doc_written'
]) {
  requireBool(docAudit, key, true, 'decision_runtime_interface_contract_readiness_gate.documentation_audit');
}

const current = requireObject(state.current_work_package, 'state.current_work_package');
const previous = requireObject(state.previous_work_package, 'state.previous_work_package');
const completedPackages = Array.isArray(state.completed_work_packages) ? state.completed_work_packages : [];
const step26IsCurrent = current.id === 'stage12_step26_decision_runtime_interface_contract_readiness_gate';
const step26IsPrevious = previous.id === 'stage12_step26_decision_runtime_interface_contract_readiness_gate';
const step26IsCompleted = completedPackages.some((item) => item.id === 'stage12_step26_decision_runtime_interface_contract_readiness_gate');

if (!step26IsCurrent && !step26IsPrevious && !step26IsCompleted) {
  fail('state must retain stage12_step26_decision_runtime_interface_contract_readiness_gate as current, previous, or completed package');
}

if (step26IsCurrent) {
  requireEqual(current, 'status', 'frozen', 'state.current_work_package');
  requireBool(current, 'connector_visible_change', false, 'state.current_work_package');
  requireBool(current, 'runtime_extraction', false, 'state.current_work_package');
  requireBool(current, 'runtime_code_changed', false, 'state.current_work_package');
  requireBool(current, 'restart_pending', false, 'state.current_work_package');
  requireFile(current.canonical_plan, 'state.current_work_package.canonical_plan');

  const acceptance = requireObject(current.acceptance, 'state.current_work_package.acceptance');
  requireBool(acceptance, 'runtime_interface_contract_readiness_gate_passed', true, 'state.current_work_package.acceptance');
  requireBool(acceptance, 'documentation_state_audit_complete', true, 'state.current_work_package.acceptance');
  for (const key of [
    'runtime_implementation_ready',
    'shadow_mode_ready',
    'prototype_shadow_mode_allowed_next',
    'server_runtime_integrated',
    'mcp_tool_exposed',
    'connector_visible_change_allowed',
    'direct_runtime_implementation_allowed',
    'runtime_implemented',
    'tool_filtering_implemented',
    'tools_list_changed',
    'descriptor_changed',
    'schema_changed',
    'outputMode_changed',
    'connectorShapeVersion_changed',
    'fingerprints_changed',
    'restart_required',
    'connector_refresh_required',
    'version_bump_required',
    'tool_surface_changed'
  ]) {
    requireBool(acceptance, key, false, 'state.current_work_package.acceptance');
  }
  requireBackup(acceptance.pre_work_snapshot, 'state.current_work_package.acceptance.pre_work_snapshot');
  if (acceptance.post_work_backup !== 'pending') requireBackup(acceptance.post_work_backup, 'state.current_work_package.acceptance.post_work_backup');
  requireEqual(acceptance, 'next_planned_step', 'stage12_step27_decision_runtime_integration_plan', 'state.current_work_package.acceptance');
}

if (step26IsPrevious) {
  requireBool(previous, 'connector_visible_change', false, 'state.previous_work_package');
  requireBool(previous, 'runtime_extraction', false, 'state.previous_work_package');
  requireBool(previous, 'restart_pending', false, 'state.previous_work_package');
  requireBackup(previous.backup, 'state.previous_work_package.backup');
}

for (const evidenceId of [
  'stage12_step26_decision_runtime_interface_contract_readiness_gate_pass',
  'stage12_step25_decision_runtime_interface_contract_negative_controls_dev_tool_pass',
  'stage12_step24_decision_runtime_interface_contract_validator_dev_tool_pass'
]) {
  if (!Array.isArray(state.validation_evidence) || !state.validation_evidence.some((item) => item.id === evidenceId)) {
    fail(`state.validation_evidence must include ${evidenceId}`);
  }
}

if (!Array.isArray(state.completed_work_packages) || !state.completed_work_packages.some((item) => item.id === 'stage12_step25_decision_runtime_interface_contract_negative_controls_dev_tool')) {
  fail('state.completed_work_packages must retain Stage 12 / Step 25');
}

for (const file of [
  '_workflow/longterm/stage12_step24_decision_runtime_interface_contract_validator_dev_tool.md',
  '_workflow/longterm/stage12_step25_decision_runtime_interface_contract_negative_controls_dev_tool.md',
  '_workflow/longterm/stage12_step26_decision_runtime_interface_contract_readiness_gate.md',
  '_workflow/policies/stage12_step24_decision_runtime_interface_contract_validator_dev_tool_v0.json',
  '_workflow/policies/stage12_step25_decision_runtime_interface_contract_negative_controls_dev_tool_v0.json',
  '_workflow/policies/stage12_step26_decision_runtime_interface_contract_readiness_gate_v0.json'
]) {
  requireFile(file, file);
}

const handoff = sectionText('_workflow/NEXT_CHAT_HANDOFF.md');
const course = sectionText('_workflow/WORKING_COURSE.md');
if (!step26RetainedHistorically()) {
  fail('state/spec must retain Step 26 readiness gate after later workflow steps');
}
for (const [label, text] of [['NEXT_CHAT_HANDOFF', handoff], ['WORKING_COURSE', course]]) {
  if (!text.includes('<!-- WORKFLOW_STATE_START -->') || !text.includes('<!-- WORKFLOW_STATE_END -->')) {
    fail(`${label} must preserve generated workflow markers`);
  }
  if (!documentMentionsCurrentWorkflow(text)) {
    fail(`${label} must mention current workflow package generically`);
  }
}

if (state.last_validation?.decision_runtime_interface_contract_readiness_gate !== 'ok') {
  fail('state.last_validation.decision_runtime_interface_contract_readiness_gate must be ok');
}
if (state.last_validation?.documentation_state_audit !== 'ok') {
  fail('state.last_validation.documentation_state_audit must be ok');
}

const result = {
  ok: errors.length === 0,
  spec_path: specPath,
  state_path: statePath,
  gate_status: gate.status,
  ready_for_runtime_integration_planning: gateDecision.ready_for_runtime_integration_planning === true,
  runtime_implementation_ready: gateDecision.runtime_implementation_ready === true,
  server_runtime_integrated: gateDecision.server_runtime_integrated === true,
  mcp_tool_exposed: gateDecision.mcp_tool_exposed === true,
  connector_visible_change_allowed: gateDecision.connector_visible_change_allowed === true,
  documentation_state_audit: docAudit.status,
  expected_full_smoke_results_after_registration: gateInputs.expected_full_smoke_results_after_registration,
  errors,
  warnings
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);

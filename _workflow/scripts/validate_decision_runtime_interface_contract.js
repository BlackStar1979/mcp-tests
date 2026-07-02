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

function requireArrayIncludesAll(obj, key, expected, label) {
  if (!Array.isArray(obj?.[key])) {
    fail(`${label}.${key} must be an array`);
    return;
  }
  const missingValues = [];
  for (const item of expected) {
    if (!obj[key].includes(item)) missingValues.push(item);
  }
  if (missingValues.length) fail(`${label}.${key} missing required values: ${missingValues.join(', ')}`);
}

function requireArrayExact(obj, key, expected, label) {
  if (!Array.isArray(obj?.[key])) {
    fail(`${label}.${key} must be an array`);
    return;
  }
  const actual = obj[key];
  const missingValues = [];
  const extraValues = [];
  for (const item of expected) {
    if (!actual.includes(item)) missingValues.push(item);
  }
  for (const item of actual) {
    if (!expected.includes(item)) extraValues.push(item);
  }
  if (missingValues.length || extraValues.length) {
    fail(`${label}.${key} must equal ${expected.join(', ')}; missing=${missingValues.join(', ') || '<none>'}; extra=${extraValues.join(', ') || '<none>'}`);
  }
}

if (spec.spec_mode !== 'canonical_structured_spec_not_progress_log') {
  fail('spec_mode must mark SERVER_SPEC.json as structured spec, not progress log');
}

const runtimeBoundary = requireObject(spec.runtime_boundary, 'runtime_boundary');
requireBool(runtimeBoundary, 'runtime_behavior_changed', false, 'runtime_boundary');
requireBool(runtimeBoundary, 'server_js_changed', false, 'runtime_boundary');
requireBool(runtimeBoundary, 'tools_list_changed', false, 'runtime_boundary');
requireBool(runtimeBoundary, 'fingerprints_changed', false, 'runtime_boundary');
requireBool(runtimeBoundary, 'restart_required', false, 'runtime_boundary');
requireBool(runtimeBoundary, 'connector_refresh_required', false, 'runtime_boundary');

const contract = requireObject(spec.decision_runtime_interface_contract, 'decision_runtime_interface_contract');
requireEqual(contract, 'status', 'contract_written_not_implemented', 'decision_runtime_interface_contract');
requireEqual(contract, 'mode', 'runtime_interface_contract_only', 'decision_runtime_interface_contract');
requireBool(contract, 'runtime_implementation_ready', false, 'decision_runtime_interface_contract');
requireBool(contract, 'shadow_mode_ready', false, 'decision_runtime_interface_contract');
requireBool(contract, 'server_runtime_integrated', false, 'decision_runtime_interface_contract');
requireBool(contract, 'mcp_tool_exposed', false, 'decision_runtime_interface_contract');
requireBool(contract, 'connector_visible_change_allowed', false, 'decision_runtime_interface_contract');

const input = requireObject(contract.input_contract, 'decision_runtime_interface_contract.input_contract');
requireBool(input, 'immutable_request_context_required', true, 'decision_runtime_interface_contract.input_contract');
requireArrayIncludesAll(input, 'required_fields', [
  'request_id',
  'request_surface',
  'principal',
  'auth_context',
  'connector_profile',
  'capability_profile',
  'tool_context',
  'resource_context',
  'requested_operation',
  'runtime_surface_hash',
  'policy_version'
], 'decision_runtime_interface_contract.input_contract');
requireBool(input, 'normalization_required', true, 'decision_runtime_interface_contract.input_contract');
requireEqual(input, 'unknown_fields_policy', 'ignore_for_decision_but_include_in_audit_summary_if_safe', 'decision_runtime_interface_contract.input_contract');
requireBool(input, 'mutation_allowed', false, 'decision_runtime_interface_contract.input_contract');

const output = requireObject(contract.output_contract, 'decision_runtime_interface_contract.output_contract');
requireArrayIncludesAll(output, 'required_fields', [
  'decision',
  'reason_code',
  'matched_rule',
  'human_reason',
  'audit_receipt',
  'surface_effect'
], 'decision_runtime_interface_contract.output_contract');
requireArrayExact(output, 'decision_values', ['allow', 'deny'], 'decision_runtime_interface_contract.output_contract');
requireBool(output, 'audit_receipt_required_for_allow', true, 'decision_runtime_interface_contract.output_contract');
requireBool(output, 'audit_receipt_required_for_deny', true, 'decision_runtime_interface_contract.output_contract');
requireArrayExact(output, 'surface_effect_values', [
  'none',
  'allow_invocation',
  'deny_invocation',
  'deny_resource'
], 'decision_runtime_interface_contract.output_contract');

const audit = requireObject(contract.audit_receipt_contract, 'decision_runtime_interface_contract.audit_receipt_contract');
requireArrayIncludesAll(audit, 'required_fields', [
  'receipt_version',
  'request_id',
  'request_surface',
  'decision',
  'reason_code',
  'matched_rule',
  'principal',
  'connector_profile',
  'capability_profile',
  'tool_name',
  'tool_domain',
  'resource_class',
  'requested_operation',
  'runtime_surface_hash'
], 'decision_runtime_interface_contract.audit_receipt_contract');
requireBool(audit, 'redaction_required', true, 'decision_runtime_interface_contract.audit_receipt_contract');
requireBool(audit, 'secret_material_allowed', false, 'decision_runtime_interface_contract.audit_receipt_contract');

const failClosed = requireObject(contract.fail_closed_semantics, 'decision_runtime_interface_contract.fail_closed_semantics');
requireEqual(failClosed, 'default_decision', 'deny', 'decision_runtime_interface_contract.fail_closed_semantics');
for (const key of [
  'deny_on_malformed_context',
  'deny_on_unknown_tool',
  'deny_on_unknown_domain_or_risk',
  'deny_on_unknown_resource_or_operation',
  'deny_on_runtime_surface_drift',
  'deny_on_descriptor_only_bypass',
  'deny_on_auth_transport_without_permission',
  'deny_on_missing_audit_receipt'
]) {
  requireBool(failClosed, key, true, 'decision_runtime_interface_contract.fail_closed_semantics');
}

const prereq = requireObject(contract.integration_prerequisites, 'decision_runtime_interface_contract.integration_prerequisites');
for (const key of [
  'contract_validator_required_next',
  'positive_and_negative_interface_fixtures_required_before_runtime',
  'operator_approval_required_before_runtime_integration',
  'operator_approval_required_before_mcp_exposure',
  'restart_plan_required_before_runtime_integration',
  'connector_refresh_plan_required_before_connector_visible_change'
]) {
  requireBool(prereq, key, true, 'decision_runtime_interface_contract.integration_prerequisites');
}

if (contract?.validator && contract.validator.script !== '_workflow/scripts/validate_decision_runtime_interface_contract.js') {
  warn('decision_runtime_interface_contract.validator.script points to a different script');
}
if (contract?.smoke && contract.smoke.path !== '_tests/smoke_decision_runtime_interface_contract_validator.js') {
  warn('decision_runtime_interface_contract.smoke.path points to a different smoke');
}

const result = {
  ok: errors.length === 0,
  spec_path: specPath,
  contract_status: contract.status,
  contract_mode: contract.mode,
  checked_input_fields: Array.isArray(input.required_fields) ? input.required_fields.length : 0,
  checked_output_fields: Array.isArray(output.required_fields) ? output.required_fields.length : 0,
  checked_audit_receipt_fields: Array.isArray(audit.required_fields) ? audit.required_fields.length : 0,
  fail_closed_semantics_enforced: errors.filter((item) => item.includes('fail_closed_semantics')).length === 0,
  integration_prerequisites_enforced: errors.filter((item) => item.includes('integration_prerequisites')).length === 0,
  runtime_integrated: contract.server_runtime_integrated === true,
  runtime_implementation_ready: contract.runtime_implementation_ready === true,
  shadow_mode_ready: contract.shadow_mode_ready === true,
  mcp_tool_exposed: contract.mcp_tool_exposed === true,
  connector_visible_change_allowed: contract.connector_visible_change_allowed === true,
  errors,
  warnings
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);

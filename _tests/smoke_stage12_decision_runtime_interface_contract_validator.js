#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');
const script = path.join(root, '_workflow', 'scripts', 'validate_decision_runtime_interface_contract.js');
const result = spawnSync(process.execPath, [script], { cwd: root, encoding: 'utf8' });

if (result.status !== 0) {
  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || '');
  throw new Error('decision runtime interface contract validator failed');
}

const parsed = JSON.parse(result.stdout);
if (parsed.ok !== true) throw new Error('validator did not return ok=true');
if (parsed.contract_status !== 'contract_written_not_implemented') throw new Error('unexpected contract status');
if (parsed.contract_mode !== 'runtime_interface_contract_only') throw new Error('unexpected contract mode');
if (parsed.checked_input_fields !== 11) throw new Error(`expected 11 input fields, got ${parsed.checked_input_fields}`);
if (parsed.checked_output_fields !== 6) throw new Error(`expected 6 output fields, got ${parsed.checked_output_fields}`);
if (parsed.checked_audit_receipt_fields !== 14) throw new Error(`expected 14 audit receipt fields, got ${parsed.checked_audit_receipt_fields}`);
if (parsed.fail_closed_semantics_enforced !== true) throw new Error('fail-closed semantics not enforced');
if (parsed.integration_prerequisites_enforced !== true) throw new Error('integration prerequisites not enforced');
if (parsed.runtime_integrated !== false) throw new Error('runtime_integrated must be false');
if (parsed.runtime_implementation_ready !== false) throw new Error('runtime_implementation_ready must be false');
if (parsed.shadow_mode_ready !== false) throw new Error('shadow_mode_ready must be false');
if (parsed.mcp_tool_exposed !== false) throw new Error('mcp_tool_exposed must be false');
if (parsed.connector_visible_change_allowed !== false) throw new Error('connector_visible_change_allowed must be false');
if (!Array.isArray(parsed.errors) || parsed.errors.length !== 0) throw new Error('validator errors must be empty');

console.log('smoke_stage12_decision_runtime_interface_contract_validator ok');

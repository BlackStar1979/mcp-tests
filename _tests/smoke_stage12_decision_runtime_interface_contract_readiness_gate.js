#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');
const script = path.join(root, '_workflow', 'scripts', 'validate_decision_runtime_interface_contract_readiness_gate.js');
const state = path.join(root, '_workflow', 'state.json');
const result = spawnSync(process.execPath, [script], { cwd: root, encoding: 'utf8' });

if (result.status !== 0) {
  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || '');
  throw new Error('decision runtime interface contract readiness gate failed');
}

const parsed = JSON.parse(result.stdout);
if (parsed.ok !== true) throw new Error('readiness gate did not return ok=true');
if (parsed.gate_status !== 'passed_for_runtime_integration_planning_only') throw new Error(`unexpected gate status: ${parsed.gate_status}`);
if (parsed.ready_for_runtime_integration_planning !== true) throw new Error('runtime integration planning should be allowed');
if (parsed.runtime_implementation_ready !== false) throw new Error('runtime implementation must remain false');
if (parsed.server_runtime_integrated !== false) throw new Error('server runtime integration must remain false');
if (parsed.mcp_tool_exposed !== false) throw new Error('MCP exposure must remain false');
if (parsed.connector_visible_change_allowed !== false) throw new Error('connector-visible change must remain false');
if (parsed.documentation_state_audit !== 'complete') throw new Error('documentation/state audit must be complete');
if (parsed.expected_full_smoke_results_after_registration !== 106) throw new Error('expected full smoke count must be 106 after registration');
console.log('smoke_stage12_decision_runtime_interface_contract_readiness_gate ok');

#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');
const script = path.join(root, '_workflow', 'scripts', 'validate_decision_runtime_integration_plan.js');
const state = path.join(root, '_workflow', 'state.json');
const result = spawnSync(process.execPath, [script], { cwd: root, encoding: 'utf8' });

if (result.status !== 0) {
  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || '');
  throw new Error('decision runtime integration plan validation failed');
}

const parsed = JSON.parse(result.stdout);
if (parsed.ok !== true) throw new Error('integration plan validator did not return ok=true');
if (parsed.plan_status !== 'plan_written_not_implemented') throw new Error(`unexpected plan status: ${parsed.plan_status}`);
if (parsed.integration_point_count < 7) throw new Error('integration plan must record at least 7 read-only integration points');
if (parsed.runtime_patch_allowed_next !== false) throw new Error('runtime patch must not be allowed by Step 27');
if (parsed.operator_approval_required !== true) throw new Error('operator approval must be required');
if (parsed.runtime_behavior_changed !== false) throw new Error('runtime behavior must remain unchanged');
if (parsed.server_runtime_integrated !== false) throw new Error('server runtime integration must remain false');
if (parsed.mcp_tool_exposed !== false) throw new Error('MCP exposure must remain false');
if (parsed.connector_visible_change_allowed !== false) throw new Error('connector-visible change must remain false');
console.log('smoke_stage12_decision_runtime_integration_plan ok');

#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');
const script = path.join(root, '_workflow', 'scripts', 'evaluate_server_spec_decisions.js');
const result = spawnSync(process.execPath, [script], { cwd: root, encoding: 'utf8' });

if (result.status !== 0) {
  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || '');
  throw new Error('decision evaluator dev harness failed');
}

const parsed = JSON.parse(result.stdout);
if (parsed.ok !== true) throw new Error('decision evaluator did not return ok=true');
if (parsed.evaluated_fixture_count !== 15) throw new Error(`expected 15 evaluated fixtures, got ${parsed.evaluated_fixture_count}`);
if (parsed.pass_count !== parsed.evaluated_fixture_count) throw new Error('pass count must equal evaluated fixture count');
if (parsed.runtime_integrated !== false) throw new Error('runtime_integrated must be false');
if (parsed.mcp_tool_exposed !== false) throw new Error('mcp_tool_exposed must be false');
if (!Array.isArray(parsed.decision_trace) || parsed.decision_trace.length !== parsed.evaluated_fixture_count) throw new Error('decision trace count mismatch');
for (const t of parsed.decision_trace) {
  if (t.matched_matrix_entry !== true) throw new Error(`matrix entry not matched for ${t.fixture_id}`);
  if (t.expected_decision !== t.actual_decision) throw new Error(`decision mismatch for ${t.fixture_id}`);
  if (t.expected_reason_code !== t.actual_reason_code) throw new Error(`reason code mismatch for ${t.fixture_id}`);
  if (t.expected_rule !== t.actual_rule) throw new Error(`rule mismatch for ${t.fixture_id}`);
}

console.log('smoke_stage12_decision_evaluator_dev_harness ok');

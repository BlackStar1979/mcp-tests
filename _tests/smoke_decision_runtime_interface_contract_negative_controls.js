#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');
const script = path.join(root, '_workflow', 'scripts', 'validate_decision_runtime_interface_contract_negative_controls.js');
const result = spawnSync(process.execPath, [script], { cwd: root, encoding: 'utf8' });

if (result.status !== 0) {
  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || '');
  throw new Error('decision runtime interface contract negative controls failed');
}

const parsed = JSON.parse(result.stdout);
if (parsed.ok !== true) throw new Error('negative controls did not return ok=true');
if (parsed.negative_control_count !== 17) throw new Error(`expected 17 negative controls, got ${parsed.negative_control_count}`);
for (const item of parsed.results) {
  if (item.failed !== true || item.matched !== true) throw new Error(`negative control did not fail with expected marker: ${item.id}`);
}
console.log('smoke_decision_runtime_interface_contract_negative_controls ok');

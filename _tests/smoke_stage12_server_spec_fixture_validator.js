#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');
const script = path.join(root, '_workflow', 'scripts', 'validate_server_spec_fixtures.js');

const result = spawnSync(process.execPath, [script], {
  cwd: root,
  encoding: 'utf8'
});

if (result.status !== 0) {
  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || '');
  throw new Error('server spec fixture validator failed');
}

const parsed = JSON.parse(result.stdout);
if (parsed.ok !== true) throw new Error('validator did not return ok=true');
if (parsed.fixture_count < 15) throw new Error(`expected at least 15 fixtures, got ${parsed.fixture_count}`);
if (parsed.matrix_enforced !== true) throw new Error('matrix enforcement was not reported');
if (parsed.matrix_fixture_count !== parsed.fixture_count) throw new Error('matrix fixture count must match fixture count');
if (!Array.isArray(parsed.checked_required_fields) || !parsed.checked_required_fields.includes('id')) {
  throw new Error('required field set was not reported');
}

console.log('smoke_stage12_server_spec_fixture_validator ok');

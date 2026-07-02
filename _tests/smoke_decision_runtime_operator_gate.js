#!/usr/bin/env node
'use strict';
const { loadCombinedServerSpec } = require('../_workflow/scripts/load_server_specs');
const spec=loadCombinedServerSpec();
const gate=spec.decision_runtime_operator_gate||{};
if(gate.status!=='operator_gate_written_runtime_patch_not_authorized')throw new Error('bad gate');
if(gate.runtime_patch_authorized!==false)throw new Error('bad auth');
console.log('smoke_decision_runtime_operator_gate ok');

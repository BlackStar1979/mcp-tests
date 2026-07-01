const fs=require('fs');
const { loadCombinedServerSpec } = require('./load_server_specs');

const artifact=fs.readFileSync('_workflow/longterm/stage12_step34_runtime_execution_package_operator_approval.md','utf8');
const policy=JSON.parse(fs.readFileSync('_workflow/policies/p34.json','utf8'));
const manifest=JSON.parse(fs.readFileSync('_workflow/patch_manifests/stage12_step33_runtime_execution_dry_run_manifest.json','utf8'));
const spec=loadCombinedServerSpec();
const state=JSON.parse(fs.readFileSync('_workflow/state.json','utf8'));
const runAll=fs.readFileSync('_tests/run_all_smokes.js','utf8');
const runAllScripts=fs.existsSync('_tests/run_all_smoke_scripts.json')?JSON.parse(fs.readFileSync('_tests/run_all_smoke_scripts.json','utf8')):[];
const index=JSON.parse(fs.readFileSync('_workflow/policies/policy_index.json','utf8'));

const indexShorts=new Set(index.entries.map((entry)=>entry.short));
const step34RetainedHistorically=
  state.previous_work_package?.id==='stage12_step34_runtime_execution_package_operator_approval'||
  state.current_work_package?.id==='stage12_step34_runtime_execution_package_operator_approval'||
  (Array.isArray(state.completed_work_packages)&&state.completed_work_packages.some((item)=>item.id==='stage12_step34_runtime_execution_package_operator_approval'));
const ok=
  artifact.includes('EXECUTION PACKAGE APPROVED FOR APPLY-PACKAGE PREPARATION')&&
  artifact.includes('RUNTIME APPLY STILL BLOCKED')&&
  policy.step33_execution_package_approved_for_apply_package_preparation===true&&
  policy.apply_package_preparation_allowed===true&&
  policy.additional_p1_tests_required_before_apply===true&&
  policy.runtime_patch_requires_separate_operator_execution_approval===true&&
  policy.runtime_change_authorized===false&&
  policy.runtime_change_allowed_next===false&&
  policy.apply_changes_allowed===false&&
  manifest.apply_changes_allowed===false&&
  manifest.runtime_change_authorized===false&&
  spec.runtime_execution_package_operator_approval?.status==='execution_package_approved_for_apply_package_preparation_runtime_apply_blocked'&&
  spec.runtime_execution_package_operator_approval?.runtime_change_authorized===false&&
  spec.runtime_execution_package_operator_approval?.apply_package_preparation_allowed===true&&
  spec.runtime_execution_package_operator_approval?.runtime_patch_requires_separate_operator_execution_approval===true&&
  step34RetainedHistorically&&
  state.last_validation?.stage12_step34_runtime_execution_package_operator_approval==='ok'&&
  (runAll.includes('_tests/smoke_runtime_execution_package_operator_approval.js')||runAllScripts.includes('_tests/smoke_runtime_execution_package_operator_approval.js'))&&
  indexShorts.has('p33b.json')&&
  indexShorts.has('p34.json');

console.log(JSON.stringify({ok},null,2));
if(!ok)process.exit(1);

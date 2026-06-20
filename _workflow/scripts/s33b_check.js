const fs=require('fs');
const v=fs.readFileSync('_workflow/scripts/validate_decision_runtime_interface_contract_readiness_gate.js','utf8');
const g=fs.readFileSync('_tests/smoke_stage9_harness_no_pollution_guard.js','utf8');
const idx=JSON.parse(fs.readFileSync('_workflow/policies/policy_index.json','utf8'));
const m=JSON.parse(fs.readFileSync('_workflow/patch_manifests/stage12_step33_runtime_execution_dry_run_manifest.json','utf8'));
const s=JSON.parse(fs.readFileSync('_workflow/state.json','utf8'));
let ok=v.includes('step26RetainedHistorically')&&!v.includes('must mention Step 27 plan')&&g.includes('expectedInnerResultCount')&&!g.includes('inner result count must be 113')&&idx.entries.length>=5&&m.apply_changes_allowed===false&&m.patches.length===5&&s.last_validation?.stage12_step33b_pre_step34_debt_reduction==='ok';
console.log(JSON.stringify({ok},null,2));
if(!ok)process.exit(1);

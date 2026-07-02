const fs=require('fs');
const spec=JSON.parse(fs.readFileSync('SERVER_DECISION_RUNTIME_SPEC.json','utf8'));
const history=JSON.parse(fs.readFileSync('_workflow/historical/stage12_workflow_history.json','utf8'));
const section=spec.sections?.pre_step34_debt_reduction;
const historical=history.sections?.pre_step34_debt_reduction;
const ok=
  section?.status==='p0_debt_reduced_no_runtime_change' &&
  section?.policy==='_workflow/policies/p33b.json' &&
  section?.dry_run_manifest==='_workflow/patch_manifests/stage12_step33_runtime_execution_dry_run_manifest.json' &&
  historical?.status==='p0_debt_reduced_no_runtime_change' &&
  historical?.policy==='_workflow/policies/p33b.json' &&
  historical?.artifact==='_workflow/longterm/stage12_step33b_pre_step34_debt_reduction_no_runtime_change.md' &&
  historical?.dry_run_manifest==='_workflow/patch_manifests/stage12_step33_runtime_execution_dry_run_manifest.json';
console.log(JSON.stringify({ok},null,2));
if(!ok)process.exit(1);

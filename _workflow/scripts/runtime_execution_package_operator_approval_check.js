const fs=require('fs');
const spec=JSON.parse(fs.readFileSync('SERVER_DECISION_RUNTIME_SPEC.json','utf8'));
const history=JSON.parse(fs.readFileSync('_workflow/historical/stage12_workflow_history.json','utf8'));
const section=spec.sections?.runtime_execution_package_operator_approval;
const historical=history.sections?.runtime_execution_package_operator_approval;
const ok=
  section?.status==='execution_package_approved_for_apply_package_preparation_runtime_apply_blocked' &&
  section?.policy==='_workflow/policies/p34.json' &&
  section?.artifact==='_workflow/longterm/stage12_step34_runtime_execution_package_operator_approval.md' &&
  section?.smoke==='_tests/smoke_runtime_execution_package_operator_approval.js' &&
  section?.apply_package_preparation_allowed===true &&
  section?.runtime_patch_requires_separate_operator_execution_approval===true &&
  section?.runtime_change_authorized===false &&
  section?.runtime_change_allowed_next===false &&
  historical?.status==='execution_package_approved_for_apply_package_preparation_runtime_apply_blocked' &&
  historical?.artifact==='_workflow/longterm/stage12_step34_runtime_execution_package_operator_approval.md';
console.log(JSON.stringify({ok},null,2));
if(!ok)process.exit(1);

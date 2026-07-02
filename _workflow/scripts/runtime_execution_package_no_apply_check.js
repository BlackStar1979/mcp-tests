const fs=require('fs');
const spec=JSON.parse(fs.readFileSync('SERVER_DECISION_RUNTIME_SPEC.json','utf8'));
const history=JSON.parse(fs.readFileSync('_workflow/historical/stage12_workflow_history.json','utf8'));
const section=spec.sections?.runtime_execution_package_no_apply;
const historical=history.sections?.runtime_execution_package_no_apply;
const ok=
  section?.status==='execution_package_written_no_runtime_change' &&
  section?.policy==='_workflow/policies/p33.json' &&
  section?.artifact==='_workflow/longterm/stage12_step33_runtime_execution_package_no_apply.md' &&
  section?.smoke==='_tests/smoke_runtime_execution_package_no_apply.js' &&
  historical?.status==='execution_package_written_no_runtime_change' &&
  historical?.artifact==='_workflow/longterm/stage12_step33_runtime_execution_package_no_apply.md' &&
  historical?.next_planned_step==='stage12_step34_runtime_execution_package_operator_approval';
console.log(JSON.stringify({ok},null,2));
if(!ok)process.exit(1);

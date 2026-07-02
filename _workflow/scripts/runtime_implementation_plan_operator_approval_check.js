const fs=require('fs');
const spec=JSON.parse(fs.readFileSync('SERVER_DECISION_RUNTIME_SPEC.json','utf8'));
const history=JSON.parse(fs.readFileSync('_workflow/historical/stage12_workflow_history.json','utf8'));
const section=spec.sections?.runtime_implementation_plan_operator_approval;
const historical=history.sections?.runtime_implementation_plan_operator_approval;
const ok=
  section?.status==='plan_approved_for_execution_package_preparation_no_runtime_change' &&
  section?.policy==='_workflow/policies/p32.json' &&
  section?.artifact==='_workflow/longterm/stage12_step32_runtime_implementation_plan_operator_approval.md' &&
  section?.smoke==='_tests/smoke_runtime_implementation_plan_operator_approval.js' &&
  historical?.status==='plan_approved_for_execution_package_preparation_no_runtime_change' &&
  historical?.artifact==='_workflow/longterm/stage12_step32_runtime_implementation_plan_operator_approval.md' &&
  historical?.next_planned_step==='stage12_step33_runtime_execution_package_no_apply';
console.log(JSON.stringify({ok},null,2));
if(!ok)process.exit(1);

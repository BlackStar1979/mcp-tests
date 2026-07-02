const fs=require('fs');
const spec=JSON.parse(fs.readFileSync('SERVER_DECISION_RUNTIME_SPEC.json','utf8'));
const history=JSON.parse(fs.readFileSync('_workflow/historical/stage12_workflow_history.json','utf8'));
const section=spec.sections?.runtime_implementation_plan_no_code;
const historical=history.sections?.runtime_implementation_plan_no_code;
const ok=
  section?.status==='implementation_plan_written_no_runtime_change' &&
  section?.policy==='_workflow/policies/p31.json' &&
  section?.artifact==='_workflow/longterm/stage12_step31_runtime_implementation_plan_no_code.md' &&
  section?.smoke==='_tests/smoke_runtime_implementation_plan_no_code.js' &&
  historical?.status==='implementation_plan_written_no_runtime_change' &&
  historical?.artifact==='_workflow/longterm/stage12_step31_runtime_implementation_plan_no_code.md' &&
  historical?.next_planned_step==='stage12_step32_runtime_implementation_plan_operator_approval';
console.log(JSON.stringify({ok},null,2));
if(!ok)process.exit(1);

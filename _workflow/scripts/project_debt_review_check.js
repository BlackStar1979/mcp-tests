const fs=require('fs');
const spec=JSON.parse(fs.readFileSync('SERVER_DECISION_RUNTIME_SPEC.json','utf8'));
const history=JSON.parse(fs.readFileSync('_workflow/historical/stage12_workflow_history.json','utf8'));
const section=spec.sections?.project_debt_review_before_step34;
const historical=history.sections?.project_debt_review_before_step34;
const ok=
  section?.status==='project_debt_review_written_no_runtime_change' &&
  section?.policy==='_workflow/policies/p33a.json' &&
  section?.artifact==='_workflow/longterm/stage12_step33a_project_debt_review_before_step34.md' &&
  historical?.status==='project_debt_review_written_no_runtime_change' &&
  historical?.artifact==='_workflow/longterm/stage12_step33a_project_debt_review_before_step34.md' &&
  historical?.next_planned_step==='stage12_step33b_pre_step34_debt_reduction_plan_no_runtime_change';
console.log(JSON.stringify({ok},null,2));
if(!ok)process.exit(1);

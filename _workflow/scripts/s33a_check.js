const fs=require('fs');
const d=fs.readFileSync('_workflow/longterm/stage12_step33a_project_debt_review_before_step34.md','utf8');
const p=require('../policies/p33a.json');
const s=JSON.parse(fs.readFileSync('_workflow/state.json','utf8'));
let ok=d.includes('PROJECT DEBT REVIEW WRITTEN')&&d.includes('P0 - Fix before Step 34')&&d.includes('stage12_step33b_pre_step34_debt_reduction_plan_no_runtime_change')&&p.debt_review===true&&p.runtime===false&&s.last_validation?.stage12_step33a_project_debt_review_before_step34==='ok';
console.log(JSON.stringify({ok},null,2));
if(!ok)process.exit(1);

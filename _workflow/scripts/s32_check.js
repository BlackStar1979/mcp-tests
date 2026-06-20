const fs=require('fs');
const d=fs.readFileSync('_workflow/longterm/stage12_step32_runtime_implementation_plan_operator_approval.md','utf8');
const p=require('../policies/p32.json');
const s=JSON.parse(fs.readFileSync('_workflow/state.json','utf8'));
let ok=d.includes('PLAN APPROVED FOR EXECUTION PACKAGE PREPARATION')&&d.includes('stage12_step33_runtime_execution_package_no_apply')&&p.plan_approved===true&&p.prepare_execution_package===true&&p.runtime===false&&s.last_validation?.stage12_step32_runtime_implementation_plan_operator_approval==='ok';
console.log(JSON.stringify({ok},null,2));
if(!ok)process.exit(1);

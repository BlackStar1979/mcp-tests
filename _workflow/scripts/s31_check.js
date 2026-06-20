const fs=require('fs');
const d=fs.readFileSync('_workflow/longterm/stage12_step31_runtime_implementation_plan_no_code.md','utf8');
const p=require('../policies/p31.json');
const s=JSON.parse(fs.readFileSync('_workflow/state.json','utf8'));
let ok=d.includes('IMPLEMENTATION PLAN WRITTEN')&&d.includes('stage12_step32_runtime_implementation_plan_operator_approval')&&p.plan===true&&p.runtime===false&&s.last_validation?.stage12_step31_runtime_implementation_plan_no_code==='ok';
console.log(JSON.stringify({ok},null,2));
if(!ok)process.exit(1);

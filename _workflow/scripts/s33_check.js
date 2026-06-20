const fs=require('fs');
const d=fs.readFileSync('_workflow/longterm/stage12_step33_runtime_execution_package_no_apply.md','utf8');
const p=require('../policies/p33.json');
const s=JSON.parse(fs.readFileSync('_workflow/state.json','utf8'));
let ok=d.includes('EXECUTION PACKAGE WRITTEN')&&d.includes('stage12_step34_runtime_execution_package_operator_approval')&&d.includes('Patch 1')&&d.includes('Patch 5')&&p.execution_package===true&&p.apply===false&&p.runtime===false&&s.last_validation?.stage12_step33_runtime_execution_package_no_apply==='ok';
console.log(JSON.stringify({ok},null,2));
if(!ok)process.exit(1);

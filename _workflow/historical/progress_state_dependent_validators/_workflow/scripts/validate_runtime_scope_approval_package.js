#!/usr/bin/env node
'use strict';
const fs=require('fs');
const { loadCombinedServerSpec } = require('./load_server_specs');
const spec=process.argv[2]?JSON.parse(fs.readFileSync(process.argv[2],'utf8')):loadCombinedServerSpec();
const state=JSON.parse(fs.readFileSync(process.argv[3]||'_workflow/state.json','utf8'));
const e=[]; const b=(o,k,v,n)=>{if(!o||o[k]!==v)e.push(n+'.'+k+' must be '+v)};
const q=(o,k,v,n)=>{if(!o||o[k]!==v)e.push(n+'.'+k+' must be '+JSON.stringify(v))};
const p=spec.decision_runtime_scope_approval_package||{};
q(p,'status','scope_package_written_no_runtime_change','scope');
b(p,'scope_package_written',true,'scope');
b(p,'runtime_change_authorized',false,'scope');
b(p,'runtime_change_allowed_next',false,'scope');
b(p,'server_runtime_integrated',false,'scope');
b(p,'mcp_tool_exposed',false,'scope');
b(p,'connector_visible_change_allowed',false,'scope');
if(!Array.isArray(p.candidate_files)||p.candidate_files.length!==7)e.push('scope.candidate_files must have 7 items');
if(Array.isArray(p.candidate_files)&&!p.candidate_files.every(x=>x.approved_for_change_now===false))e.push('all candidate files must remain unapproved');
const allowed=['stage12_step30_runtime_scope_operator_approval_decision','stage12_step31_runtime_implementation_plan_no_code'];
if(p.next_planned_step!=='stage12_step30_runtime_scope_operator_approval_decision'&&!allowed.includes(p.next_planned_step))e.push('unexpected scope next step');
const cur=state.current_work_package||{}; const prev=state.previous_work_package||{}; const done=Array.isArray(state.completed_work_packages)?state.completed_work_packages:[];
if(cur.id!=='stage12_step29_decision_runtime_patch_scope_approval_package'&&prev.id!=='stage12_step29_decision_runtime_patch_scope_approval_package'&&!done.some(x=>x.id==='stage12_step29_decision_runtime_patch_scope_approval_package'))e.push('state must retain Step 29 as current previous or completed');
if(cur.id==='stage12_step29_decision_runtime_patch_scope_approval_package'){b(cur,'runtime_code_changed',false,'current');b(cur,'restart_pending',false,'current');const a=cur.acceptance||{};b(a,'scope_package_written',true,'acceptance');b(a,'runtime_change_authorized',false,'acceptance');b(a,'runtime_change_allowed_next',false,'acceptance');q(a,'next_planned_step','stage12_step30_runtime_scope_operator_approval_decision','acceptance')}
if(state.last_validation?.stage12_step29_runtime_scope_approval_package!=='ok')e.push('last_validation.stage12_step29_runtime_scope_approval_package must be ok');
const out={ok:e.length===0,status:p.status,runtime_change_authorized:p.runtime_change_authorized===true,runtime_change_allowed_next:p.runtime_change_allowed_next===true,candidate_file_count:Array.isArray(p.candidate_files)?p.candidate_files.length:0,errors:e};
console.log(JSON.stringify(out,null,2));if(!out.ok)process.exit(1);

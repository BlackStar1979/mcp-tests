#!/usr/bin/env node
'use strict';
const fs=require('fs');
const { loadCombinedServerSpec } = require('./load_server_specs');
const spec=process.argv[2]?JSON.parse(fs.readFileSync(process.argv[2],'utf8')):loadCombinedServerSpec();
const state=JSON.parse(fs.readFileSync(process.argv[3]||'_workflow/state.json','utf8'));
const e=[]; const b=(o,k,v,n)=>{if(!o||o[k]!==v)e.push(n+'.'+k+' must be '+v)};
const q=(o,k,v,n)=>{if(!o||o[k]!==v)e.push(n+'.'+k+' must be '+JSON.stringify(v))};
const d=spec.decision_runtime_scope_operator_decision||{};
q(d,'status','scope_approved_for_implementation_planning_only','decision');
b(d,'scope_decision_recorded',true,'decision');
b(d,'scope_approved_for_implementation_planning',true,'decision');
b(d,'runtime_change_authorized',false,'decision');
b(d,'runtime_change_allowed_next',false,'decision');
b(d,'direct_runtime_implementation_allowed',false,'decision');
b(d,'server_runtime_integrated',false,'decision');
b(d,'mcp_tool_exposed',false,'decision');
b(d,'connector_visible_change_allowed',false,'decision');
if(!Array.isArray(d.candidate_files)||d.candidate_files.length!==7)e.push('decision.candidate_files must have 7 items');
if(Array.isArray(d.candidate_files)&&!d.candidate_files.every(x=>x.approved_for_change_now===false&&x.approved_for_planning_scope===true))e.push('candidate files must be planning-only');
q(d,'next_planned_step','stage12_step31_runtime_implementation_plan_no_code','decision');
const c=state.current_work_package||{};const prev=state.previous_work_package||{};const done=Array.isArray(state.completed_work_packages)?state.completed_work_packages:[];
if(c.id!=='stage12_step30_runtime_scope_operator_approval_decision'&&prev.id!=='stage12_step30_runtime_scope_operator_approval_decision'&&!done.some(x=>x.id==='stage12_step30_runtime_scope_operator_approval_decision'))e.push('state must retain Step 30 as current previous or completed');
if(c.id==='stage12_step30_runtime_scope_operator_approval_decision'){b(c,'runtime_code_changed',false,'current');b(c,'restart_pending',false,'current');const a=c.acceptance||{};b(a,'scope_decision_recorded',true,'acceptance');b(a,'scope_approved_for_implementation_planning',true,'acceptance');b(a,'runtime_change_authorized',false,'acceptance');b(a,'runtime_change_allowed_next',false,'acceptance');q(a,'next_planned_step','stage12_step31_runtime_implementation_plan_no_code','acceptance');}
if(state.last_validation?.stage12_step30_runtime_scope_operator_decision!=='ok')e.push('last_validation.stage12_step30_runtime_scope_operator_decision must be ok');
const out={ok:e.length===0,status:d.status,planning_scope:d.scope_approved_for_implementation_planning===true,runtime_change_authorized:d.runtime_change_authorized===true,runtime_change_allowed_next:d.runtime_change_allowed_next===true,candidate_file_count:Array.isArray(d.candidate_files)?d.candidate_files.length:0,errors:e};
console.log(JSON.stringify(out,null,2));if(!out.ok)process.exit(1);

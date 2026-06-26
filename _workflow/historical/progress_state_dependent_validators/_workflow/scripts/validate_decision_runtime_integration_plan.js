#!/usr/bin/env node
'use strict';
const fs=require('fs');
const { loadCombinedServerSpec } = require('./load_server_specs');
const path=require('path');
const root=process.cwd();
const spec=process.argv[2]?JSON.parse(fs.readFileSync(process.argv[2],'utf8')):loadCombinedServerSpec();
const state=JSON.parse(fs.readFileSync(process.argv[3]||'_workflow/state.json','utf8'));
const errors=[];
function fail(x){errors.push(x)}
function b(o,k,v,n){if(!o||o[k]!==v)fail(n+'.'+k+' must be '+v)}
function q(o,k,v,n){if(!o||o[k]!==v)fail(n+'.'+k+' must be '+JSON.stringify(v))}
function f(p,n){if(typeof p!=='string'||!p||path.isAbsolute(p)||p.includes('..')||!fs.existsSync(path.join(root,p)))fail((n||p)+' must exist')}
function bak(p,n){if(typeof p!=='string'||!p.startsWith('_workflow/control_plane/snapshots/'))fail((n||p)+' must be snapshot');else f(p,n)}
const rb=spec.runtime_boundary||{};['runtime_behavior_changed','server_js_changed','tools_list_changed','fingerprints_changed','restart_required','connector_refresh_required'].forEach(k=>b(rb,k,false,'runtime_boundary'));
const ready=spec.decision_runtime_interface_contract_readiness_gate||{};q(ready,'status','passed_for_runtime_integration_planning_only','readiness_gate');
const plan=spec.decision_runtime_integration_plan||{};q(plan,'status','plan_written_not_implemented','plan');q(plan,'mode','integration_plan_only_no_runtime_change','plan');['runtime_behavior_changed','server_runtime_integrated','mcp_tool_exposed','connector_visible_change_allowed'].forEach(k=>b(plan,k,false,'plan'));b(plan,'operator_approval_required_before_runtime_patch',true,'plan');b(plan,'restart_plan_required_before_runtime_patch',true,'plan');b(plan,'connector_refresh_plan_required_before_surface_change',true,'plan');
const pts=Array.isArray(plan.integration_points)?plan.integration_points:[];['src/runtime/mcp_entry_dispatcher.js','src/runtime/rpc_message_dispatcher.js','src/runtime/tools_call_handler.js','src/runtime/tools_list_message_handler.js','src/runtime/unknown_tool_call_handler.js','src/runtime/tool_audit_helpers.js','src/runtime/audit_log.js'].forEach(p=>{if(!pts.some(x=>x.file===p))fail('missing integration point '+p);f(p,p)});pts.forEach(x=>{q(x,'inspection_mode','read_only_verified','integration_point');b(x,'modified_in_step27',false,'integration_point')});
const controls=plan.controls||{};['fail_closed_default_deny','deny_unknown_tool_before_handler_fallback','audit_receipt_required_for_allow_and_deny','no_descriptor_only_bypass','no_connector_visible_change_without_operator_refresh_plan','no_secret_material_in_audit','preserve_public_fallback_port_3009','preserve_tool_count_and_hash_until_explicit_surface_change'].forEach(k=>b(controls,k,true,'controls'));
const next=plan.next_gate||{};if(!['stage12_step28_decision_runtime_integration_plan_validator_or_operator_approval_gate','stage12_step29_decision_runtime_patch_scope_approval_package'].includes(next.next_planned_step))fail('unexpected plan next step');b(next,'runtime_patch_allowed_next',false,'next_gate');b(next,'operator_approval_required',true,'next_gate');f(plan.tool,'plan validator');f(plan.smoke,'plan smoke');
const cur=state.current_work_package||{};const prev=state.previous_work_package||{};const done=Array.isArray(state.completed_work_packages)?state.completed_work_packages:[];if(cur.id!=='stage12_step27_decision_runtime_integration_plan'&&prev.id!=='stage12_step27_decision_runtime_integration_plan'&&!done.some(x=>x.id==='stage12_step27_decision_runtime_integration_plan'))fail('state must retain Step 27 as current previous or completed');
if(cur.id==='stage12_step27_decision_runtime_integration_plan'){q(cur,'status','frozen','current');b(cur,'runtime_code_changed',false,'current');b(cur,'restart_pending',false,'current');f(cur.canonical_plan,'current plan');const a=cur.acceptance||{};b(a,'decision_runtime_integration_plan_written',true,'acceptance');b(a,'integration_points_read_only_inspected',true,'acceptance');b(a,'runtime_implemented',false,'acceptance');b(a,'server_runtime_integrated',false,'acceptance');b(a,'mcp_tool_exposed',false,'acceptance');b(a,'connector_visible_change_allowed',false,'acceptance');bak(a.pre_work_snapshot,'pre snapshot');if(a.post_work_backup!=='pending')bak(a.post_work_backup,'post snapshot')}
if(prev.id==='stage12_step27_decision_runtime_integration_plan')bak(prev.backup,'previous backup');
if(!Array.isArray(state.validation_evidence)||!state.validation_evidence.some(x=>x.id==='stage12_step27_decision_runtime_integration_plan_pass'))fail('missing Step 27 evidence');
f('_workflow/longterm/stage12_step27_decision_runtime_integration_plan.md');f('_workflow/policies/stage12_step27_decision_runtime_integration_plan_v0.json');
if(state.last_validation?.decision_runtime_integration_plan!=='ok')fail('last_validation.decision_runtime_integration_plan must be ok');
const out={ok:errors.length===0,plan_status:plan.status,integration_point_count:pts.length,runtime_patch_allowed_next:next.runtime_patch_allowed_next===true,operator_approval_required:next.operator_approval_required===true,runtime_behavior_changed:plan.runtime_behavior_changed===true,server_runtime_integrated:plan.server_runtime_integrated===true,mcp_tool_exposed:plan.mcp_tool_exposed===true,connector_visible_change_allowed:plan.connector_visible_change_allowed===true,errors,warnings:[]};
console.log(JSON.stringify(out,null,2));if(!out.ok)process.exit(1);

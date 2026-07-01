#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const { loadCombinedServerSpec } = require("./load_server_specs");

const spec=process.argv[2]?JSON.parse(fs.readFileSync(process.argv[2],"utf8")):loadCombinedServerSpec();
const state=JSON.parse(fs.readFileSync(process.argv[3]||"_workflow/state.json","utf8"));
const history=JSON.parse(fs.readFileSync("_workflow/historical/stage12_workflow_history.json","utf8"));
const e=[];
const b=(o,k,v,n)=>{if(!o||o[k]!==v)e.push(n+"."+k+" must be "+v);};
const q=(o,k,v,n)=>{if(!o||o[k]!==v)e.push(n+"."+k+" must be "+JSON.stringify(v));};
const d=spec.decision_runtime_scope_operator_decision||{};
const historical=history.sections?.decision_runtime_scope_operator_decision||{};

q(d,"status","scope_approved_for_implementation_planning_only","decision");
b(d,"scope_decision_recorded",true,"decision");
b(d,"scope_approved_for_implementation_planning",true,"decision");
b(d,"runtime_change_authorized",false,"decision");
b(d,"runtime_change_allowed_next",false,"decision");
b(d,"direct_runtime_implementation_allowed",false,"decision");
b(d,"server_runtime_integrated",false,"decision");
b(d,"mcp_tool_exposed",false,"decision");
b(d,"connector_visible_change_allowed",false,"decision");
if(!Array.isArray(d.candidate_files)||d.candidate_files.length!==7)e.push("decision.candidate_files must have 7 items");
if(Array.isArray(d.candidate_files)&&!d.candidate_files.every(x=>x.approved_for_change_now===false&&x.approved_for_planning_scope===true))e.push("candidate files must be planning-only");
if(d.smoke!=="_tests/smoke_runtime_scope_operator_decision.js")e.push("decision.smoke path mismatch");
q(historical,"status","scope_approved_for_implementation_planning_only","historical");

if(state.status!=="compact_orientation_map_not_progress_log")e.push("state.status must remain compact_orientation_map_not_progress_log");

const out={ok:e.length===0,status:d.status,planning_scope:d.scope_approved_for_implementation_planning===true,runtime_change_authorized:d.runtime_change_authorized===true,runtime_change_allowed_next:d.runtime_change_allowed_next===true,candidate_file_count:Array.isArray(d.candidate_files)?d.candidate_files.length:0,errors:e};
console.log(JSON.stringify(out,null,2));
if(!out.ok)process.exit(1);

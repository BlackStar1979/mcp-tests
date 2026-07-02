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
const p=spec.decision_runtime_scope_approval_package||{};
const historical=history.sections?.decision_runtime_scope_approval_package||{};

q(p,"status","scope_package_written_no_runtime_change","scope");
b(p,"scope_package_written",true,"scope");
b(p,"runtime_change_authorized",false,"scope");
b(p,"runtime_change_allowed_next",false,"scope");
b(p,"server_runtime_integrated",false,"scope");
b(p,"mcp_tool_exposed",false,"scope");
b(p,"connector_visible_change_allowed",false,"scope");
if(!Array.isArray(p.candidate_files)||p.candidate_files.length!==7)e.push("scope.candidate_files must have 7 items");
if(Array.isArray(p.candidate_files)&&!p.candidate_files.every(x=>x.approved_for_change_now===false))e.push("all candidate files must remain unapproved");
if(p.smoke!=="_tests/smoke_runtime_scope_approval_package.js")e.push("scope.smoke path mismatch");
q(historical,"status","scope_package_written_no_runtime_change","historical");

if(state.status!=="compact_orientation_map_not_progress_log")e.push("state.status must remain compact_orientation_map_not_progress_log");

const out={ok:e.length===0,status:p.status,runtime_change_authorized:p.runtime_change_authorized===true,runtime_change_allowed_next:p.runtime_change_allowed_next===true,candidate_file_count:Array.isArray(p.candidate_files)?p.candidate_files.length:0,errors:e};
console.log(JSON.stringify(out,null,2));
if(!out.ok)process.exit(1);

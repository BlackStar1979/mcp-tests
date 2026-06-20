"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
function read(p){return JSON.parse(fs.readFileSync(p,"utf8"));}
const tools=read("SERVER_TOOLS_SPEC.json");
const res=read("SERVER_RESOURCE_POLICY_SPEC.json");
const cata=tools.tool_catalog;
function expect(name,meta){
  const got=cata[name];
  assert.ok(got,name+" missing");
  for(const [k,v] of Object.entries(meta))assert.equal(got[k],v,name+"."+k);
  assert.ok(res.resource_classes[got.resource_class],name+" resource_class declared");
  assert.ok(res.operation_classes[got.operation_class],name+" operation_class declared");
}
expect("memory_get_state",{tool_category:"memory",resource_class:"memory_context_scoped",operation_class:"read"});
expect("memory_search",{tool_category:"memory",resource_class:"memory_context_scoped",operation_class:"search"});
expect("memory_get_tasks",{tool_category:"memory",resource_class:"memory_context_scoped",operation_class:"task_list"});
expect("memory_save",{tool_category:"memory",resource_class:"memory_context_scoped",operation_class:"write"});
expect("memory_set_state",{tool_category:"memory",resource_class:"memory_context_scoped",operation_class:"state_update"});
expect("memory_create_task",{tool_category:"memory",resource_class:"memory_context_scoped",operation_class:"task_create"});
expect("plugin_catalog_describe",{tool_category:"plugin_registry",resource_class:"plugin_registry_readonly",operation_class:"read"});
expect("plugin_catalog_search",{tool_category:"plugin_registry",resource_class:"plugin_registry_readonly",operation_class:"search"});
expect("plugin_registry_list",{tool_category:"plugin_registry",resource_class:"plugin_registry_readonly",operation_class:"list"});
expect("plugin_registry_audit",{tool_category:"plugin_registry",resource_class:"plugin_registry_readonly",operation_class:"audit"});
expect("plugin_visibility_plan",{tool_category:"hotplug",resource_class:"plugin_visibility_state_preview",operation_class:"plan"});
expect("plugin_execution_preflight",{tool_category:"plugin_execution",resource_class:"plugin_execution_readonly",operation_class:"preflight"});
expect("plugin_execution_verify_receipt",{tool_category:"plugin_execution",resource_class:"plugin_execution_readonly",operation_class:"verify_receipt"});
expect("plugin_execute_readonly",{tool_category:"plugin_execution",resource_class:"plugin_execution_readonly",operation_class:"readonly_execute"});
expect("net_check_url_head",{tool_category:"network",resource_class:"network_allowlisted",operation_class:"head"});
expect("net_check_npm_package",{tool_category:"network",resource_class:"network_allowlisted",operation_class:"metadata"});
expect("fs_list_public",{tool_category:"filesystem",resource_class:"filesystem_public",operation_class:"list"});
expect("fs_get_public_info",{tool_category:"filesystem",resource_class:"filesystem_public",operation_class:"stat"});
expect("dev_code_symbols",{tool_category:"code_analysis",resource_class:"filesystem_workspace_readonly",operation_class:"analyze"});
for(const [name,item] of Object.entries(cata)){
  assert.ok(item.resource_policy_refs.includes("SERVER_RESOURCE_POLICY_SPEC.json"),name+" resource policy ref");
  assert.equal(typeof item.audit_required,"boolean",name+" audit flag");
}
console.log("smoke_stage12_tool_catalog_semantics ok");

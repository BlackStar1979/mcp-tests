"use strict";
const assert=require("node:assert/strict");
const spec=require("../SERVER_TOOLS_SPEC.json");
const pol=require("../src/tool_policy");
const pub=spec.surface_classes.public_mcp_tools;
const aut=spec.surface_classes.authorized_mcp_tools;
const restricted=spec.surface_classes.restricted_core_tools;
const sampler=["code","sample","js"].join("_");
assert.deepEqual([...pub.tools].sort(),[...pol.PUBLIC_TOOL_NAMES].sort());
assert.equal(pub.tool_count,pol.PUBLIC_TOOL_NAMES.length);
assert.equal(pub.tools.includes(sampler),false);
assert.equal(pub.tools.includes(sampler),false);
assert.equal(aut.tools.includes(sampler),true);
assert.equal(restricted.tools.includes(sampler),false);
for(const n of pub.tools){ const p=pol.getToolPolicy(n); assert.ok(p,`${n} policy`); assert.equal(p.public_safe,true,`${n} public_safe`); if(p.uses_fs) assert.equal(p.fs_scope,"public-fs-sandbox",`${n} fs scope`); }
for(const n of pol.AUTHORIZED_MCP_TOOL_NAMES) assert.ok(aut.tools.includes(n),`${n} authorized spec`);
console.log("smoke_stage12_connector_surface_split_guard ok");

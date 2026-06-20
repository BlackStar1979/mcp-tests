"use strict";
const assert=require("node:assert/strict");
const childProcess=require("node:child_process");
const fs=require("node:fs");
const path=require("node:path");
const ROOT=path.resolve(__dirname,"..");
function read(rel){return fs.readFileSync(path.join(ROOT,rel),"utf8");}
function check(rel){const r=childProcess.spawnSync(process.execPath,["--check",rel],{cwd:ROOT,encoding:"utf8"});assert.equal(r.status,0,rel+" syntax check failed");}
check("src/runtime/optional_tools_assembly.js");
const server=read("server.js");
const assembly=read("src/runtime/optional_tools_assembly.js");
const bootstrap = read("src/runtime/server_bootstrap_runtime.js");
assert.ok(server.includes("./src/runtime/server_bootstrap_runtime"));
assert.ok(bootstrap.includes("./optional_tools_assembly"));
assert.ok(bootstrap.includes("configureOptionalToolsAssembly({"));
for(const stale of ["./tools/authorized/test_mcp_runtime_status","./tools/authorized/observability_status","const { createOptionalToolLookup } = require(\"./src/runtime/optional_tools\");","./src/tool_loader","loadOptionalTools({","createOptionalToolLookup(OPTIONAL_TOOLS)","createTestMcpRuntimeStatusTool(getRuntimeStatus)","createObservabilityStatusTool({ runtimeStatusProvider: getRuntimeStatus"]){assert.equal(server.includes(stale),false,stale);}
for(const required of ["createTestMcpRuntimeStatusTool","createObservabilityStatusTool","loadOptionalTools","createOptionalToolLookup","function configureOptionalToolsAssembly","optionalTools.push"]){assert.ok(assembly.includes(required),required);}
const mod=require("../src/runtime/optional_tools_assembly");
assert.equal(typeof mod.configureOptionalToolsAssembly,"function");
console.log("smoke_stage12_step38v_optional_tools_assembly ok");

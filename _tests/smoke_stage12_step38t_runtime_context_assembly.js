"use strict";
const assert=require("node:assert/strict");
const childProcess=require("node:child_process");
const fs=require("node:fs");
const path=require("node:path");
const ROOT=path.resolve(__dirname,"..");
function read(rel){return fs.readFileSync(path.join(ROOT,rel),"utf8");}
function check(rel){const r=childProcess.spawnSync(process.execPath,["--check",rel],{cwd:ROOT,encoding:"utf8"});assert.equal(r.status,0,rel+" syntax check failed");}
check("server.js");
check("src/runtime/runtime_context_assembly.js");
const server=read("server.js");
const assembly=read("src/runtime/runtime_context_assembly.js");
const bootstrap = read("src/runtime/server_bootstrap_runtime.js");
assert.ok(server.includes("./src/runtime/server_bootstrap_runtime"));
assert.ok(bootstrap.includes("./runtime_context_assembly"));
for(const stale of ["./src/runtime/mcp_runtime_handlers","./src/runtime/server_lifecycle","createMcpRuntimeHandlers({","runServerLifecycle({"]){assert.equal(server.includes(stale),false,stale);}
assert.ok(bootstrap.includes("runConfiguredRuntime({"));
for(const required of ["createMcpRuntimeHandlers","runServerLifecycle","function runConfiguredRuntime","selfTestContext","startupContext","bootstrapAuthMode: bootstrapConfig.authMode"]){assert.ok(assembly.includes(required),required);}
const { runConfiguredRuntime }=require("../src/runtime/runtime_context_assembly");
assert.equal(typeof runConfiguredRuntime,"function");
console.log("smoke_stage12_step38t_runtime_context_assembly ok");

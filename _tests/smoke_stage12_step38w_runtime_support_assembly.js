"use strict";
const assert=require("node:assert/strict");
const childProcess=require("node:child_process");
const fs=require("node:fs");
const path=require("node:path");
const ROOT=path.resolve(__dirname,"..");
function read(rel){return fs.readFileSync(path.join(ROOT,rel),"utf8");}
function check(rel){const r=childProcess.spawnSync(process.execPath,["--check",rel],{cwd:ROOT,encoding:"utf8"});assert.equal(r.status,0,rel+" syntax check failed");}
check("server.js");
check("src/runtime/runtime_support_assembly.js");
check("src/runtime/server_bootstrap_runtime.js");
const server=read("server.js");
const bootstrap=read("src/runtime/server_bootstrap_runtime.js");
const support=read("src/runtime/runtime_support_assembly.js");
assert.ok(server.includes("./src/runtime/server_bootstrap_runtime"));
assert.ok(bootstrap.includes("./runtime_support_assembly"));
assert.ok(bootstrap.includes("createRuntimeSupportAssembly({"));
for(const stale of ["./src/runtime/core_tool_descriptors","./src/runtime/document_runtime_context","./src/runtime/audit_log","createAuditLogger({","createDocumentRuntimeContext({","function toolsList()","buildCoreToolDescriptors({"]){assert.equal(server.includes(stale),false,stale);}
for(const required of ["buildCoreToolDescriptors","createAuditLogger","createDocumentRuntimeContext","function createRuntimeSupportAssembly","function toolsList","return baseTools.concat"]){assert.ok(support.includes(required),required);}
const mod=require("../src/runtime/runtime_support_assembly");
assert.equal(typeof mod.createRuntimeSupportAssembly,"function");
console.log("smoke_stage12_step38w_runtime_support_assembly ok");

"use strict";
const assert=require("node:assert/strict");
const childProcess=require("node:child_process");
const fs=require("node:fs");
const path=require("node:path");
const ROOT=path.resolve(__dirname,"..");
function read(rel){return fs.readFileSync(path.join(ROOT,rel),"utf8");}
function check(rel){const r=childProcess.spawnSync(process.execPath,["--check",rel],{cwd:ROOT,encoding:"utf8"});assert.equal(r.status,0,rel+" syntax check failed");}
check("server.js");
check("src/runtime/runtime_status_assembly.js");
const server=read("server.js");
const assembly=read("src/runtime/runtime_status_assembly.js");
const bootstrap = read("src/runtime/server_bootstrap_runtime.js");
assert.ok(server.includes("./src/runtime/server_bootstrap_runtime"));
assert.ok(bootstrap.includes("./runtime_status_assembly"));
assert.ok(bootstrap.includes("createRuntimeStatusAssembly({"));
for(const stale of ["createRuntimeStatusProvider({","buildSecurityBoundary","assertToolSchemas","buildToolSurfaceFingerprint","buildRuntimeIdentity","buildToolLabelsSync","getAllowedDomains","getPublicFsRoot","assertProfilePolicy","summarizeToolPolicies","envFlagEnabled"]){assert.equal(server.includes(stale),false,stale);}
for(const required of ["createRuntimeStatusProvider","buildSecurityBoundary","assertToolSchemas","buildToolSurfaceFingerprint","buildRuntimeIdentity","buildToolLabelsSync","getAllowedDomains","getPublicFsRoot","assertProfilePolicy","summarizeToolPolicies","envFlagEnabled","function createRuntimeStatusAssembly"]){assert.ok(assembly.includes(required),required);}
const { createRuntimeStatusAssembly }=require("../src/runtime/runtime_status_assembly");
assert.equal(typeof createRuntimeStatusAssembly,"function");
console.log("smoke_runtime_status_assembly ok");

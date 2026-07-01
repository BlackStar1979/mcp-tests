"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const childProcess=require("node:child_process");
const check=(rel)=>{const r=childProcess.spawnSync(process.execPath,["--check",rel],{cwd:require("node:path").resolve(__dirname,".."),encoding:"utf8"});assert.equal(r.status,0,rel+" syntax check failed");};
check("server.js");
check("src/runtime/server_lifecycle.js");
const server=fs.readFileSync(require("node:path").join(__dirname,"..","server.js"),"utf8");
const bootstrap=fs.readFileSync(require("node:path").join(__dirname,"..","src","runtime","server_bootstrap_runtime.js"),"utf8");
assert.ok(server.includes("./src/runtime/server_bootstrap_runtime"));
assert.ok(bootstrap.includes("./runtime_context_assembly"));
assert.equal(server.includes("./src/runtime/server_lifecycle"), false);
for(const stale of ["if (BOOTSTRAP_CONFIG.selfTest)","runConnectorShapeSelfTest({","startServer({","buildStartupReport({","const server = createServer({"]){assert.equal(server.includes(stale),false,stale);}
const lifecycle=require("../src/runtime/server_lifecycle");
assert.equal(typeof lifecycle.runServerLifecycle,"function");
assert.equal(typeof lifecycle.runSelfTestBranch,"function");
assert.equal(typeof lifecycle.startRuntimeServer,"function");
console.log("smoke_lifecycle ok");

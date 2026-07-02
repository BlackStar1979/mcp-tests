"use strict";
const assert=require("node:assert/strict");
const childProcess=require("node:child_process");
const fs=require("node:fs");
const path=require("node:path");
const ROOT=path.resolve(__dirname,"..");
function read(rel){return fs.readFileSync(path.join(ROOT,rel),"utf8");}
function check(rel){const r=childProcess.spawnSync(process.execPath,["--check",rel],{cwd:ROOT,encoding:"utf8"});assert.equal(r.status,0,rel+" syntax check failed: "+r.stderr);}
check("server.js");
check("src/runtime/server_bootstrap_runtime.js");
const server=read("server.js");
const bootstrap=read("src/runtime/server_bootstrap_runtime.js");
assert.ok(server.includes("./src/runtime/server_bootstrap_runtime"));
assert.ok(server.includes("runServerBootstrapRuntime({"));
for(const stale of [
  "createAuthPolicy",
  "assertSecurityBoundary",
  "resolveAuthBootstrapConfig",
  "parseServerCliArgs",
  "loadServerProfileConfig",
  "createRuntimeStatusAssembly",
  "createRuntimeSupportAssembly",
  "configureOptionalToolsAssembly",
  "runConfiguredRuntime",
  "VALID_OUTPUT_MODES",
  "MAX_FETCH_TEXT_CHARS",
  "AUDIT_LOG_PATH",
  "OPTIONAL_TOOLS",
  "BOOTSTRAP_CONFIG",
  "SERVER_PROFILE_CONFIG",
  "AUTH_POLICY",
  "SECURITY_BOUNDARY"
]){assert.equal(server.includes(stale),false,stale);}
for(const required of [
  "function runServerBootstrapRuntime",
  "parseServerCliArgs(argv.slice(2))",
  "resolveAuthBootstrapConfig({",
  "loadServerProfileConfig({",
  "env.MCP_TEST_PROFILE = runtimeProfileFromAuth",
  "createAuthPolicy({",
  "assertSecurityBoundary({",
  "createRuntimeSupportAssembly({",
  "createRuntimeStatusAssembly({",
  "configureOptionalToolsAssembly({",
  "runConfiguredRuntime({",
  "module.exports"
]){assert.ok(bootstrap.includes(required),required);}
const mod=require("../src/runtime/server_bootstrap_runtime");
assert.equal(typeof mod.runServerBootstrapRuntime,"function");
console.log("smoke_server_bootstrap_runtime ok");

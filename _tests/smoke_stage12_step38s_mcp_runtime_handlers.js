"use strict";
const assert=require("node:assert/strict");
const childProcess=require("node:child_process");
const fs=require("node:fs");
const path=require("node:path");
const ROOT=path.resolve(__dirname,"..");
function read(rel){return fs.readFileSync(path.join(ROOT,rel),"utf8");}
function check(rel){const r=childProcess.spawnSync(process.execPath,["--check",rel],{cwd:ROOT,encoding:"utf8"});assert.equal(r.status,0,rel+" syntax check failed");}
check("server.js");
check("src/runtime/mcp_runtime_handlers.js");
const server=read("server.js");
const handlers=read("src/runtime/mcp_runtime_handlers.js");
const bootstrap = read("src/runtime/server_bootstrap_runtime.js");
assert.ok(server.includes("./src/runtime/server_bootstrap_runtime"));
assert.ok(bootstrap.includes("./runtime_context_assembly"));
assert.equal(server.includes("./src/runtime/mcp_runtime_handlers"), false);
for(const stale of ["async function handleRpcMessage","async function handleMcp","createRequestIdGenerator","buildRpcMessagePrelude","shouldReturnNoRpcResponse","dispatchRpcMessage","dispatchMcpEntry"]){assert.equal(server.includes(stale),false,stale);}
for(const required of ["dispatchMcpEntry","createRequestIdGenerator","buildRpcMessagePrelude","shouldReturnNoRpcResponse","dispatchRpcMessage","function createMcpRuntimeHandlers","async function handleRpcMessage","async function handleMcp"]){assert.ok(handlers.includes(required),required);}
const { createMcpRuntimeHandlers }=require("../src/runtime/mcp_runtime_handlers");
const audit=[];
const { handleRpcMessage }=createMcpRuntimeHandlers({serverName:"test",serverVersion:"0.0.0",connectorShapeVersion:"shape",outputMode:"structured",authPolicy:{mode:"none",authenticate(){return {ok:true};}},runtimeProfile:"public",toolsList:()=>[{name:"search",title:"Search"}],documentRuntimeContext:()=>({}),auditLog(event,fields){audit.push({event,fields});},getOptionalTool(){return null;}});
(async()=>{const ping=await handleRpcMessage({jsonrpc:"2.0",id:1,method:"ping"});assert.equal(ping.id,1);assert.ok(ping.result);const note=await handleRpcMessage({jsonrpc:"2.0",method:"notifications/initialized"});assert.equal(note,undefined);console.log("smoke_stage12_step38s_mcp_runtime_handlers ok");})().catch((error)=>{console.error(error&&error.stack||String(error));process.exit(1);});

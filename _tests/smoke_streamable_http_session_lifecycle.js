"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {dispatchMcpEntry}=require("../src/runtime/mcp_entry_dispatcher");
const {handleServerDiscoverMessage}=require("../src/runtime/server_discover_message_handler");

const ROOT=path.resolve(__dirname,"..");
const read=(rel)=>fs.readFileSync(path.join(ROOT,rel),"utf8");
const readJson=(rel)=>JSON.parse(read(rel));

function res(){return{statusCode:null,headers:{},body:"",setHeader(k,v){this.headers[k.toLowerCase()]=v;},writeHead(c,h){this.statusCode=c;Object.assign(this.headers,h||{});},end(x){if(x)this.body+=String(x);}}}
function req({headers={},body,method="POST"}){const chunks=[Buffer.from(body||"{}")] ;return{method,headers,on(e,cb){if(e==="data")chunks.forEach(c=>cb(c));if(e==="end")cb();return this;}}}
async function call({headers={},body,handler}){const r=res();const audits=[];await dispatchMcpEntry({req:req({headers,body}),res:r,requestId:"r",authPolicy:{mode:"none",authenticate:()=>({ok:true})},auditLog:(e,p)=>audits.push({e,p}),handleRpcMessage:handler,publicBaseUrl:"http://127.0.0.1/mcp"});return{r,audits};}
(async()=>{
 const record=read("_workflow/operator_decisions/keep_mcp_transport_session_retirement_package.md");
 const state=readJson("_workflow/state.json");
 const inventory=readJson("_workflow/sessionless_inventory.json");
 const runtimeSpec=readJson("SERVER_RUNTIME_CONFIG_SPEC.json");
 const index=read("_workflow/ACTIVE_WORKFLOW_INDEX.md");
 const canon=read("_workflow/WORKFLOW_CANON.md");
 const dispatcherSource=read("src/runtime/mcp_entry_dispatcher.js");
 const runtimeHandlersSource=read("src/runtime/mcp_runtime_handlers.js");
 const discoverSource=read("src/runtime/server_discover_message_handler.js");

 assert.ok(record.includes("Status: GREEN / RUNTIME + WORKFLOW UPDATED / RESTART NOT YET PERFORMED"));
 assert.equal(state.active_target_direction.transport_session_retirement_package_record,"_workflow/operator_decisions/keep_mcp_transport_session_retirement_package.md");
 assert.equal(inventory.active_target_contract.transport_session_retirement_package_record,"_workflow/operator_decisions/keep_mcp_transport_session_retirement_package.md");
 assert.equal(runtimeSpec.stable_mcp_request_contract_bridge.stable_protocol_sessions,false);
 assert.equal(runtimeSpec.stable_mcp_request_contract_bridge.initialize_creates_transport_session,false);
 assert.equal(runtimeSpec.stable_mcp_request_contract_bridge.mcp_session_header_ignored_on_stable_post,true);
 assert.ok(index.includes("keep_mcp_transport_session_retirement_package.md"));
 assert.ok(canon.includes("Transport-session retirement package clarification"));
 assert.equal(dispatcherSource.includes("session_created"),false);
 assert.equal(dispatcherSource.includes("Unknown session"),false);
 assert.equal(dispatcherSource.includes("Mcp-Session-Id"),false);
 assert.equal(runtimeHandlersSource.includes("createSessionStore"),false);
 assert.ok(discoverSource.includes('mode: "streamable_http_stateless_legacy_initialize_compat"'));
 assert.ok(discoverSource.includes("protocol_sessions: false"));

 const initBody=JSON.stringify({jsonrpc:"2.0",id:1,method:"initialize",params:{protocolVersion:"2025-06-18",capabilities:{sampling:{}}}});
 const init=await call({headers:{accept:"application/json"},body:initBody,handler:async(_p,ctx)=>({jsonrpc:"2.0",id:1,result:{protocolVersion:ctx.protocolVersion,sessionId:ctx.sessionId??null}})});
 assert.equal(init.r.statusCode,200);
 assert.equal(init.r.headers["mcp-session-id"],undefined);
 assert.equal(JSON.parse(init.r.body).result.protocolVersion,"2025-06-18");
 assert.equal(JSON.parse(init.r.body).result.sessionId,null);
 assert.equal(init.audits.some(x=>x.e==="session_created"),false);

 const ignored=await call({headers:{accept:"application/json","mcp-session-id":"mcp_unknown"},body:JSON.stringify({jsonrpc:"2.0",id:2,method:"ping",params:{}}),handler:async(_p,ctx)=>({jsonrpc:"2.0",id:2,result:{sid:ctx.sessionId??null,proto:ctx.protocolVersion}})});
 assert.equal(ignored.r.statusCode,200);
 assert.equal(JSON.parse(ignored.r.body).result.sid,null);
 assert.equal(JSON.parse(ignored.r.body).result.proto,"2025-03-26");

 const invalid=await call({headers:{accept:"application/json","mcp-session-id":"bad space"},body:JSON.stringify({jsonrpc:"2.0",id:3,method:"ping",params:{}}),handler:async(_p,ctx)=>({jsonrpc:"2.0",id:3,result:{sid:ctx.sessionId??null}})});
 assert.equal(invalid.r.statusCode,200);
 assert.equal(JSON.parse(invalid.r.body).result.sid,null);

 const discover=handleServerDiscoverMessage({id:4,protocolVersion:"2025-06-18",serverName:"mcp-tests-response-shape",serverVersion:"0.40.0",connectorShapeVersion:"2025-05-strict-v1",outputMode:"structured",authMode:"oauth21",profile:"internal",tools:[],serverStartId:"start"});
 assert.equal(discover.result.transport.protocol_sessions,false);
 assert.equal(discover.result.transport.legacy_initialize_supported,true);
 assert.equal(discover.result.transport.mode,"streamable_http_stateless_legacy_initialize_compat");
 console.log("smoke_streamable_http_session_lifecycle ok");
})().catch(e=>{console.error(e?.stack||e);process.exit(1);});

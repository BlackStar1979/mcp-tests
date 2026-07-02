"use strict";
const assert=require("node:assert/strict");
const {createSessionStore}=require("../src/runtime/session_store");
const {dispatchMcpEntry}=require("../src/runtime/mcp_entry_dispatcher");

function res(){return{statusCode:null,headers:{},body:"",setHeader(k,v){this.headers[k.toLowerCase()]=v;},writeHead(c,h){this.statusCode=c;Object.assign(this.headers,h||{});},end(x){if(x)this.body+=String(x);}}}
function req({headers={},body,method="POST"}){const chunks=[Buffer.from(body||"{}")] ;return{method,headers,on(e,cb){if(e==="data")chunks.forEach(c=>cb(c));if(e==="end")cb();return this;}}}
async function call({headers={},body,store,handler}){const r=res();const audits=[];await dispatchMcpEntry({req:req({headers,body}),res:r,requestId:"r",authPolicy:{mode:"none",authenticate:()=>({ok:true})},auditLog:(e,p)=>audits.push({e,p}),handleRpcMessage:handler,publicBaseUrl:"http://127.0.0.1/mcp",sessionStore:store});return{r,audits};}
(async()=>{
 const store=createSessionStore();
 const initBody=JSON.stringify({jsonrpc:"2.0",id:1,method:"initialize",params:{protocolVersion:"2025-06-18",capabilities:{sampling:{}}}});
 const init=await call({headers:{accept:"application/json"},body:initBody,store,handler:async(_p,ctx)=>({jsonrpc:"2.0",id:1,result:{protocolVersion:ctx.protocolVersion}})});
 assert.equal(init.r.statusCode,200);
 const sid=init.r.headers["mcp-session-id"];
 assert.ok(sid&&sid.startsWith("mcp_"));
 assert.equal(store.get(sid).clientCapabilities.sampling instanceof Object,true);
 assert.ok(init.audits.some(x=>x.e==="session_created"));

 const known=await call({headers:{accept:"application/json","mcp-session-id":sid},body:JSON.stringify({jsonrpc:"2.0",id:2,method:"ping",params:{}}),store,handler:async(_p,ctx)=>({jsonrpc:"2.0",id:2,result:{sid:ctx.sessionId,proto:ctx.protocolVersion}})});
 assert.equal(known.r.statusCode,200);
 assert.equal(JSON.parse(known.r.body).result.sid,sid);
 assert.equal(JSON.parse(known.r.body).result.proto,"2025-06-18");

 const unknown=await call({headers:{accept:"application/json","mcp-session-id":"mcp_unknown"},body:JSON.stringify({jsonrpc:"2.0",id:3,method:"ping",params:{}}),store,handler:async()=>{throw new Error("must not run");}});
 assert.equal(unknown.r.statusCode,404);
 assert.equal(JSON.parse(unknown.r.body).error.data.reason,"unknown_session");
 console.log("smoke_streamable_http_session_lifecycle ok");
})().catch(e=>{console.error(e?.stack||e);process.exit(1);});

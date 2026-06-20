"use strict";
const assert=require("node:assert/strict");
const {createSessionStore}=require("../src/runtime/session_store");
const {handleMcpGetStream}=require("../src/runtime/mcp_get_stream_handler");
const {encodeSseEvent}=require("../src/runtime/sse_response");
function res(){return{statusCode:null,headers:{},chunks:[],writeHead(c,h){this.statusCode=c;this.headers=h||{};},write(x){this.chunks.push(String(x));},end(x){if(x)this.chunks.push(String(x));},body(){return this.chunks.join("");}}}
function req(){return{events:{},on(e,cb){this.events[e]=cb;return this;}}}
const audits=[];const auditLog=(e,p)=>audits.push({e,p});
const store=createSessionStore();
const session=store.create({protocolVersion:"2025-06-18",clientCapabilities:{}});
session.enqueueOutbound(encodeSseEvent({event:"message",data:{jsonrpc:"2.0",method:"notifications/test",params:{n:1}}}));
const r=res();const q=req();
handleMcpGetStream({req:q,res:r,requestId:"get-1",sessionId:session.id,sessionStore:store,auditLog});
assert.equal(r.statusCode,200);
assert.ok(r.headers["content-type"].startsWith("text/event-stream"));
assert.equal(session.sseRes,r);
assert.equal(session.outboundQueue.length,0);
assert.ok(r.body().includes("notifications/test"));
assert.ok(r.body().includes("event: ready"));
assert.ok(audits.some(x=>x.e==="sse_stream_opened"));
q.events.close();
assert.equal(session.sseRes,null);
assert.ok(audits.some(x=>x.e==="sse_stream_closed"));

const missing=res();
handleMcpGetStream({req:req(),res:missing,requestId:"get-2",sessionId:undefined,sessionStore:store,auditLog});
assert.equal(missing.statusCode,400);
assert.equal(JSON.parse(missing.body()).error.data.reason,"missing_session");

const unknown=res();
handleMcpGetStream({req:req(),res:unknown,requestId:"get-3",sessionId:"mcp_unknown",sessionStore:store,auditLog});
assert.equal(unknown.statusCode,404);
assert.equal(JSON.parse(unknown.body()).error.data.reason,"unknown_session");
console.log("smoke_stage12_get_sse_stream ok");

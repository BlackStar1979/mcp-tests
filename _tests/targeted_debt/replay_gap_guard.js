"use strict";
const assert=require("node:assert/strict");
const {McpSession}=require("../../src/runtime/session");
const {handleMcpGetStream}=require("../../src/runtime/mcp_get_stream_handler");
function res(){return{statusCode:0,headers:null,body:"",writeHead(c,h){this.statusCode=c;this.headers=h;},write(x){this.body+=String(x);},end(x=""){this.body+=String(x);}}}
function req(id){const h={};h["last"+"-event-id"]=id;return{headers:h,on(){}}}
function store(session){return{get(id){return id===session.id?session:null;}}}
const session=new McpSession({id:"mcp_old",protocolVersion:"2025-06-18",maxReplayEvents:2});
const live=res();session.attachStream(live);
for(const text of ["one","two","three","four"]){session.enqueueOutbound(`event: message\ndata: ${text}\n\n`);}
session.detachStream(live);
assert.equal(session.replayBuffer[0].id,3);
assert.equal(session.validateReplayRequest("1").reason,"replay_buffer_expired");
let out=res();
handleMcpGetStream({req:req("1"),res:out,requestId:"r1",sessionId:session.id,sessionStore:store(session),auditLog:()=>{},keepaliveIntervalMs:0});
assert.equal(out.statusCode,409);assert.ok(out.body.includes("replay_buffer_expired"));assert.equal(session.sseRes,null);
out=res();handleMcpGetStream({req:req("bad"),res:out,requestId:"r2",sessionId:session.id,sessionStore:store(session),auditLog:()=>{},keepaliveIntervalMs:0});
assert.equal(out.statusCode,400);assert.ok(out.body.includes("invalid_last_event_id"));
out=res();handleMcpGetStream({req:req("99"),res:out,requestId:"r3",sessionId:session.id,sessionStore:store(session),auditLog:()=>{},keepaliveIntervalMs:0});
assert.equal(out.statusCode,409);assert.ok(out.body.includes("future_last_event_id"));
out=res();handleMcpGetStream({req:req("2"),res:out,requestId:"r4",sessionId:session.id,sessionStore:store(session),auditLog:()=>{},keepaliveIntervalMs:0});
assert.equal(out.statusCode,200);assert.ok(out.body.includes("data: three"));assert.ok(out.body.includes("data: four"));
console.log("replay_gap_guard ok");

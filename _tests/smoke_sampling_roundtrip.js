"use strict";
const assert=require("node:assert/strict");
const {McpSession}=require("../src/runtime/session");
const {createSamplingContext}=require("../src/runtime/sampling_context");
const {resolvePendingResponse}=require("../src/runtime/outbound_request_manager");
function res(){return{chunks:[],write(x){this.chunks.push(String(x));},body(){return this.chunks.join("");}}}
(async()=>{
 const audit=[];
 const session=new McpSession({id:"mcp_sampling",protocolVersion:"2025-06-18",clientCapabilities:{sampling:{}}});
 const stream=res();session.attachStream(stream);
 const ctx=createSamplingContext({session,auditLog:(e,p)=>audit.push({e,p}),requestId:"req-s"});
 const promise=ctx.requestSampling({messages:[{role:"user",content:{type:"text",text:"hello"}}],maxTokens:16},{timeoutMs:1000});
 assert.equal(session.pending.size,1);
 assert.ok(stream.body().includes("sampling/createMessage"));
 assert.ok(stream.body().includes("maxTokens"));
 assert.ok(audit.some(x=>x.e==="sampling_request_sent"));
 const id=[...session.pending.keys()][0];
 const resolved=resolvePendingResponse(session,{jsonrpc:"2.0",id,result:{role:"assistant",content:{type:"text",text:"ok"}}});
 assert.equal(resolved.ok,true);
 const result=await promise;
 assert.equal(result.result.content.text,"ok");
 assert.equal(session.pending.size,0);
 console.log("smoke_sampling_roundtrip ok");
})().catch(e=>{console.error(e?.stack||e);process.exit(1);});

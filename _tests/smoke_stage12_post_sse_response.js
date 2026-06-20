"use strict";
const assert=require("node:assert/strict");
const {handleSinglePayload}=require("../src/runtime/single_payload_dispatcher");

function res(){return{statusCode:null,headers:null,chunks:[],ended:false,writeHead(c,h){this.statusCode=c;this.headers=h||{};},write(x){this.chunks.push(String(x));},end(x){if(x)this.chunks.push(String(x));this.ended=true;},body(){return this.chunks.join("");}}}
const payload={jsonrpc:"2.0",id:1,method:"ping",params:{}};
const raw=JSON.stringify(payload);
const audit=[];
const auditLog=(e,p)=>audit.push({e,p});
(async()=>{
 const json=res();
 await handleSinglePayload({payload,raw,res:json,auditLog,requestId:"json",sessionId:undefined,protocolVersion:"2025-03-26",responseMode:"json",httpMethod:"POST",handleRpcMessage:async()=>({jsonrpc:"2.0",id:1,result:{ok:true}})});
 assert.equal(json.statusCode,200);
 assert.ok(json.headers["content-type"].startsWith("application/json"));
 assert.deepEqual(JSON.parse(json.body()).result,{ok:true});

 const sse=res();
 await handleSinglePayload({payload,raw,res:sse,auditLog,requestId:"sse",sessionId:undefined,protocolVersion:"2025-06-18",responseMode:"sse",httpMethod:"POST",handleRpcMessage:async()=>({jsonrpc:"2.0",id:1,result:{ok:true}})});
 assert.equal(sse.statusCode,200);
 assert.ok(sse.headers["content-type"].startsWith("text/event-stream"));
 assert.ok(sse.body().includes("event: message"));
 assert.ok(sse.body().includes("data: {"));
 assert.ok(sse.body().endsWith("\n\n"));
 assert.equal(sse.ended,true);

 const noResponse=res();
 await handleSinglePayload({payload,raw,res:noResponse,auditLog,requestId:"none",sessionId:undefined,protocolVersion:"2025-06-18",responseMode:"sse",httpMethod:"POST",handleRpcMessage:async()=>undefined});
 assert.equal(noResponse.statusCode,204);
 console.log("smoke_stage12_post_sse_response ok");
})().catch((error)=>{console.error(error?.stack||error);process.exit(1);});

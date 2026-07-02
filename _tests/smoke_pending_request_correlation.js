"use strict";
const assert=require("node:assert/strict");
const {McpSession}=require("../src/runtime/session");
const {sendSessionRequest}=require("../src/runtime/outbound_request_manager");
const {handleSinglePayload}=require("../src/runtime/single_payload_dispatcher");
const {handleBatchPayloadIfNeeded}=require("../src/runtime/batch_payload_dispatcher");
function res(){return{statusCode:null,headers:{},chunks:[],writeHead(c,h){this.statusCode=c;this.headers=h||{};},write(x){this.chunks.push(String(x));},end(x){if(x)this.chunks.push(String(x));this.ended=true;},body(){return this.chunks.join("");}}}
const audit=[];const auditLog=(e,p)=>audit.push({e,p});
(async()=>{
 const session=new McpSession({id:"mcp_pending",protocolVersion:"2025-06-18"});
 const stream=res();session.attachStream(stream);
 const outbound=sendSessionRequest(session,{method:"sampling/createMessage",params:{n:1},timeoutMs:1000});
 assert.equal(outbound.id,"srv_1");
 assert.equal(session.pending.size,1);
 assert.ok(stream.body().includes("sampling/createMessage"));
 const single=res();
 await handleSinglePayload({payload:{jsonrpc:"2.0",id:outbound.id,result:{ok:true}},raw:"{}",res:single,auditLog,requestId:"single",sessionId:session.id,session,protocolVersion:"2025-06-18",httpMethod:"POST",handleRpcMessage:async()=>{throw new Error("must not dispatch response");}});
 assert.equal(single.statusCode,202);
 assert.equal(single.body(),"");
 assert.equal(session.pending.size,0);
 const resolved=await outbound.promise;
 assert.deepEqual(resolved.result,{ok:true});
 assert.ok(audit.some(x=>x.e==="pending_response_resolved"));

 const unknown=res();
 await handleSinglePayload({payload:{jsonrpc:"2.0",id:"srv_unknown",result:{}},raw:"{}",res:unknown,auditLog,requestId:"unknown",sessionId:session.id,session,protocolVersion:"2025-06-18",httpMethod:"POST",handleRpcMessage:async()=>{throw new Error("must not dispatch unknown response");}});
 assert.equal(unknown.statusCode,400);
 assert.equal(JSON.parse(unknown.body()).error.data.reason,"unknown_pending_id");

 const a=sendSessionRequest(session,{method:"test/a",timeoutMs:1000});
 const b=sendSessionRequest(session,{method:"test/b",timeoutMs:1000});
 const batch=res();
 await handleBatchPayloadIfNeeded({payload:[{jsonrpc:"2.0",id:a.id,result:{a:1}},{jsonrpc:"2.0",id:b.id,error:{code:-1,message:"x"}}],raw:"[]",res:batch,auditLog,requestId:"batch",sessionId:session.id,session,protocolVersion:"2025-06-18",httpMethod:"POST",handleRpcMessage:async()=>{throw new Error("must not dispatch batch responses");}});
 assert.equal(batch.statusCode,202);
 assert.equal(session.pending.size,0);
 const ar=await a.promise; const br=await b.promise;
 assert.deepEqual(ar.result,{a:1});
 assert.equal(br.error.message,"x");
 console.log("smoke_pending_request_correlation ok");
})().catch(e=>{console.error(e?.stack||e);process.exit(1);});

"use strict";
const assert=require("node:assert/strict");
const {McpSession}=require("../src/runtime/session");
const {createSamplingContext,SamplingUnavailableError,hasClientSamplingCapability}=require("../src/runtime/sampling_context");
(async()=>{
 const missing=createSamplingContext({session:null});
 await assert.rejects(()=>missing.requestSampling({messages:[]}), (e)=>e instanceof SamplingUnavailableError && e.reason==="missing_session");
 const noCapSession=new McpSession({id:"mcp_no",protocolVersion:"2025-06-18",clientCapabilities:{}});
 assert.equal(hasClientSamplingCapability(noCapSession),false);
 const noCap=createSamplingContext({session:noCapSession});
 await assert.rejects(()=>noCap.requestSampling({messages:[]}), (e)=>e instanceof SamplingUnavailableError && e.reason==="client_sampling_not_declared");
 const capSession=new McpSession({id:"mcp_yes",protocolVersion:"2025-06-18",clientCapabilities:{sampling:{}}});
 assert.equal(hasClientSamplingCapability(capSession),true);
 console.log("smoke_stage12_sampling_capability_gate ok");
})().catch(e=>{console.error(e?.stack||e);process.exit(1);});

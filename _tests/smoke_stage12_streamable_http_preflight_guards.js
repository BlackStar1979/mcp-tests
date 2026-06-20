"use strict";
const assert=require("node:assert/strict");
const {evaluatePostAccept,evaluateGetAccept}=require("../src/runtime/accept_policy");
const {evaluateProtocolVersionHeader,negotiateInitializeProtocolVersion,CURRENT_PROTOCOL_VERSION,LEGACY_PROTOCOL_VERSION}=require("../src/runtime/protocol_version_policy");
const {buildInitializeResponse}=require("../src/runtime/initialize_response");

assert.equal(evaluatePostAccept({headers:{}},{strict:false}).ok,true);
assert.equal(evaluatePostAccept({headers:{accept:"application/json"}},{strict:true}).ok,false);
assert.equal(evaluatePostAccept({headers:{accept:"application/json, text/event-stream"}},{strict:true}).ok,true);
assert.equal(evaluateGetAccept({headers:{accept:"application/json"}}).ok,false);
assert.equal(evaluateGetAccept({headers:{accept:"text/event-stream"}}).ok,true);
assert.equal(evaluateProtocolVersionHeader({headers:{}}).protocolVersion,LEGACY_PROTOCOL_VERSION);
assert.equal(evaluateProtocolVersionHeader({headers:{"mcp-protocol-version":CURRENT_PROTOCOL_VERSION}}).ok,true);
assert.equal(evaluateProtocolVersionHeader({headers:{"mcp-protocol-version":"bad"}}).ok,false);
assert.equal(negotiateInitializeProtocolVersion("1900-01-01").protocolVersion,CURRENT_PROTOCOL_VERSION);
const init=buildInitializeResponse({protocolVersion:"1900-01-01",serverName:"s",serverVersion:"v",connectorShapeVersion:"shape",outputMode:"structured",authMode:"none",profile:"public",tools:[]});
assert.equal(init.protocolVersion,CURRENT_PROTOCOL_VERSION);
assert.equal(init.instructions.includes(["code","sample","js"].join("_")),false);
console.log("smoke_stage12_streamable_http_preflight_guards ok");

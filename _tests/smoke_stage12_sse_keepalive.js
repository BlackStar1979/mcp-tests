"use strict";
const assert=require("node:assert/strict");
const {encodeSseComment}=require("../src/runtime/sse_response");
const {startKeepalive,getLastEventId}=require("../src/runtime/mcp_get_stream_handler");
assert.equal(encodeSseComment("keepalive"),": keepalive\n\n");
assert.equal(getLastEventId({headers:{"last-event-id":"7"}}),"7");
assert.equal(getLastEventId({headers:{"Last-Event-ID":"8"}}),"8");
const writes=[];
const res={write(x){writes.push(String(x));}};
const oldSetInterval=global.setInterval;
const oldClearInterval=global.clearInterval;
let capturedFn=null;let capturedMs=null;let cleared=false;
global.setInterval=(fn,ms)=>{capturedFn=fn;capturedMs=ms;return {unref(){this.unrefed=true;}};};
global.clearInterval=()=>{cleared=true;};
try{const timer=startKeepalive(res,123);assert.equal(capturedMs,123);capturedFn();assert.equal(writes[0],": keepalive\n\n");clearInterval(timer);assert.equal(cleared,true);assert.equal(startKeepalive(res,0),null);}finally{global.setInterval=oldSetInterval;global.clearInterval=oldClearInterval;}
console.log("smoke_stage12_sse_keepalive ok");

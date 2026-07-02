"use strict";
const assert=require("node:assert/strict");
const {handleDocsRoute}=require("../src/runtime/docs_route_handler");
function res(){return{statusCode:null,body:""};}
function textResponse(r,c,t){r.statusCode=c;r.body=String(t);return r;}
const bad=res();
handleDocsRoute({res:bad,pathname:"/docs/%E0%A4%A",textResponse,fetchDoc(){throw new Error("must not fetch malformed doc id");},documentRuntimeContext(){return{};}});
assert.equal(bad.statusCode,400);assert.equal(bad.body,"Bad request");
const ok=res();
handleDocsRoute({res:ok,pathname:"/docs/doc%201",textResponse,fetchDoc(ctx,id){assert.equal(id,"doc 1");return{title:"T",text:"Body"};},documentRuntimeContext(){return{};}});
assert.equal(ok.statusCode,200);assert.ok(ok.body.includes("Body"));
console.log("smoke_docs_malformed_uri ok");

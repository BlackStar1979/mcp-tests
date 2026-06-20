"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {createFileIntrospectionClient,validateIntrospectionResponse}=require("../src/auth/oauth_introspection");
const {createAuthPolicy}=require("../src/auth/auth_policy");
const now=Math.floor(Date.now()/1000);
assert.equal(validateIntrospectionResponse({active:true,iss:"https://as",aud:"https://mcp",scope:"mcp:tools",exp:now+60},{issuer:"https://as",audience:"https://mcp",now}).ok,true);
assert.equal(validateIntrospectionResponse({active:false},{issuer:"https://as",audience:"https://mcp",now}).error,"inactive_token");
assert.equal(validateIntrospectionResponse({active:true,iss:"bad",aud:"https://mcp",scope:"mcp:tools",exp:now+60},{issuer:"https://as",audience:"https://mcp",now}).error,"invalid_issuer");
const dir=fs.mkdtempSync(path.join(os.tmpdir(),"intro-"));
try{const f=path.join(dir,"i.json");fs.writeFileSync(f,JSON.stringify({good:{active:true,iss:"https://as",aud:"https://mcp",sub:"u",scope:"mcp:tools",exp:now+60},bad:{active:false},noscope:{active:true,iss:"https://as",aud:"https://mcp",scope:"other",exp:now+60}}));const c=createFileIntrospectionClient({responseFile:f,issuer:"https://as",audience:"https://mcp"});assert.equal(c.introspect("good").ok,true);assert.equal(c.status().positive_cache_size,1);assert.equal(c.introspect("bad").error,"inactive_token");assert.equal(c.introspect("noscope").status,403);
const oldIssuer=process.env.MCP_TEST_OAUTH_ISSUER;
const oldAudience=process.env.MCP_TEST_OAUTH_AUDIENCE;
const oldIntro=process.env.MCP_TEST_OAUTH_INTROSPECTION_FILE;
const oldSecret=process.env.MCP_TEST_OAUTH_HS256_SECRET_FILE;
process.env.MCP_TEST_OAUTH_ISSUER="https://as";
process.env.MCP_TEST_OAUTH_AUDIENCE="https://mcp";
process.env.MCP_TEST_OAUTH_INTROSPECTION_FILE=f;
delete process.env.MCP_TEST_OAUTH_HS256_SECRET_FILE;
try{const policy=createAuthPolicy({mode:"oauth",publicBaseUrl:"https://mcp"});assert.equal(policy.status().token_validation_mode,"introspection");assert.equal(policy.authenticate({headers:{authorization:"Bearer good"},url:"/mcp"}).ok,true);assert.equal(policy.authenticate({headers:{authorization:"Bearer bad"},url:"/mcp"}).error,"inactive_token");assert.equal(policy.authenticate({headers:{authorization:"Bearer noscope"},url:"/mcp"}).status,403);}
finally{if(oldIssuer===undefined)delete process.env.MCP_TEST_OAUTH_ISSUER;else process.env.MCP_TEST_OAUTH_ISSUER=oldIssuer;if(oldAudience===undefined)delete process.env.MCP_TEST_OAUTH_AUDIENCE;else process.env.MCP_TEST_OAUTH_AUDIENCE=oldAudience;if(oldIntro===undefined)delete process.env.MCP_TEST_OAUTH_INTROSPECTION_FILE;else process.env.MCP_TEST_OAUTH_INTROSPECTION_FILE=oldIntro;if(oldSecret===undefined)delete process.env.MCP_TEST_OAUTH_HS256_SECRET_FILE;else process.env.MCP_TEST_OAUTH_HS256_SECRET_FILE=oldSecret;}}finally{fs.rmSync(dir,{recursive:true,force:true});}
console.log("smoke_stage12_oauth_introspection_validation ok");

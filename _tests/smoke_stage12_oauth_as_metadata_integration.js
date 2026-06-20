"use strict";
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const fs=require("node:fs");
const net=require("node:net");
const os=require("node:os");
const path=require("node:path");
const {spawn}=require("node:child_process");
const {createAuthorizationServerMetadataProvider,validateAuthorizationServerMetadata}=require("../src/auth/oauth_authorization_server_metadata");
const {buildProtectedResourceMetadata}=require("../src/runtime/oauth_metadata");
const ROOT=path.resolve(__dirname,"..");
function getFreePort(){return new Promise((resolve,reject)=>{const s=net.createServer();s.unref();s.on("error",reject);s.listen(0,"127.0.0.1",()=>{const {port}=s.address();s.close(()=>resolve(port));});});}
async function waitJson(url){for(let i=0;i<50;i++){try{const r=await fetch(url);if(r.ok)return r.json();}catch{}await new Promise(r=>setTimeout(r,100));}throw new Error(`timeout waiting for ${url}`);}
(async()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"mcp-h1-as-"));
 const metadataFile=path.join(tmp,"as-metadata.json");
 const secretFile=path.join(tmp,"secret.txt");
 const issuer="https://as.example.test";
 const publicBaseUrl="https://mcp.example.test";
 fs.writeFileSync(secretFile,crypto.randomBytes(48).toString("base64url"));
 fs.writeFileSync(metadataFile,JSON.stringify({issuer,authorization_endpoint:`${issuer}/authorize`,token_endpoint:`${issuer}/token`,jwks_uri:`${issuer}/jwks.json`,registration_endpoint:`${issuer}/register`,code_challenge_methods_supported:["S256"],scopes_supported:["mcp:public","mcp:tools"]}));
 const metadata=validateAuthorizationServerMetadata(JSON.parse(fs.readFileSync(metadataFile,"utf8")),{expectedIssuer:issuer});
 assert.equal(metadata.issuer,issuer);assert.equal(metadata.authorization_endpoint,`${issuer}/authorize`);assert.equal(metadata.token_endpoint,`${issuer}/token`);assert.equal(metadata.jwks_uri,`${issuer}/jwks.json`);
 const provider=createAuthorizationServerMetadataProvider({issuer,metadataFile});
 const pr=buildProtectedResourceMetadata({publicBaseUrl,authorizationServerMetadata:provider.get()});
 assert.equal(pr.resource,publicBaseUrl);assert.deepEqual(pr.authorization_servers,[issuer]);
 const port=await getFreePort();
 const child=spawn(process.execPath,["server.js","--auth","oauth","--port",String(port)],{cwd:ROOT,env:{...process.env,MCP_TEST_PUBLIC_BASE_URL:publicBaseUrl,MCP_TEST_OAUTH_ISSUER:issuer,MCP_TEST_OAUTH_AUDIENCE:publicBaseUrl,MCP_TEST_OAUTH_HS256_SECRET_FILE:secretFile,MCP_TEST_OAUTH_AS_METADATA_FILE:metadataFile,MCP_TEST_FS_ROOT:path.join(ROOT,"_public_sandbox")},stdio:["ignore","pipe","pipe"]});
 let output="";child.stdout.on("data",d=>{output+=String(d);});child.stderr.on("data",d=>{output+=String(d);});
 try{const body=await waitJson(`http://127.0.0.1:${port}/.well-known/oauth-protected-resource`);assert.equal(body.resource,publicBaseUrl);assert.deepEqual(body.authorization_servers,[issuer]);assert.ok(body.scopes_supported.includes("mcp:tools"));}
 finally{child.kill();fs.rmSync(tmp,{recursive:true,force:true});}
 assert.ok(!output.includes("MCP TEST SERVER FAILED"),output);
 console.log("smoke_stage12_oauth_as_metadata_integration ok");
})().catch(e=>{console.error(e?.stack||e);process.exit(1);});

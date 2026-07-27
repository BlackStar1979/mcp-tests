"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const net=require("node:net");
const os=require("node:os");
const path=require("node:path");
const crypto=require("node:crypto");
const {spawn}=require("node:child_process");
const {withHermeticServerControlEnv}=require("./helpers/hermetic_server_control_env");

const ROOT=path.join(__dirname,"..");

function freePort(){return new Promise((resolve,reject)=>{const s=net.createServer();s.unref();s.on("error",reject);s.listen(0,"127.0.0.1",()=>{const p=s.address().port;s.close(()=>resolve(p));});});}
function cleanEnv(overrides={}){const e={...process.env,...overrides};for(const k of ["MCP_TEST_AUTH_MODE","MCP_TEST_PORT","MCP_TEST_OAUTH_OPERATOR_SECRET","MCP_TEST_OAUTH_ISSUER","MCP_TEST_PUBLIC_BASE_URL"]){delete e[k];}return {...e,...overrides};}
async function waitHealth(port){for(let i=0;i<80;i++){try{const r=await fetch(`http://127.0.0.1:${port}/healthz`);if(r.ok)return r.json();}catch{}await new Promise(r=>setTimeout(r,100));}throw new Error("health timeout");}
function b64(buf){return Buffer.from(buf).toString("base64").replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");}
function sha256Base64Url(text){return b64(crypto.createHash("sha256").update(text).digest());}
async function json(url,init){const r=await fetch(url,init);let body={};try{body=await r.json();}catch{}return {status:r.status,headers:r.headers,body};}
async function registerClient(issuer,redirectUri){
  const reg=await json(`${issuer}/register`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({redirect_uris:[redirectUri],token_endpoint_auth_method:"none"})});
  assert.equal(reg.status,201);
  return reg.body.client_id;
}
async function authorizeWithLogin(issuer,{clientId,redirectUri,resource,duplicateResource=false}){
  const verifier=b64(crypto.randomBytes(32));
  const challenge=sha256Base64Url(verifier);
  const state=`state-${Date.now()}-${Math.random()}`;
  const az=new URL(`${issuer}/authorize`);
  az.searchParams.append("response_type","code");
  az.searchParams.append("client_id",clientId);
  az.searchParams.append("redirect_uri",redirectUri);
  az.searchParams.append("code_challenge",challenge);
  az.searchParams.append("code_challenge_method","S256");
  az.searchParams.append("state",state);
  az.searchParams.append("scope","mcp:tools");
  az.searchParams.append("resource",resource);
  if(duplicateResource)az.searchParams.append("resource",resource);
  const login=await fetch(az,{redirect:"manual"});
  assert.equal(login.status,302);
  const pid=new URL(login.headers.get("location")).searchParams.get("pid");
  const consent=await fetch(`${issuer}/oauth/operator-login`,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({pid,client_id:clientId,redirect_uri:redirectUri,scope:"mcp:tools",password:"stage12-oauth21-operator-secret"}),redirect:"manual"});
  assert.equal(consent.status,302);
  const cb=new URL(consent.headers.get("location"));
  assert.equal(cb.searchParams.get("state"),state);
  return {code:cb.searchParams.get("code"),verifier};
}

(async()=>{
  const port=await freePort();
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"mcp-tests-oauth21-duplicate-"));
  const cfg=path.join(tmp,"oauth.json");
  const operatorSecret="stage12-oauth21-operator-secret";
  const issuer=`http://127.0.0.1:${port}`;
  const resource=`${issuer}/mcp`;
  const redirectUri="http://127.0.0.1/callback";
  fs.writeFileSync(cfg,JSON.stringify({operator_secret:operatorSecret,issuer}),"utf8");
  const child=spawn(process.execPath,["server.js","--profile","tests","--auth","oauth21","--oauth-secret-file",cfg,"--port",String(port)],{cwd:ROOT,env:withHermeticServerControlEnv(cleanEnv({MCP_TEST_FS_ROOT:path.join(ROOT,"_public_sandbox"),MCP_TEST_PUBLIC_BASE_URL:issuer}),path.join(tmp,"control")),stdio:["ignore","pipe","pipe"]});
  let output="";
  child.stdout.on("data",d=>{output+=String(d);});
  child.stderr.on("data",d=>{output+=String(d);});
  try{
    const health=await waitHealth(port);
    assert.equal(health.auth.mode,"oauth21");
    const clientId=await registerClient(issuer,redirectUri);

    const ok=await authorizeWithLogin(issuer,{clientId,redirectUri,resource,duplicateResource:true});
    const tokenBody=new URLSearchParams();
    tokenBody.append("grant_type","authorization_code");
    tokenBody.append("code",ok.code);
    tokenBody.append("redirect_uri",redirectUri);
    tokenBody.append("client_id",clientId);
    tokenBody.append("code_verifier",ok.verifier);
    tokenBody.append("resource",resource);
    tokenBody.append("resource",resource);
    const tokenOk=await json(`${issuer}/token`,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:tokenBody});
    assert.equal(tokenOk.status,200);
    assert.ok(tokenOk.body.access_token);

    const dupClientIdUrl=new URL(`${issuer}/authorize`);
    dupClientIdUrl.searchParams.append("response_type","code");
    dupClientIdUrl.searchParams.append("client_id",clientId);
    dupClientIdUrl.searchParams.append("client_id","attacker-client");
    dupClientIdUrl.searchParams.append("redirect_uri",redirectUri);
    dupClientIdUrl.searchParams.append("code_challenge",sha256Base64Url("abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnopqrstuvwxyz"));
    dupClientIdUrl.searchParams.append("code_challenge_method","S256");
    dupClientIdUrl.searchParams.append("state","dup-client-id");
    dupClientIdUrl.searchParams.append("scope","mcp:tools");
    dupClientIdUrl.searchParams.append("resource",resource);
    const dupClientId=await json(dupClientIdUrl,{redirect:"manual"});
    assert.equal(dupClientId.status,400);
    assert.equal(dupClientId.body.error,"invalid_request");

    const second=await authorizeWithLogin(issuer,{clientId,redirectUri,resource});
    const dupVerifierBody=new URLSearchParams();
    dupVerifierBody.append("grant_type","authorization_code");
    dupVerifierBody.append("code",second.code);
    dupVerifierBody.append("redirect_uri",redirectUri);
    dupVerifierBody.append("client_id",clientId);
    dupVerifierBody.append("code_verifier",second.verifier);
    dupVerifierBody.append("code_verifier",second.verifier);
    dupVerifierBody.append("resource",resource);
    const dupVerifier=await json(`${issuer}/token`,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:dupVerifierBody});
    assert.equal(dupVerifier.status,400);
    assert.equal(dupVerifier.body.error,"invalid_request");

    console.log("smoke_oauth21_duplicate_params ok");
  }catch(e){
    e.message+=output?`\nserver output:\n${output}`:"";
    throw e;
  }finally{
    child.kill();
    fs.rmSync(tmp,{recursive:true,force:true});
  }
})().catch(e=>{console.error(e?.stack||e);process.exit(1);});

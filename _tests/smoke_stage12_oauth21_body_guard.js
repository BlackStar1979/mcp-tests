"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const net=require("node:net");
const os=require("node:os");
const path=require("node:path");
const {spawn}=require("node:child_process");

const ROOT=path.join(__dirname,"..");

function freePort(){return new Promise((resolve,reject)=>{const s=net.createServer();s.unref();s.on("error",reject);s.listen(0,"127.0.0.1",()=>{const p=s.address().port;s.close(()=>resolve(p));});});}
function cleanEnv(overrides={}){const e={...process.env,...overrides};for(const k of ["MCP_TEST_AUTH_MODE","MCP_TEST_PORT","MCP_TEST_OAUTH_OPERATOR_SECRET","MCP_TEST_OAUTH_ISSUER","MCP_TEST_PUBLIC_BASE_URL"]){delete e[k];}return {...e,...overrides};}
async function waitHealth(port){for(let i=0;i<80;i++){try{const r=await fetch(`http://127.0.0.1:${port}/healthz`);if(r.ok)return r.json();}catch{}await new Promise(r=>setTimeout(r,100));}throw new Error("health timeout");}
async function postMalformed(issuer,path){const r=await fetch(`${issuer}${path}`,{method:"POST",headers:{"content-type":"application/json"},body:"{"});assert.equal(r.status,400, path);assert.ok((r.headers.get("content-type")||"").includes("application/json"), path);const body=await r.json();assert.equal(body.error,"invalid_request", path);}

(async()=>{const port=await freePort();const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"mcp-tests-oauth21-body-"));const cfg=path.join(tmp,"oauth.json");const operatorSecret="stage12-oauth21-operator-secret";const issuer=`http://127.0.0.1:${port}`;fs.writeFileSync(cfg,JSON.stringify({operator_secret:operatorSecret,issuer}),"utf8");const child=spawn(process.execPath,["server.js","--profile","tests","--auth","oauth21","--oauth-secret-file",cfg,"--port",String(port)],{cwd:ROOT,env:cleanEnv({MCP_TEST_FS_ROOT:path.join(ROOT,"_public_sandbox"),MCP_TEST_PUBLIC_BASE_URL:issuer}),stdio:["ignore","pipe","pipe"]});let output="";child.stdout.on("data",d=>{output+=String(d);});child.stderr.on("data",d=>{output+=String(d);});try{const health=await waitHealth(port);assert.equal(health.auth.mode,"oauth21");for(const route of ["/register","/token","/revoke","/oauth/operator-login"]){await postMalformed(issuer,route);const stillHealthy=await fetch(`${issuer}/healthz`);assert.equal(stillHealthy.status,200, route);}console.log("smoke_stage12_oauth21_body_guard ok");}catch(e){e.message+=output?`
server output:
${output}`:"";throw e;}finally{child.kill();fs.rmSync(tmp,{recursive:true,force:true});}})().catch(e=>{console.error(e?.stack||e);process.exit(1);});

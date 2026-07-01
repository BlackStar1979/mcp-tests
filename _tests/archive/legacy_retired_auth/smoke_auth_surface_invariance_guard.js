"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const net=require("node:net");
const os=require("node:os");
const path=require("node:path");
const {spawn}=require("node:child_process");
const ACCESS_ASSERTION_HEADER="cf-access-jwt-assertion";
const ASSERTION="stage11-access-surface-invariance-assertion";
const TOKEN="stage11-auth-surface-invariance-token-0123456789abcdef";
const EXPECTED_PUBLIC_COUNT=13;
function wait(ms){return new Promise(r=>setTimeout(r,ms));}
function getFreePort(){return new Promise((resolve,reject)=>{const s=net.createServer();s.unref();s.on("error",reject);s.listen(0,"127.0.0.1",()=>{const {port}=s.address();s.close(()=>resolve(port));});});}
async function waitHealth(port,headers={}){for(let i=0;i<50;i++){try{const r=await fetch("http://127.0.0.1:"+port+"/healthz",{headers});if(r.ok)return r.json();}catch{}await wait(100);}throw new Error("health timeout");}
async function rpc({port,headers={}}){const r=await fetch("http://127.0.0.1:"+port+"/mcp",{method:"POST",headers:{"content-type":"application/json",...headers},body:JSON.stringify({jsonrpc:"2.0",id:"surface-"+Date.now(),method:"tools/list",params:{}})});return {status:r.status,body:await r.json()};}
function makeHeaders(mode){if(mode==="bearer")return {authorization:"Bearer "+TOKEN};if(mode==="access")return {[ACCESS_ASSERTION_HEADER]:ASSERTION};return {};}
async function startMode(mode){const port=await getFreePort();const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"mcp-tests-stage11-surface-"+mode+"-"));const args=["server.js","--profile","public","--auth",mode,"--port",String(port)];if(mode==="bearer"){const tokenFile=path.join(tmp,"token.txt");fs.writeFileSync(tokenFile,TOKEN,{encoding:"utf8",mode:0o600});args.push("--token-file",tokenFile);}const child=spawn(process.execPath,args,{cwd:path.join(__dirname,".."),env:{...process.env,MCP_TEST_FS_ROOT:path.join(__dirname,"..","_public_sandbox")},stdio:["ignore","pipe","pipe"]});let output="";child.stdout.on("data",d=>output+=String(d));child.stderr.on("data",d=>output+=String(d));const headers=makeHeaders(mode);const health=await waitHealth(port,headers);return {mode,port,headers,health,cleanup(){child.kill();fs.rmSync(tmp,{recursive:true,force:true});},output:()=>output};}
(async()=>{const servers=[];try{for(const mode of ["none","bearer","access"])servers.push(await startMode(mode));let baseline=null;for(const server of servers){assert.equal(server.health.profile,server.mode==="none"?"public":"internal");const listed=await rpc({port:server.port,headers:server.headers});assert.equal(listed.status,200);const names=(listed.body.result?.tools||[]).map(t=>t.name).sort();assert.equal(names.length,EXPECTED_PUBLIC_COUNT);assert.equal(names.some(n=>n.startsWith("memory_")),false);assert.equal(names.includes("test_mcp_runtime_status"),false);if(!baseline)baseline=names;assert.deepEqual(names,baseline);assert.equal(JSON.stringify(listed.body).includes(TOKEN),false);assert.equal(JSON.stringify(listed.body).includes(ASSERTION),false);}console.log("smoke_stage11_auth_surface_invariance_guard ok");}finally{for(const s of servers)s.cleanup();}})().catch(e=>{console.error(e?.stack||e?.message||String(e));process.exit(1);});

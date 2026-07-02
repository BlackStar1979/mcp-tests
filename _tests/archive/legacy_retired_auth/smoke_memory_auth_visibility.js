const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {spawn}=require("node:child_process");
const MEMORY_TOOLS=["memory_save","memory_search","memory_get_state","memory_set_state","memory_create_task","memory_get_tasks"];
const PUBLIC_PORT=Number(process.env.MCP_TEST_STAGE13_PUBLIC_PORT||3113);
const ACCESS_PORT=Number(process.env.MCP_TEST_STAGE13_ACCESS_PORT||3114);
const ACCESS_HEADERS={"cf-access-jwt-assertion":"stage13-access-assertion"};
function wait(ms){return new Promise(r=>setTimeout(r,ms));}
async function waitHealth(port,headers={}){for(let i=0;i<50;i++){try{const r=await fetch("http://127.0.0.1:"+port+"/healthz",{headers});if(r.ok)return r.json();}catch{}await wait(100);}throw new Error("health timeout "+port);}
async function rpc(port,method,params={},headers={}){const r=await fetch("http://127.0.0.1:"+port+"/mcp",{method:"POST",headers:{"content-type":"application/json",...headers},body:JSON.stringify({jsonrpc:"2.0",id:method+"-"+Date.now(),method,params})});return {status:r.status,body:await r.json()};}
function mem(body){return (body.result?.tools||[]).map(t=>t.name).filter(n=>n.startsWith("memory_"));}
function payload(body){return body.result?.structuredContent||JSON.parse(body.result?.content?.[0]?.text||"{}");}
function start(args,memoryDir){return spawn(process.execPath,["server.js",...args],{cwd:process.cwd(),env:{...process.env,MCP_TEST_MEMORY_LOG_DIR:memoryDir,MCP_TEST_AUDIT_LOG:path.join(memoryDir,"audit.jsonl"),MCP_TEST_LOG_DIR:memoryDir},stdio:["ignore","pipe","pipe"]});}
(async()=>{
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"mcp-tests-stage13-memory-"));
const memoryDir=path.join(tmp,"memory");
let pub=null,access=null;
try{
pub=start(["--profile","tests","--auth","none","--port",String(PUBLIC_PORT)],memoryDir);
await waitHealth(PUBLIC_PORT);
let listed=await rpc(PUBLIC_PORT,"tools/list",{});
assert.equal(listed.status,200);
assert.deepEqual(mem(listed.body),[],"public/auth.none must not list memory tools");
let denied=await rpc(PUBLIC_PORT,"tools/call",{name:"memory_search",arguments:{query:"alpha"}});
assert.equal(denied.status,200);
assert.equal(denied.body.error.code,-32602);
assert.match(denied.body.error.message,/Unknown tool: memory_search/);
pub.kill();pub=null;
access=start(["--profile","tests","--auth","access","--port",String(ACCESS_PORT)],memoryDir);
const health=await waitHealth(ACCESS_PORT,ACCESS_HEADERS);
assert.equal(health.profile,"internal");
assert.equal(health.auth.mode,"access");
assert.equal(health.auth.requires_auth,true);
const missing=await rpc(ACCESS_PORT,"tools/list",{});
assert.equal(missing.status,401);
listed=await rpc(ACCESS_PORT,"tools/list",{},ACCESS_HEADERS);
assert.equal(listed.status,200);
assert.deepEqual(mem(listed.body).sort(),MEMORY_TOOLS.slice().sort(),"internal/access must list all memory tools");
let r=await rpc(ACCESS_PORT,"tools/call",{name:"memory_set_state",arguments:{agent_name:"stage13_agent",session_id:"s13",current_task:"access memory smoke",context:{ok:true}}},ACCESS_HEADERS);
assert.equal(payload(r.body).success,true);
r=await rpc(ACCESS_PORT,"tools/call",{name:"memory_get_state",arguments:{agent_name:"stage13_agent"}},ACCESS_HEADERS);
assert.equal(payload(r.body).found,true);
r=await rpc(ACCESS_PORT,"tools/call",{name:"memory_save",arguments:{agent_name:"stage13_agent",content:"stage13 alpha memory smoke content",type:"fact",category:"stage13"}},ACCESS_HEADERS);
assert.equal(payload(r.body).success,true);
r=await rpc(ACCESS_PORT,"tools/call",{name:"memory_search",arguments:{query:"alpha",agent_name:"stage13_agent",top_k:5}},ACCESS_HEADERS);
assert.ok(payload(r.body).results.length>=1);
r=await rpc(ACCESS_PORT,"tools/call",{name:"memory_create_task",arguments:{created_by:"stage13_agent",assigned_to:"stage13_agent",title:"stage13 task",description:"access-only memory task",priority:7}},ACCESS_HEADERS);
assert.equal(payload(r.body).success,true);
r=await rpc(ACCESS_PORT,"tools/call",{name:"memory_get_tasks",arguments:{assigned_to:"stage13_agent",status:"pending"}},ACCESS_HEADERS);
assert.ok(payload(r.body).total>=1);
for(const f of [".mcp-agent-state.json",".mcp-agent-memory.jsonl",".mcp-agent-tasks.jsonl"])assert.ok(fs.existsSync(path.join(memoryDir,f)),f+" isolated");
console.log("smoke_stage13_memory_auth_visibility ok");
}finally{if(pub)pub.kill();if(access)access.kill();fs.rmSync(tmp,{recursive:true,force:true});}
})().catch(e=>{console.error(e?.stack||e?.message||String(e));process.exit(1);});

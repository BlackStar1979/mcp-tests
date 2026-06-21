const assert=require("node:assert/strict");
const path=require("node:path");
const os=require("node:os");
const {spawn}=require("node:child_process");
const {CURRENT_STAGE_STATUS}=require("../src/stage_metadata");
const DEFAULT_PORT=Number(process.env.MCP_TEST_SMOKE_PORT||3095);
const INTERNAL_PORT=Number(process.env.MCP_TEST_SMOKE_INTERNAL_PORT||(DEFAULT_PORT+100));
const SKIP_NETWORK=process.argv.includes("--skip-network");
const ACCESS_HEADER={"cf-access-jwt-assertion":"run-all-smokes-access"};
const FETCH_PATCH=path.join(process.cwd(),"_tests","smoke_auth_fetch_patch.js");
const FS_ROOT=path.join(process.cwd(),"_public_sandbox");
const RUN_TMP=path.join(os.tmpdir(),"mcp-tests-run-all-"+process.pid+"-"+Date.now());
require("node:fs").mkdirSync(RUN_TMP,{recursive:true});
const ALL_SCRIPTS=require("./run_all_smoke_scripts.json");
const PUBLIC_SCRIPTS=new Set(["_tests/descriptor_audit.js","_tests/profile_policy_audit.js","_tests/smoke_stage13_public_profile_visibility.js","_tests/smoke_stage13_profile_schema_validator.js","_tests/smoke_stage12_cross_category_spec.js","_tests/smoke_stage2_auth.js","_tests/smoke_stage3_fs.js","_tests/smoke_stage5_1_fs_streaming.js"]);
const NETWORK_SCRIPT="_tests/smoke_stage1_network.js";
function wait(ms){return new Promise(r=>setTimeout(r,ms));}
async function waitHealth(port,headers={}){for(let i=0;i<50;i++){try{const r=await fetch("http://127.0.0.1:"+port+"/healthz",{headers});if(r.ok)return r.json();}catch{}await wait(100)}throw new Error("health timeout on "+port)}
function nodeOptions(env,file){const existing=env.NODE_OPTIONS?String(env.NODE_OPTIONS)+" ":"";return {...env,NODE_OPTIONS:existing+"--require "+JSON.stringify(file)}}
function runNode(script,env,section){return new Promise((resolve,reject)=>{const child=spawn(process.execPath,[script],{cwd:process.cwd(),env,stdio:["ignore","pipe","pipe"]});let stdout="",stderr="";child.stdout.on("data",d=>stdout+=String(d));child.stderr.on("data",d=>stderr+=String(d));child.on("exit",code=>{const result={section,script,stdout:stdout.trim(),stderr:stderr.trim()};if(code===0)resolve(result);else reject(new Error(section+": "+script+" failed with "+code+"\nSTDOUT:\n"+stdout+"\nSTDERR:\n"+stderr))})})}
function startServer(args,env){const child=spawn(process.execPath,["server.js",...args],{cwd:process.cwd(),env,stdio:["ignore","pipe","pipe"]});let output="";child.stdout.on("data",d=>output+=String(d));child.stderr.on("data",d=>output+=String(d));child.getOutput=()=>output;return child}
async function startChecked(args,port,env,headers){const child=startServer([...args,"--port",String(port)],env);try{const health=await waitHealth(port,headers);assert.equal(health.version,"0.40.0");assert.equal(health.stage_status,CURRENT_STAGE_STATUS);return {child,health}}catch(e){child.kill();e.message=e.message+"\nSERVER OUTPUT:\n"+child.getOutput();throw e}}
(async()=>{
const baseEnv={...process.env,MCP_TEST_FS_ROOT:FS_ROOT,MCP_TEST_LOG_DIR:RUN_TMP,MCP_TEST_HEALTH_FULL:"1",MCP_TEST_ACCESS_TRUSTED_PROXY:"1"};
const results=[];
const publicScripts=ALL_SCRIPTS.filter(s=>PUBLIC_SCRIPTS.has(s));
const internalScripts=ALL_SCRIPTS.filter(s=>!PUBLIC_SCRIPTS.has(s)&&s!==NETWORK_SCRIPT);
const publicServer=await startChecked([],DEFAULT_PORT,{...baseEnv,MCP_TEST_PORT:String(DEFAULT_PORT),MCP_TEST_AUDIT_LOG:path.join(RUN_TMP,"public-audit.jsonl")},{});
try{
 assert.equal(publicServer.health.profile,"public");
 const env={...baseEnv,MCP_TEST_SMOKE_URL:"http://127.0.0.1:"+DEFAULT_PORT+"/mcp",MCP_TEST_EXPECTED_PROFILE:"public"};
 for(const script of publicScripts)results.push(await runNode(script,env,"public"));
 if(!SKIP_NETWORK)results.push(await runNode(NETWORK_SCRIPT,env,"public-network"));
}finally{publicServer.child.kill()}
const url="http://127.0.0.1:"+INTERNAL_PORT+"/mcp";
const internalEnv=nodeOptions({...baseEnv,MCP_TEST_PORT:String(INTERNAL_PORT),MCP_TEST_AUDIT_LOG:path.join(RUN_TMP,"internal-audit.jsonl"),MCP_TEST_SMOKE_URL:url,MCP_TEST_EXPECTED_PROFILE:"tests-full",MCP_TEST_SMOKE_HEADERS_JSON:JSON.stringify(ACCESS_HEADER)},FETCH_PATCH);
const internalServer=await startChecked(["--profile","tests","--auth","access"],INTERNAL_PORT,internalEnv,ACCESS_HEADER);
try{
 assert.equal(internalServer.health.profile,"internal");
 for(const script of internalScripts){
  if(script==="_tests/smoke_stage9_harness_no_pollution_guard.js"&&process.env.MCP_TEST_NO_POLLUTION_GUARD_INNER==="1")continue;
  results.push(await runNode(script,internalEnv,"tests-authenticated"));
 }
}finally{internalServer.child.kill()}
console.log(JSON.stringify({ok:true,version:"0.40.0",stage:CURRENT_STAGE_STATUS,sections:{public:publicScripts.length,tests_authenticated:internalScripts.length},results},null,2));
})().catch(e=>{console.error(e?.stack||e?.message||String(e));process.exit(1)});

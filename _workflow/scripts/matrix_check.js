"use strict";

const fs = require("node:fs");
const path = require("node:path");
const ROOT = path.resolve(__dirname, "..", "..");
function read(rel){ return fs.readFileSync(path.join(ROOT, rel), "utf8"); }
function json(rel){ return JSON.parse(read(rel)); }
function exists(rel){ return fs.existsSync(path.join(ROOT, rel)); }
function walk(dir, pred, out=[]){
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return out;
  for (const ent of fs.readdirSync(abs,{withFileTypes:true})) {
    const p = path.join(abs, ent.name);
    const rel = path.relative(ROOT, p).replace(/\\/g,"/");
    if (rel.startsWith("_workflow/historical/") || rel.includes("/node_modules/")) continue;
    if (ent.isDirectory()) walk(rel, pred, out);
    else if (!pred || pred(rel)) out.push(rel);
  }
  return out;
}
function uniq(a){ return [...new Set(a)].sort(); }
function push(findings, severity, code, detail){ findings.push({severity, code, detail}); }
function reAll(text, re, group=1){ const out=[]; for (const m of text.matchAll(re)) out.push(m[group]); return out; }

function auditRootSpecs(findings){
  const rootSpecs = fs.readdirSync(ROOT).filter(n=>n.startsWith("SERVER") && n.endsWith(".json")).sort();
  const state = json("_workflow/state.json");
  const server = json("SERVER_SPEC.json");
  const stateMap = Object.keys(state.root_spec_map||{}).filter(k=>k.startsWith("SERVER")).sort();
  const active = ((server.repository_layout_contract||{}).root_policy||{}).active_root_files || [];
  const missingState = rootSpecs.filter(x=>!stateMap.includes(x));
  const extraState = stateMap.filter(x=>!rootSpecs.includes(x));
  const missingActive = rootSpecs.filter(x=>!active.includes(x));
  const extraActive = active.filter(x=>x.startsWith("SERVER")&&!rootSpecs.includes(x));
  if (missingState.length||extraState.length) push(findings,"error","root_state_map_mismatch",{missingState,extraState});
  if (missingActive.length||extraActive.length) push(findings,"error","active_root_files_mismatch",{missingActive,extraActive});
  for (const file of rootSpecs) { const d = json(file); if (!d.schema_version) push(findings,"error","root_spec_missing_schema",{file}); if (!d.spec_mode) push(findings,"error","root_spec_missing_spec_mode",{file}); }
  return {rootSpecs};
}

function activeJsFiles(){ return ["server.js", ...walk("src", r=>r.endsWith(".js")), ...walk("tools", r=>r.endsWith(".js"))]; }
function auditRuntimeConfig(findings){
  if (!exists("SERVER_RUNTIME_CONFIG_SPEC.json")) { push(findings,"error","missing_runtime_config_spec",{}); return; }
  const spec = json("SERVER_RUNTIME_CONFIG_SPEC.json");
  const codeText = activeJsFiles().map(read).join("\n");
  const env = uniq([...codeText.matchAll(/MCP_TEST_[A-Z0-9_]+/g)].map(m=>m[0]));
  const specEnv = (spec.env_vars||[]).slice().sort();
  const missingEnv = env.filter(x=>!specEnv.includes(x));
  const staleEnv = specEnv.filter(x=>!env.includes(x));
  if (missingEnv.length||staleEnv.length) push(findings,"error","runtime_env_spec_mismatch",{missingEnv,staleEnv});
  const routeText = ["src/runtime/create_server_route_dispatcher.js","src/auth/oauth21_authorization_server.js"].filter(exists).map(read).join("\n");
  const routes = uniq([...routeText.matchAll(/(?:url\.pathname|pathname)\s*===\s*"([^"]+)"/g)].map(m=>m[1]).concat(routeText.includes("/docs/")?["/docs/<id>"]:[]));
  const specRoutes = (spec.http_routes||[]).slice().sort();
  const missingRoutes = routes.filter(x=>!specRoutes.includes(x));
  const staleRoutes = specRoutes.filter(x=>!routes.includes(x));
  if (missingRoutes.length||staleRoutes.length) push(findings,"error","runtime_route_spec_mismatch",{missingRoutes,staleRoutes});
}

function auditCliFlags(findings){
  const spec = exists("SERVER_RUNTIME_CONFIG_SPEC.json") ? json("SERVER_RUNTIME_CONFIG_SPEC.json") : {};
  const text = ["src/runtime/server_cli_args.js","src/runtime/auth_bootstrap_config_resolver.js"].filter(exists).map(read).join("\n");
  const dash = "-" + "-";
  const flagRe = new RegExp(dash + "[a-z0-9-]+", "g");
  const flags = uniq([...text.matchAll(flagRe)].map(m=>m[0]).filter(x=>!x.endsWith("-")).concat(text.includes("oauthFileFlag")?[dash+"oauth-secret-file"]:[]));
  const documented = new Set([...(spec.cli_flags||[]), ...(spec.unsupported_cli_flags||[]), ...(spec.retired_cli_flags||[])]);
  const missing = flags.filter(x=>!documented.has(x));
  if (missing.length) push(findings,"warn","cli_flags_present_but_not_classified",{missing});
}

function auditEvents(findings){
  const text = activeJsFiles().map(read).join("\n");
  const token = "audit" + "Log(\"";
  const events = [];
  for (const part of text.split(token).slice(1)) { const name = part.split("\"")[0]; if (/^[a-z0-9_]+$/.test(name)) events.push(name); }
  const runtimeControllerEvents = [...text.matchAll(/audit\(\"(runtime_restart_[a-z0-9_]+)\"/g)].map(m=>m[1]);
  const oauthEvents = [...text.matchAll(/auditOAuth\(\"(oauth21_[a-z0-9_]+)\"/g)].map(m=>m[1]);
  const uniqEvents = uniq(events.concat(runtimeControllerEvents, oauthEvents));
  if (!exists("SERVER_EVENT_CATALOG_SPEC.json")) { push(findings,"warn","missing_audit_events_spec",{event_count:uniqEvents.length, events:uniqEvents}); return; }
  const spec = json("SERVER_EVENT_CATALOG_SPEC.json");
  const listed = (spec.events||[]).map(e=>typeof e==="string"?e:e.name).sort();
  const missing = uniqEvents.filter(x=>!listed.includes(x));
  const stale = listed.filter(x=>!uniqEvents.includes(x));
  if (missing.length||stale.length) push(findings,"warn","audit_events_spec_mismatch",{missing,stale});
}


function auditPolicyCoverage(findings){
  if (!exists("SERVER_POLICY_COVERAGE_MATRIX_SPEC.json")) { push(findings,"error","missing_policy_coverage_matrix",{}); return; }
  const matrix = json("SERVER_POLICY_COVERAGE_MATRIX_SPEC.json");
  const required = matrix.policies || [];
  for (const p of required) {
    if (p.critical && !exists(p.spec_ref)) push(findings,"error","critical_policy_spec_missing",{id:p.id,spec_ref:p.spec_ref});
    if (p.critical && p.status === "target_missing") push(findings,"error","critical_policy_marked_missing",{id:p.id});
  }
  const missingNonCritical = required.filter(p=>p.required && p.status === "target_missing").map(p=>p.id);
  if (!matrix.rules || matrix.rules.no_complete_claim_if_any_required_policy_target_missing !== true) push(findings,"error","policy_matrix_missing_no_complete_rule",{});
  if (!matrix.rules || matrix.rules.no_complete_claim_if_any_required_policy_not_implemented !== true) push(findings,"error","policy_matrix_missing_nonimplemented_rule",{});
  if (!matrix.rules || matrix.rules.specified_only_is_not_runtime_enforced !== true) push(findings,"error","policy_matrix_missing_specified_only_rule",{});
  if (missingNonCritical.length && matrix.rules.no_complete_claim_if_any_required_policy_target_missing !== true) push(findings,"error","policy_matrix_missing_target_rule",{missingNonCritical});
}

function runMatrixAudit(){
  const findings = [];
  const root = auditRootSpecs(findings);
  auditRuntimeConfig(findings);
  auditCliFlags(findings);
  auditEvents(findings);
  auditPolicyCoverage(findings);
  const summary = { ok: findings.filter(f=>f.severity==="error").length===0, error_count: findings.filter(f=>f.severity==="error").length, warn_count: findings.filter(f=>f.severity==="warn").length, root_spec_count: root.rootSpecs.length };
  const out = { summary, findings };
  return out;
}
if (require.main === module) {
  const out = runMatrixAudit();
  console.log(JSON.stringify(out,null,2));
  if (out.summary.error_count) process.exitCode = 1;
}


module.exports = { runMatrixAudit };

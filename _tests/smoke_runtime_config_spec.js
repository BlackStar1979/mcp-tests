const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ROOT = path.resolve(__dirname, "..");
const spec = JSON.parse(fs.readFileSync(path.join(ROOT, "SERVER_RUNTIME_CONFIG_SPEC.json"), "utf8"));
const rootSpec = JSON.parse(fs.readFileSync(path.join(ROOT, "SERVER_SPEC.json"), "utf8"));
const state = JSON.parse(fs.readFileSync(path.join(ROOT, "_workflow", "state.json"), "utf8"));

assert.equal(spec.schema_version, "mcp-tests-runtime-config-spec-v1");
assert.equal(spec.spec_mode, "canonical_structured_spec_not_progress_log");
assert.ok(Array.isArray(spec.env_vars));
assert.ok(Array.isArray(spec.http_routes));
assert.ok(Array.isArray(spec.cli_flags));

const envFromCode = new Set();
for (const base of ["src", "tools"]) {
  const stack = [path.join(ROOT, base)];
  while (stack.length) {
    const dir = stack.pop();
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) stack.push(p);
      else if (entry.name.endsWith(".js")) {
        const text = fs.readFileSync(p, "utf8");
        for (const m of text.matchAll(/MCP_TEST_[A-Z0-9_]+/g)) envFromCode.add(m[0]);
      }
    }
  }
}
const envInSpec = new Set(spec.env_vars);
for (const name of envFromCode) assert.ok(envInSpec.has(name), `missing env var in runtime config spec: ${name}`);
assert.equal(envInSpec.size, envFromCode.size);

for (const flag of ["--profile", "--self-test", "--allow-query-token", "--trusted-proxy", "--auth", "--port", "--token-file", "--oauth-secret-file"]) {
  assert.ok(spec.cli_flags.includes(flag), `missing CLI flag ${flag}`);
}
for (const route of ["/", "/healthz", "/docs/<id>", "/mcp", "/.well-known/oauth-protected-resource", "/.well-known/oauth-authorization-server", "/register", "/authorize", "/oauth/operator-login", "/token", "/revoke"]) {
  assert.ok(spec.http_routes.includes(route), `missing HTTP route ${route}`);
}

const routeSources = [
  fs.readFileSync(path.join(ROOT, "src", "runtime", "create_server_route_dispatcher.js"), "utf8"),
  fs.readFileSync(path.join(ROOT, "src", "auth", "oauth21_authorization_server.js"), "utf8"),
].join("\n");
const routesFromCode = new Set();
for (const m of routeSources.matchAll(/(?:url\.pathname|pathname)\s*===\s*"([^"]+)"/g)) routesFromCode.add(m[1]);
for (const m of routeSources.matchAll(/pathname\.startsWith\("\/docs\/"\)/g)) routesFromCode.add("/docs/<id>");
for (const route of routesFromCode) assert.ok(spec.http_routes.includes(route), `missing code route in runtime config spec: ${route}`);

assert.deepEqual(spec.protocol_versions, ["2025-06-18", "2025-03-26"]);
assert.equal(spec.behavior_refs.cors, "MCP_TEST_CORS_ALLOW_ORIGIN");
assert.equal(spec.behavior_refs.health_full, "MCP_TEST_HEALTH_FULL");
assert.equal(spec.behavior_refs.batch_limit, "MCP_TEST_MAX_BATCH_ITEMS");

assert.equal(rootSpec.spec_refs.runtime_config, "SERVER_RUNTIME_CONFIG_SPEC.json");
assert.ok(rootSpec.repository_layout_contract.root_policy.active_root_files.includes("SERVER_RUNTIME_CONFIG_SPEC.json"));
assert.equal(state.root_spec_map.SERVER_RUNTIME_CONFIG_SPEC_json, undefined);
assert.ok(Object.hasOwn(state.root_spec_map, "SERVER_RUNTIME_CONFIG_SPEC.json"));
assert.equal(state.runtime_config_spec.env_var_count, spec.env_vars.length);
assert.equal(state.runtime_config_spec.http_route_count, spec.http_routes.length);
assert.equal(spec.stable_mcp_post_accept_policy.route, "/mcp");
assert.equal(spec.stable_mcp_post_accept_policy.http_method, "POST");
assert.equal(spec.stable_mcp_post_accept_policy.stable_response_mode, "json_only");
assert.equal(spec.stable_mcp_get_policy.route, "/mcp");
assert.equal(spec.stable_mcp_get_policy.http_method, "GET");
assert.equal(spec.stable_mcp_get_policy.supported, false);
assert.equal(spec.stable_mcp_get_policy.returns_method_not_allowed, true);
assert.equal(spec.stable_mcp_get_policy.stable_sse_stream_supported, false);
assert.equal(spec.stable_mcp_get_policy.last_event_id_replay_supported, false);
assert.equal(spec.stable_mcp_get_policy.teardown_record, "_workflow/operator_decisions/keep_mcp_get_sse_teardown.md");
assert.equal(spec.stable_mcp_request_contract_bridge.route, "/mcp");
assert.equal(spec.stable_mcp_request_contract_bridge.http_method, "POST");
assert.equal(spec.stable_mcp_request_contract_bridge.server_discover_supported, true);
assert.equal(spec.stable_mcp_request_contract_bridge.server_discover_requires_per_request_metadata, true);
assert.deepEqual(spec.stable_mcp_request_contract_bridge.supported_per_request_versions, ["2025-06-18"]);
assert.equal(spec.stable_mcp_request_contract_bridge.legacy_initialize_still_supported, true);
assert.equal(spec.stable_mcp_request_contract_bridge.tools_list_changed_capability_advertised, false);
assert.equal(spec.stable_mcp_request_contract_bridge.tool_surface_freshness_model, "pull_only_tools_list_ttl0_private");
assert.equal(spec.stable_mcp_request_contract_bridge.record, "_workflow/operator_decisions/keep_mcp_request_contract_bridge.md");
assert.match(spec.tool_surface_state_runtime.purpose, /pull-only tools\/list freshness diagnostics/);
assert.equal(Object.hasOwn(spec, "sessionless_prototype"), false);
assert.equal(spec.retired_sessionless_transition.status, "retired_from_active_repo_and_live_3008");

console.log("smoke_runtime_config_spec ok");

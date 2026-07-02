"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const readJson = (rel) => JSON.parse(read(rel));

const record = read("_workflow/operator_decisions/keep_mcp_no_sse_replacement_package.md");
const state = readJson("_workflow/state.json");
const inventory = readJson("_workflow/sessionless_inventory.json");
const index = read("_workflow/ACTIVE_WORKFLOW_INDEX.md");
const canon = read("_workflow/WORKFLOW_CANON.md");

assert.ok(record.includes("Status: GREEN / REPLACEMENT PACKAGE SCOPED / WORKFLOW-ONLY"));
assert.ok(record.includes("- `/mcp` survives"));
assert.ok(record.includes("- `/mcp/sessionless` is transition-only debt"));
assert.ok(record.includes("per-request `MCP-Protocol-Version` validation"));
assert.ok(record.includes("required `_meta.io.modelcontextprotocol/clientInfo`"));
assert.ok(record.includes("residual unreachable `GET /mcp` SSE helper paths"));
assert.ok(record.includes("residual historical session/SSE helper code"));
assert.ok(record.includes("must not be guessed"));
assert.ok(record.includes("Current official MCP Streamable HTTP direction still allows request-scoped SSE"));
assert.ok(record.includes("project policy"));
assert.ok(record.includes("bounded cleanup of residual session/SSE helpers that are no longer reachable from active `/mcp`"));

assert.equal(state.active_target_direction.replacement_package_record, "_workflow/operator_decisions/keep_mcp_no_sse_replacement_package.md");
assert.equal(inventory.active_target_contract.replacement_package_record, "_workflow/operator_decisions/keep_mcp_no_sse_replacement_package.md");
assert.equal(inventory.active_target_contract.post_accept_cleanup_record, "_workflow/operator_decisions/keep_mcp_post_accept_json_only_cleanup.md");
assert.equal(inventory.active_target_contract.get_sse_teardown_record, "_workflow/operator_decisions/keep_mcp_get_sse_teardown.md");
assert.equal(inventory.active_target_contract.stable_post_mcp_response_mode, "json_only");
assert.equal(inventory.active_target_contract.stable_get_mcp_supported, false);

assert.ok(index.includes("Teardown package for `GET /mcp` SSE, `Last-Event-ID`, and stable stream-path replay semantics."));
assert.ok(canon.includes("GET teardown clarification"));
assert.ok(canon.includes("records the second repo-applied runtime step on the surviving `/mcp` route"));
assert.ok(canon.includes("active scoping record for the surviving `/mcp` route"));
assert.ok(canon.includes("stricter project target"));

console.log("smoke_keep_mcp_no_sse_replacement_package ok");

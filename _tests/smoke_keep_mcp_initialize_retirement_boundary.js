"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const readJson = (rel) => JSON.parse(read(rel));

const record = read("_workflow/operator_decisions/keep_mcp_initialize_retirement_boundary.md");
const noHandshakeEvidence = read("_workflow/operator_decisions/initialize_no_handshake_repo_evidence.md");
const clientCompatibilityEvidence = read("_workflow/operator_decisions/initialize_client_compatibility_evidence.md");
const state = readJson("_workflow/state.json");
const inventory = readJson("_workflow/sessionless_inventory.json");
const canon = read("_workflow/WORKFLOW_CANON.md");
const index = read("_workflow/ACTIVE_WORKFLOW_INDEX.md");
const dispatcher = read("src/runtime/rpc_message_dispatcher.js");
const initHandler = read("src/runtime/initialize_message_handler.js");
const initResponse = read("src/runtime/initialize_response.js");
const discoverHandler = read("src/runtime/server_discover_message_handler.js");
const runtimeSpec = readJson("SERVER_RUNTIME_CONFIG_SPEC.json");

assert.ok(record.includes("Status: GREEN / FINAL LEGACY BOUNDARY RECORDED / WORKFLOW-ONLY"));
assert.ok(noHandshakeEvidence.includes("Status: GREEN / REPO EVIDENCE RECORDED / NO RUNTIME CHANGE"));
assert.ok(clientCompatibilityEvidence.includes("Status: GREEN / CLIENT EVIDENCE RECORDED / WORKFLOW-ONLY"));
assert.ok(noHandshakeEvidence.includes("useful request flow without a preceding legacy `initialize` handshake"));
assert.ok(noHandshakeEvidence.includes("external compatibility evidence for clients/connectors"));
assert.ok(clientCompatibilityEvidence.includes("bounded compatibility shim, not dual-target architecture"));
assert.ok(clientCompatibilityEvidence.includes("still calls legacy `initialize`"));
assert.ok(clientCompatibilityEvidence.includes("does not authorize"));
assert.ok(record.includes("`initialize` is legacy compatibility only."));
assert.ok(record.includes("`server/discover` is the canonical target-facing request-contract surface."));
assert.ok(record.includes("Scope the remaining session-bound outbound/sampling internals that still depend on `McpSession` semantics but are no longer part of the intended active `/mcp` contract."));

assert.equal(state.active_target_direction.initialize_retirement_boundary_record, "_workflow/operator_decisions/keep_mcp_initialize_retirement_boundary.md");
assert.equal(state.active_target_direction.initialize_no_handshake_repo_evidence_record, "_workflow/operator_decisions/initialize_no_handshake_repo_evidence.md");
assert.equal(state.active_target_direction.initialize_client_compatibility_evidence_record, "_workflow/operator_decisions/initialize_client_compatibility_evidence.md");
assert.equal(state.active_target_direction.bounded_initialize_compatibility_shim_allowed_now, true);
assert.equal(state.active_target_direction.bounded_initialize_compatibility_shim_is_end_state, false);
assert.equal(inventory.active_target_contract.initialize_retirement_boundary_record, "_workflow/operator_decisions/keep_mcp_initialize_retirement_boundary.md");
assert.equal(inventory.active_target_contract.initialize_no_handshake_repo_evidence_record, "_workflow/operator_decisions/initialize_no_handshake_repo_evidence.md");
assert.equal(inventory.active_target_contract.initialize_client_compatibility_evidence_record, "_workflow/operator_decisions/initialize_client_compatibility_evidence.md");
assert.equal(inventory.active_target_contract.bounded_initialize_compatibility_shim_allowed_now, true);
assert.equal(inventory.active_target_contract.bounded_initialize_compatibility_shim_is_end_state, false);
assert.ok(inventory.recommended_next.some((item) => item.includes("Initialize-retirement boundary is complete")));
assert.ok(inventory.recommended_next.some((item) => item.includes("Initialize retirement remains blocked only by stable client/connector compatibility evidence")));
assert.ok(inventory.recommended_next.some((item) => item.includes("temporary client-compatibility shim")));
assert.ok(inventory.recommended_next.some((item) => item.includes("State-handle fate decision is complete")));
assert.ok(inventory.recommended_next.some((item) => item.includes("Hidden-route retirement is now live-verified on OAuth21 3008")));
assert.ok(inventory.recommended_next.some((item) => item.includes("Historical /mcp/sessionless live-operation artifacts are quarantined")));
assert.ok(inventory.recommended_next.some((item) => item.includes("transport-session retirement is complete")));

const initLedger = inventory.deprecation_ledger.find((item) => item.feature_id === "initialize_handshake");
assert.equal(initLedger.checklist.find((item) => item.item === "record repo-side no-handshake evidence on surviving /mcp").status, "done");
assert.equal(initLedger.checklist.find((item) => item.item === "record repo-side no-handshake evidence on surviving /mcp").evidence, "_workflow/operator_decisions/initialize_no_handshake_repo_evidence.md");
assert.equal(initLedger.checklist.find((item) => item.item === "record final legacy boundary for initialize on surviving /mcp").status, "done");
assert.equal(initLedger.checklist.find((item) => item.item === "record final legacy boundary for initialize on surviving /mcp").evidence, "_workflow/operator_decisions/keep_mcp_initialize_retirement_boundary.md");
assert.equal(initLedger.checklist.find((item) => item.item === "retire initialize-created transport sessions on surviving /mcp while keeping legacy initialize as stateless compatibility").status, "done");
assert.equal(initLedger.checklist.find((item) => item.item === "record real client evidence that some connectors still call initialize after successful OAuth").status, "done");
assert.equal(initLedger.checklist.find((item) => item.item === "record real client evidence that some connectors still call initialize after successful OAuth").evidence, "_workflow/operator_decisions/initialize_client_compatibility_evidence.md");

assert.ok(canon.includes("Initialize-retirement boundary clarification"));
assert.ok(canon.includes("Initialize-retirement evidence clarification"));
assert.ok(canon.includes("Initialize-compatibility-shim clarification"));
assert.ok(index.includes("keep_mcp_initialize_retirement_boundary.md"));
assert.ok(index.includes("initialize_no_handshake_repo_evidence.md"));
assert.ok(index.includes("initialize_client_compatibility_evidence.md"));
assert.ok(index.includes("Applied the bounded surviving-route transport-session retirement package"));
assert.ok(canon.includes("Transport-session retirement package clarification"));

assert.ok(dispatcher.includes('case "initialize"'));
assert.ok(dispatcher.includes('case "server/discover"'));
assert.ok(initHandler.includes("initialize_received"));
assert.ok(initResponse.includes("instructions:"));
assert.ok(discoverHandler.includes("legacyInitializeSupported"));
assert.ok(discoverHandler.includes("legacy_initialize_supported: legacyInitializeSupported"));
assert.ok(discoverHandler.includes("streamable_http_stateless_no_initialize"));
assert.ok(discoverHandler.includes("protocol_sessions: false"));
assert.equal(runtimeSpec.stable_mcp_request_contract_bridge.legacy_initialize_still_supported, true);
assert.equal(runtimeSpec.stable_mcp_request_contract_bridge.stable_protocol_sessions, false);

console.log("smoke_keep_mcp_initialize_retirement_boundary ok");

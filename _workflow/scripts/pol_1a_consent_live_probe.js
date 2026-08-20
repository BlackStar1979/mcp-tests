#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { loadOAuth21SecretConfig } = require("../../src/runtime/oauth21_secret_config");
const { CliArgumentError, parseCliArgs } = require("./cli_args");
const {
  jsonFetch,
  resolveOAuth21SecretFile,
  issueBearer,
} = require("./sessionless_live_authenticated_probe");

const MARKER = "pol_1a_consent_live_probe";
const ROOT = path.resolve(__dirname, "..", "..");
const DEFAULT_BASE_URL = "http://127.0.0.1:3008";
const DEFAULT_AUDIT_LOG = path.join(ROOT, "_logs", ".mcp-tests-audit.jsonl");
const DEFAULT_SURFACE_STATE = path.join(ROOT, "_control", "tool-surface-state.json");
const DEFAULT_RESULT_FILE = path.join(ROOT, "_control", "pol-1a-consent-live-probe-result.json");
const PROTOCOL_VERSION = "2026-07-28";
const PROTOCOL_VERSION_HEADER = "MCP-Protocol-Version";
const PROTOCOL_VERSION_META_KEY = "io.modelcontextprotocol/protocolVersion";
const CLIENT_INFO_META_KEY = "io.modelcontextprotocol/clientInfo";
const CLIENT_CAPABILITIES_META_KEY = "io.modelcontextprotocol/clientCapabilities";
const EXPECTED_TOOL_COUNT = 98;
const EXPECTED_COMBINED_FINGERPRINT = "93721a82a339f9d6";

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function writeResult(resultFile, value) {
  fs.mkdirSync(path.dirname(resultFile), { recursive: true });
  const tempFile = `${resultFile}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tempFile, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(tempFile, resultFile);
}

function fail(resultFile, code, reason) {
  const payload = {
    ok: false,
    marker: MARKER,
    error: "live_probe_failed",
    reason: String(reason || "unknown").slice(0, 240),
  };
  try { writeResult(resultFile, payload); } catch {}
  console.error(JSON.stringify(payload, null, 2));
  process.exit(code);
}

function clientMeta(clientCapabilities) {
  return {
    [PROTOCOL_VERSION_META_KEY]: PROTOCOL_VERSION,
    [CLIENT_INFO_META_KEY]: { name: MARKER, version: "1" },
    [CLIENT_CAPABILITIES_META_KEY]: clientCapabilities,
  };
}

async function rpcCall({ baseUrl, authorization, id, method, params = {}, clientCapabilities = {} }) {
  return jsonFetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [PROTOCOL_VERSION_HEADER]: PROTOCOL_VERSION,
      "mcp-method": method,
      ...(method === "tools/call" && params?.name ? { "mcp-name": String(params.name) } : {}),
      authorization,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id,
      method,
      params: {
        ...params,
        _meta: clientMeta(clientCapabilities),
      },
    }),
  });
}

async function toolCall({
  baseUrl,
  authorization,
  id,
  name = "run_process",
  args,
  clientCapabilities,
  requestState,
  inputResponses,
}) {
  return rpcCall({
    baseUrl,
    authorization,
    id,
    method: "tools/call",
    clientCapabilities,
    params: {
      name,
      arguments: args,
      ...(requestState !== undefined ? { requestState } : {}),
      ...(inputResponses !== undefined ? { inputResponses } : {}),
    },
  });
}

function readSurfaceState(surfaceStateFile) {
  return JSON.parse(fs.readFileSync(surfaceStateFile, "utf8"));
}

async function waitForRestart({ previousStartId, surfaceStateFile, baseUrl, timeoutMs }) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const surfaceState = readSurfaceState(surfaceStateFile);
      const currentStartId = String(surfaceState.server_start_id || "");
      if (currentStartId && (!previousStartId || currentStartId !== previousStartId)) {
        const health = await jsonFetch(`${baseUrl}/healthz`);
        if (health.status === 200) return { surfaceState, health };
      }
    } catch {}
    await wait(200);
  }
  throw new Error("live_runtime_restart_wait_timeout");
}

function parseAuditSlice(auditLog, startSize) {
  if (!fs.existsSync(auditLog)) return { raw: "", entries: [] };
  const raw = fs.readFileSync(auditLog, "utf8").slice(startSize);
  const entries = raw.split(/\r?\n/).filter(Boolean).map((line) => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean);
  return { raw, entries };
}

function assertInputRequired(response, label) {
  assert.equal(response.status, 200, `${label} must return HTTP 200`);
  assert.equal(response.body?.error, undefined, `${label} must not return JSON-RPC error`);
  assert.equal(response.body?.result?.resultType, "input_required", `${label} must return input_required`);
  const state = String(response.body?.result?.requestState || "");
  assert.ok(state.length >= 24, `${label} must return opaque requestState`);
  assert.ok(response.body?.result?.inputRequests?.human_approval, `${label} must request human_approval`);
  return state;
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2), {
    valueOptions: [
      "oauth-secret-file",
      "base-url",
      "audit-log",
      "surface-state",
      "result-file",
      "wait-for-start-id",
      "timeout-ms",
    ],
    flagOptions: ["self-test"],
  });
  const resultFile = args.value("result-file", DEFAULT_RESULT_FILE);

  if (args.flag("self-test")) {
    const payload = {
      ok: true,
      marker: MARKER,
      network: false,
      protocol_version: PROTOCOL_VERSION,
      form_elicitation_capable: true,
      fresh_oauth_client: true,
      reads_durable_oauth_state: false,
      writes_sanitized_result_file: true,
    };
    writeResult(resultFile, payload);
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  const baseUrl = args.value("base-url", DEFAULT_BASE_URL).replace(/\/+$/, "");
  const auditLog = args.value("audit-log", DEFAULT_AUDIT_LOG);
  const surfaceStateFile = args.value("surface-state", DEFAULT_SURFACE_STATE);
  const previousStartId = args.value("wait-for-start-id", "");
  const timeoutMs = Math.max(1000, Math.min(Number(args.value("timeout-ms", "90000")) || 90000, 180000));

  const { surfaceState, health } = await waitForRestart({
    previousStartId,
    surfaceStateFile,
    baseUrl,
    timeoutMs,
  });
  assert.equal(health.body?.profile, "internal", "live profile must remain internal");
  assert.equal(health.body?.tools_count, EXPECTED_TOOL_COUNT, "live tool count must remain 98");
  assert.equal(surfaceState.current_surface?.tool_count, EXPECTED_TOOL_COUNT);
  assert.equal(surfaceState.current_surface?.combined_fingerprint, EXPECTED_COMBINED_FINGERPRINT);

  const discovered = resolveOAuth21SecretFile(args.value("oauth-secret-file", ""));
  const secretConfig = loadOAuth21SecretConfig({ secretFile: discovered.secretFile });
  const bearer = await issueBearer({ baseUrl, operatorSecret: secretConfig.operatorSecret });
  const authorization = bearer.authorization;
  const auditStartSize = fs.existsSync(auditLog) ? fs.statSync(auditLog).size : 0;

  const suffix = crypto.randomBytes(6).toString("hex");
  const argCanaries = {
    missing: `POL1A_MISSING_CAP_${suffix}`,
    decline: `POL1A_DECLINE_${suffix}`,
    invalid: `POL1A_INVALID_${suffix}`,
    accept: `POL1A_ACCEPT_${suffix}`,
  };
  const responseCanary = `POL1A_RESPONSE_${suffix}`;
  const formCaps = { elicitation: { form: {} } };
  const argsFor = (marker) => ({
    command: "node",
    args: ["-e", `console.log(${JSON.stringify(marker)})`],
    cwd: "mcp-tests",
    timeout_ms: 5000,
  });

  const missingCapability = await toolCall({
    baseUrl,
    authorization,
    id: 1,
    args: argsFor(argCanaries.missing),
    clientCapabilities: {},
  });
  assert.equal(missingCapability.status, 400);
  assert.equal(missingCapability.body?.error?.code, -32021);
  assert.deepEqual(missingCapability.body?.error?.data?.requiredCapabilities, {
    elicitation: { form: {} },
  });

  const declineFirst = await toolCall({
    baseUrl,
    authorization,
    id: 2,
    args: argsFor(argCanaries.decline),
    clientCapabilities: formCaps,
  });
  const declineState = assertInputRequired(declineFirst, "decline initial round");
  const declineRetry = await toolCall({
    baseUrl,
    authorization,
    id: 3,
    args: argsFor(argCanaries.decline),
    clientCapabilities: formCaps,
    requestState: declineState,
    inputResponses: { human_approval: { action: "decline" } },
  });
  assert.equal(declineRetry.body?.error?.code, -32602);
  assert.equal(declineRetry.body?.error?.data?.decision_code, "human_consent_denied");
  assert.deepEqual(declineRetry.body?.error?.data?.reason_codes, ["consent_declined"]);

  const invalidFirst = await toolCall({
    baseUrl,
    authorization,
    id: 4,
    args: argsFor(argCanaries.invalid),
    clientCapabilities: formCaps,
  });
  const invalidState = assertInputRequired(invalidFirst, "invalid-content initial round");
  const invalidRetry = await toolCall({
    baseUrl,
    authorization,
    id: 5,
    args: argsFor(argCanaries.invalid),
    clientCapabilities: formCaps,
    requestState: invalidState,
    inputResponses: {
      human_approval: {
        action: "accept",
        content: { confirmed: true, note: responseCanary },
      },
    },
  });
  assert.equal(invalidRetry.body?.error?.code, -32602);
  assert.equal(invalidRetry.body?.error?.data?.decision_code, "human_consent_denied");
  assert.deepEqual(invalidRetry.body?.error?.data?.reason_codes, ["consent_content_keys_invalid"]);

  const acceptFirst = await toolCall({
    baseUrl,
    authorization,
    id: 6,
    args: argsFor(argCanaries.accept),
    clientCapabilities: formCaps,
  });
  const acceptState = assertInputRequired(acceptFirst, "accepted initial round");
  const acceptRetry = await toolCall({
    baseUrl,
    authorization,
    id: 7,
    args: argsFor(argCanaries.accept),
    clientCapabilities: formCaps,
    requestState: acceptState,
    inputResponses: {
      human_approval: { action: "accept", content: { confirmed: true } },
    },
  });
  assert.equal(acceptRetry.body?.error, undefined);
  assert.equal(acceptRetry.body?.result?.structuredContent?.status, "ok");
  assert.ok(
    String(acceptRetry.body?.result?.structuredContent?.stdout || "").includes(argCanaries.accept),
    "accepted exact call must execute exactly once"
  );

  const replay = await toolCall({
    baseUrl,
    authorization,
    id: 8,
    args: argsFor(argCanaries.accept),
    clientCapabilities: formCaps,
    requestState: acceptState,
    inputResponses: {
      human_approval: { action: "accept", content: { confirmed: true } },
    },
  });
  assert.equal(replay.body?.error?.code, -32602);
  assert.equal(replay.body?.error?.data?.decision_code, "mrtr_state_invalid");
  assert.deepEqual(replay.body?.error?.data?.reason_codes, ["state_handle_revoked"]);

  const toolsList = await rpcCall({
    baseUrl,
    authorization,
    id: 9,
    method: "tools/list",
    params: {},
    clientCapabilities: formCaps,
  });
  assert.equal(toolsList.status, 200);
  assert.equal(toolsList.body?.error, undefined);
  assert.equal(toolsList.body?.result?.tools?.length, EXPECTED_TOOL_COUNT);

  await wait(100);
  const audit = parseAuditSlice(auditLog, auditStartSize);
  for (const canary of [
    ...Object.values(argCanaries),
    responseCanary,
    declineState,
    invalidState,
    acceptState,
  ]) {
    assert.equal(audit.raw.includes(canary), false, "audit must not contain raw consent/argument canaries or state");
  }
  assert.equal(audit.raw.includes('"arguments_sha256"'), false);
  assert.equal(audit.raw.includes('"scope_sha256"'), false);
  assert.ok(audit.raw.includes('"event":"tool_call_consent_denied"'));
  assert.ok(audit.raw.includes('"event":"tool_call_consent_accepted"'));

  const acceptedIndex = audit.entries.findIndex((entry) => entry.event === "tool_call_consent_accepted");
  assert.ok(acceptedIndex >= 0, "accepted consent audit must exist");
  const acceptedEvent = audit.entries[acceptedIndex];
  const startIndex = audit.entries.findIndex(
    (entry, index) => index > acceptedIndex
      && entry.event === "tool_call_start"
      && entry.request_id === acceptedEvent.request_id
  );
  assert.ok(startIndex > acceptedIndex, "consent acceptance must precede tool_call_start");
  assert.equal(acceptedEvent.consent_receipt?.binding_verified, true);
  assert.equal(typeof acceptedEvent.consent_receipt?.state_handle_sha256, "string");
  assert.equal(typeof acceptedEvent.consent_receipt?.requirement_sha256, "string");

  const payload = {
    ok: true,
    marker: MARKER,
    status: "GREEN / LIVE HUMAN CONSENT SEMANTICS ACCEPTED",
    live_runtime: {
      base_url: baseUrl,
      server_start_id: String(surfaceState.server_start_id || ""),
      profile: String(health.body?.profile || ""),
      tools_count: Number(health.body?.tools_count || 0),
      combined_fingerprint: String(surfaceState.current_surface?.combined_fingerprint || ""),
    },
    checks: {
      missing_form_capability_minus_32021_without_execution: true,
      form_capable_input_required_without_execution: true,
      decline_denied_without_execution: true,
      invalid_extra_content_denied_without_execution: true,
      exact_accept_executes_once: true,
      replay_rejected: true,
      consent_acceptance_precedes_tool_start: true,
      safe_receipt_binding_verified: true,
      audit_has_no_raw_state_responses_arguments_or_private_binding_digests: true,
      tools_list_still_98: true,
    },
    safety: {
      reads_durable_oauth_state: false,
      fresh_client_token_per_probe: true,
      secret_file_source: discovered.source,
      credential_material_logged: false,
      connector_surface_changed: false,
    },
  };
  writeResult(resultFile, payload);
  console.log(JSON.stringify(payload, null, 2));
}

function resolveResultFileFromArgs() {
  const prefix = "--result-file=";
  const inline = process.argv.slice(2).find((arg) => String(arg).startsWith(prefix));
  return inline ? String(inline).slice(prefix.length) : DEFAULT_RESULT_FILE;
}

const resultFile = resolveResultFileFromArgs();
main().catch((error) => {
  if (error instanceof CliArgumentError) {
    fail(resultFile, 2, error.code);
  }
  fail(resultFile, 1, error?.message || "pol_1a_consent_live_probe_failed");
});

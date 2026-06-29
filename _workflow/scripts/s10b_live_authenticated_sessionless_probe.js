#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { loadOAuth21SecretConfig } = require("../../src/runtime/oauth21_secret_config");

const MARKER = "s10b_live_authenticated_sessionless_probe";
const ROOT = path.resolve(__dirname, "..", "..");
const DEFAULT_BASE_URL = "http://127.0.0.1:3008";
const DEFAULT_AUDIT_LOG = path.join(ROOT, "_logs", ".mcp-tests-audit.jsonl");
const PROTOCOL_VERSION = "2025-06-18";
const PROTOCOL_VERSION_HEADER = "MCP-Protocol-Version";
const PROTOCOL_VERSION_META_KEY = "io.modelcontextprotocol/protocolVersion";
const CLIENT_INFO_META_KEY = "io.modelcontextprotocol/clientInfo";
const CLIENT_CAPABILITIES_META_KEY = "io.modelcontextprotocol/clientCapabilities";
const REDIRECT_URI = "http://localhost/cb";

function argValue(name, fallback = "") {
  const prefix = `--${name}=`;
  const hit = process.argv.slice(2).find((item) => item.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function fail(code, error, extra = {}) {
  console.error(JSON.stringify({ ok: false, marker: MARKER, error, ...extra }, null, 2));
  process.exit(code);
}

function b64url(buffer) {
  return Buffer.from(buffer).toString("base64url");
}

function sha256Base64Url(text) {
  return b64url(crypto.createHash("sha256").update(text).digest());
}

async function jsonFetch(url, init = {}) {
  const response = await fetch(url, init);
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  return { response, status: response.status, text, body, headers: response.headers };
}

function parseSecretFilePath(commandLine) {
  const match = String(commandLine || "").match(/--oauth-secret-file(?:=|\s+)(?:"([^"]+)"|([^\s"]+))/i);
  return match ? String(match[1] || match[2] || "").trim() : "";
}

function resolvePowerShellBinary() {
  const candidates = [
    process.env.CodexShell,
    process.env.POWERSHELL,
    process.env.PWSH,
    "C:\\Program Files\\PowerShell\\7\\pwsh.exe",
    "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
    "pwsh",
    "powershell",
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (candidate.includes("\\") || candidate.includes("/")) {
      if (fs.existsSync(candidate)) return candidate;
      continue;
    }
    return candidate;
  }
  return "powershell";
}

function discoverOAuth21SecretFile() {
  if (process.platform === "win32") {
    const ps = [
      "$p=Get-CimInstance Win32_Process |",
      "Where-Object { $_.CommandLine -match 'server\\.js' -and $_.CommandLine -match '--auth oauth21' -and $_.CommandLine -match '--port 3008' } |",
      "Select-Object -First 1 ProcessId,CommandLine;",
      "if (-not $p) { exit 3 }",
      "$p | ConvertTo-Json -Compress",
    ].join(" ");
    const encoded = Buffer.from(ps, "utf16le").toString("base64");
    const result = spawnSync(resolvePowerShellBinary(), ["-NoProfile", "-EncodedCommand", encoded], { cwd: ROOT, encoding: "utf8" });
    if (result.status !== 0) {
      throw new Error("oauth21_live_process_not_found");
    }
    const parsed = JSON.parse(String(result.stdout || "{}"));
    const secretFile = parseSecretFilePath(parsed.CommandLine || "");
    if (!secretFile) throw new Error("oauth21_secret_file_not_discoverable");
    return { processId: Number(parsed.ProcessId || 0), commandLine: String(parsed.CommandLine || ""), secretFile };
  }

  const result = spawnSync("ps", ["-eo", "pid=,args="], { cwd: ROOT, encoding: "utf8" });
  if (result.status !== 0) throw new Error("process_list_failed");
  for (const line of String(result.stdout || "").split(/\r?\n/)) {
    if (!line.includes("server.js") || !line.includes("--auth oauth21") || !line.includes("--port 3008")) continue;
    const trimmed = line.trim();
    const pidMatch = trimmed.match(/^(\d+)\s+/);
    const secretFile = parseSecretFilePath(trimmed);
    if (secretFile) {
      return {
        processId: pidMatch ? Number(pidMatch[1]) : 0,
        commandLine: trimmed,
        secretFile,
      };
    }
  }
  throw new Error("oauth21_live_process_not_found");
}

function resolveOAuth21SecretFile() {
  const override = argValue("oauth-secret-file", "");
  if (override) return { processId: 0, commandLine: "", secretFile: override, source: "cli_override" };
  try {
    const discovered = discoverOAuth21SecretFile();
    return { ...discovered, source: "live_process_discovery" };
  } catch (_) {}
  const defaultFile = path.join(os.homedir(), ".romion", "tests_oauth_secret.json");
  if (fs.existsSync(defaultFile)) {
    return { processId: 0, commandLine: "", secretFile: defaultFile, source: "default_local_secret_file" };
  }
  throw new Error("oauth21_secret_file_not_available");
}

function rpcPayload(id, method, params = {}) {
  return {
    jsonrpc: "2.0",
    id,
    method,
    params: {
      ...params,
      _meta: {
        [PROTOCOL_VERSION_META_KEY]: PROTOCOL_VERSION,
        [CLIENT_INFO_META_KEY]: { name: MARKER, version: "1" },
        [CLIENT_CAPABILITIES_META_KEY]: { experimental: { sessionlessProbe: true } },
      },
    },
  };
}

async function issueBearer({ baseUrl, operatorSecret }) {
  const registration = await jsonFetch(`${baseUrl}/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      redirect_uris: [REDIRECT_URI],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    }),
  });
  assert.equal(registration.status, 201, "oauth21 DCR must succeed");
  assert.ok(registration.body && registration.body.client_id, "oauth21 DCR must return client_id");

  const verifier = b64url(crypto.randomBytes(32));
  const authorize = new URL(`${baseUrl}/authorize`);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("client_id", registration.body.client_id);
  authorize.searchParams.set("redirect_uri", REDIRECT_URI);
  authorize.searchParams.set("code_challenge", sha256Base64Url(verifier));
  authorize.searchParams.set("code_challenge_method", "S256");
  authorize.searchParams.set("state", `${MARKER}-${Date.now()}`);
  authorize.searchParams.set("scope", "mcp:tools");

  const authorizeResponse = await fetch(authorize, { redirect: "manual" });
  assert.equal(authorizeResponse.status, 302, "oauth21 authorize must redirect");
  const loginLocation = String(authorizeResponse.headers.get("location") || "");
  const pid = new URL(loginLocation).searchParams.get("pid");
  assert.ok(pid, "oauth21 authorize redirect must contain pid");

  const login = await fetch(`${baseUrl}/oauth/operator-login`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ pid, password: operatorSecret }),
    redirect: "manual",
  });
  assert.equal(login.status, 302, "oauth21 operator login must redirect");
  const callbackLocation = String(login.headers.get("location") || "");
  const code = new URL(callbackLocation).searchParams.get("code");
  assert.ok(code, "oauth21 callback must contain authorization code");

  const token = await jsonFetch(`${baseUrl}/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      client_id: registration.body.client_id,
      code_verifier: verifier,
    }),
  });
  assert.equal(token.status, 200, "oauth21 token exchange must succeed");
  assert.ok(token.body && token.body.access_token, "oauth21 token exchange must return access_token");
  return {
    clientId: String(registration.body.client_id),
    authorization: `Bearer ${token.body.access_token}`,
  };
}

async function rpcCall({ baseUrl, authorization, id, method, params = {} }) {
  return jsonFetch(`${baseUrl}/mcp/sessionless`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [PROTOCOL_VERSION_HEADER]: PROTOCOL_VERSION,
      authorization,
    },
    body: JSON.stringify(rpcPayload(id, method, params)),
  });
}

async function listTools(baseUrl, authorization) {
  return jsonFetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 101, method: "tools/list", params: {} }),
  });
}

async function main() {
  if (hasFlag("self-test")) {
    console.log(JSON.stringify({
      ok: true,
      marker: MARKER,
      network: false,
      uses_fresh_oauth_flow: true,
      reads_durable_oauth_state: false,
      discovers_live_secret_file: true,
    }, null, 2));
    return;
  }

  const baseUrl = argValue("base-url", DEFAULT_BASE_URL).replace(/\/+$/, "");
  const auditLog = argValue("audit-log", DEFAULT_AUDIT_LOG);
  const discovered = resolveOAuth21SecretFile();
  const secretConfig = loadOAuth21SecretConfig({ secretFile: discovered.secretFile });

  const auditStartSize = fs.existsSync(auditLog) ? fs.statSync(auditLog).size : 0;
  const health = await jsonFetch(`${baseUrl}/healthz`);
  assert.equal(health.status, 200, "healthz must succeed");
  assert.equal(health.body.profile, "internal");
  assert.equal(health.body.tools_count, 43);

  const getProbe = await jsonFetch(`${baseUrl}/mcp/sessionless`);
  assert.equal(getProbe.status, 405, "GET /mcp/sessionless must return 405");
  assert.equal(getProbe.body && getProbe.body.error, "sessionless_prototype_post_only");

  const unauthenticatedPost = await jsonFetch(`${baseUrl}/mcp/sessionless`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [PROTOCOL_VERSION_HEADER]: PROTOCOL_VERSION,
    },
    body: JSON.stringify(rpcPayload(1, "server/discover")),
  });
  assert.equal(unauthenticatedPost.status, 401, "Unauthenticated POST must return 401");

  const clientA = await issueBearer({ baseUrl, operatorSecret: secretConfig.operatorSecret });
  const clientB = await issueBearer({ baseUrl, operatorSecret: secretConfig.operatorSecret });

  const discover = await rpcCall({ baseUrl, authorization: clientA.authorization, id: 2, method: "server/discover" });
  assert.equal(discover.status, 200);
  assert.ok(Array.isArray(discover.body.result.supportedVersions));
  assert.ok(discover.body.result.supportedVersions.includes(PROTOCOL_VERSION));

  const create = await rpcCall({
    baseUrl,
    authorization: clientA.authorization,
    id: 3,
    method: "state/handle/create",
    params: {
      kind: "tool_workflow_state",
      payload: { owner: "clientA", marker: "sanitized" },
      ttlMs: 60000,
    },
  });
  assert.equal(create.status, 200);
  const handle = String(create.body.result && create.body.result.state_handle || "");
  assert.ok(handle.startsWith("esh_"), "state handle must use esh_ prefix");

  const ownerRead = await rpcCall({
    baseUrl,
    authorization: clientA.authorization,
    id: 4,
    method: "state/handle/read",
    params: { state_handle: handle, kind: "tool_workflow_state" },
  });
  assert.equal(ownerRead.status, 200);
  assert.deepEqual(ownerRead.body.result.payload, { owner: "clientA", marker: "sanitized" });

  const otherRead = await rpcCall({
    baseUrl,
    authorization: clientB.authorization,
    id: 5,
    method: "state/handle/read",
    params: { state_handle: handle, kind: "tool_workflow_state" },
  });
  assert.equal(otherRead.status, 200);
  assert.equal(otherRead.body.error.data.reason, "state_handle_unauthorized");
  assert.equal(otherRead.text.includes(handle), false, "cross-client denial must not echo raw handle");

  const destroy = await rpcCall({
    baseUrl,
    authorization: clientA.authorization,
    id: 6,
    method: "state/handle/destroy",
    params: { state_handle: handle, kind: "tool_workflow_state" },
  });
  assert.equal(destroy.status, 200);
  assert.equal(destroy.body.result.destroyed, true);

  const revokedRead = await rpcCall({
    baseUrl,
    authorization: clientA.authorization,
    id: 7,
    method: "state/handle/read",
    params: { state_handle: handle, kind: "tool_workflow_state" },
  });
  assert.equal(revokedRead.status, 200);
  assert.equal(revokedRead.body.error.data.reason, "state_handle_revoked");
  assert.equal(revokedRead.text.includes(handle), false, "revoked denial must not echo raw handle");

  const toolsList = await listTools(baseUrl, clientA.authorization);
  assert.equal(toolsList.status, 200);
  const currentSurface = {
    tool_count: Array.isArray(toolsList.body.result && toolsList.body.result.tools) ? toolsList.body.result.tools.length : 0,
    tool_names_hash: String(toolsList.body.result && toolsList.body.result._meta && toolsList.body.result._meta["mcp-tests/toolNamesHash"] || ""),
    combined_fingerprint: String(toolsList.body.result && toolsList.body.result._meta && toolsList.body.result._meta["mcp-tests/toolSurfaceFingerprint"] || ""),
  };
  assert.equal(currentSurface.tool_count, 43);
  assert.equal(currentSurface.tool_names_hash, "8b62ecaf89227335");
  assert.equal(currentSurface.combined_fingerprint, "476c7d832021acb9");

  const auditSlice = fs.existsSync(auditLog) ? fs.readFileSync(auditLog, "utf8").slice(auditStartSize) : "";
  assert.ok(auditSlice.includes("sessionless_prototype_rpc"), "audit must contain sessionless prototype events");
  assert.equal(auditSlice.includes(handle), false, "audit must not contain raw handle");

  console.log(JSON.stringify({
    ok: true,
    marker: MARKER,
    status: "GREEN / LIVE AUTHENTICATED SESSIONLESS PROBE PASSED / CONNECTOR UNCHANGED",
    live_runtime: {
      base_url: baseUrl,
      process_id: discovered.processId,
      profile: health.body.profile,
      tools_count: health.body.tools_count,
    },
    connector_unchanged: {
      tool_count: currentSurface.tool_count,
      tool_names_hash: currentSurface.tool_names_hash,
      combined_fingerprint: currentSurface.combined_fingerprint,
    },
    checks: {
      healthz_internal_43: true,
      get_405: true,
      unauthenticated_post_401: true,
      discover_supported_2025_06_18: true,
      create_opaque_esh_handle: true,
      owner_read_payload: true,
      second_client_denied_without_raw_echo: true,
      destroy_true: true,
      revoked_without_raw_echo: true,
      audit_no_raw_handle: true,
    },
    safety: {
      reads_durable_oauth_state: false,
      fresh_client_token_per_probe: true,
      secret_file_source: discovered.source,
      credential_material_logged: false,
    },
  }, null, 2));
}

main().catch((error) => {
  fail(1, error && error.message ? error.message : "s10b_live_probe_failed");
});

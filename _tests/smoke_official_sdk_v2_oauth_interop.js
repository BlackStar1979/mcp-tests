"use strict";

// End-to-end OAuth 2.1 interoperability with the official MCP TypeScript
// client v2, including process-restart persistence. The server, OAuth store,
// audit log, and port are all hermetic.

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const {
  Client,
  StreamableHTTPClientTransport,
  UnauthorizedError,
} = require("@modelcontextprotocol/client");
const { withHermeticServerControlEnv } = require("./helpers/hermetic_server_control_env");

const ROOT = path.resolve(__dirname, "..");
const CLIENT_VERSION = "2.0.0";

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function waitHealth(issuer) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${issuer}/healthz`);
      if (response.ok) return response.json();
    } catch {}
    await wait(100);
  }
  throw new Error("official SDK v2 OAuth interop health timeout");
}

async function stopChild(child) {
  if (child.exitCode !== null) return;
  child.kill();
  await Promise.race([once(child, "exit"), wait(3000)]);
  if (child.exitCode === null) {
    child.kill("SIGKILL");
    await Promise.race([once(child, "exit"), wait(3000)]);
  }
}

function createHermeticEnv(tempRoot, overrides) {
  const env = { ...process.env };
  for (const key of [
    "MCP_TEST_OAUTH_STATE_FILE",
    "MCP_TEST_OAUTH_CLIENTS_FILE",
    "MCP_TEST_OAUTH_STORAGE_FILE",
    "MCP_TEST_OAUTH_OPERATOR_SECRET",
    "MCP_TEST_OAUTH_ISSUER",
    "MCP_TEST_PUBLIC_BASE_URL",
  ]) {
    delete env[key];
  }
  return withHermeticServerControlEnv({ ...env, ...overrides }, path.join(tempRoot, "control"));
}

function startHermeticServer({ tempRoot, auditPath, storagePath, issuer, operatorSecret, port }) {
  const child = spawn(
    process.execPath,
    ["server.js", "--profile", "tests", "--auth", "oauth21", "--port", String(port)],
    {
      cwd: ROOT,
      env: createHermeticEnv(tempRoot, {
        MCP_TEST_AUDIT_LOG: auditPath,
        MCP_TEST_FS_ROOT: path.join(ROOT, "_public_sandbox"),
        MCP_TEST_OAUTH_ISSUER: issuer,
        MCP_TEST_OAUTH_OPERATOR_SECRET: operatorSecret,
        MCP_TEST_OAUTH_STORAGE_FILE: storagePath,
        MCP_TEST_PUBLIC_BASE_URL: issuer,
      }),
      stdio: ["ignore", "pipe", "pipe"],
    }
  );

  let output = "";
  child.stdout.on("data", (data) => { output += String(data); });
  child.stderr.on("data", (data) => { output += String(data); });
  return { child, getOutput: () => output };
}

function readAudit(auditPath) {
  const raw = fs.readFileSync(auditPath, "utf8");
  return {
    raw,
    entries: raw.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line)),
  };
}

class MemoryOAuthProvider {
  constructor(redirectUrl) {
    this._redirectUrl = new URL(redirectUrl);
    this._state = crypto.randomBytes(24).toString("base64url");
    this._clientInformation = new Map();
    this._tokens = new Map();
    this._lastIssuer = "";
    this._codeVerifier = "";
    this._discoveryState = undefined;
    this._resourceUrl = "";
    this.authorizationUrls = [];
    this.savedTokenHistory = [];
  }

  get redirectUrl() {
    return this._redirectUrl;
  }

  get clientMetadata() {
    return {
      client_name: "mcp-tests official SDK v2 OAuth smoke",
      redirect_uris: [this._redirectUrl.toString()],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      scope: "mcp:tools",
    };
  }

  state() {
    return this._state;
  }

  clientInformation(ctx) {
    return this._clientInformation.get(ctx?.issuer || this._lastIssuer);
  }

  saveClientInformation(clientInformation, ctx) {
    const issuer = ctx?.issuer || clientInformation.issuer;
    assert.ok(issuer, "SDK stamps registered client information with its issuer");
    this._lastIssuer = issuer;
    this._clientInformation.set(issuer, { ...clientInformation });
  }

  tokens(ctx) {
    return this._tokens.get(ctx?.issuer || this._lastIssuer);
  }

  saveTokens(tokens, ctx) {
    const issuer = ctx?.issuer || tokens.issuer;
    assert.ok(issuer, "SDK stamps stored tokens with their issuer");
    this._lastIssuer = issuer;
    const stored = { ...tokens };
    this._tokens.set(issuer, stored);
    this.savedTokenHistory.push(stored);
  }

  redirectToAuthorization(authorizationUrl) {
    this.authorizationUrls.push(new URL(authorizationUrl));
  }

  saveCodeVerifier(codeVerifier) {
    this._codeVerifier = codeVerifier;
  }

  codeVerifier() {
    return this._codeVerifier;
  }

  saveDiscoveryState(discoveryState) {
    this._discoveryState = structuredClone(discoveryState);
  }

  discoveryState() {
    return this._discoveryState && structuredClone(this._discoveryState);
  }

  saveResourceUrl(resourceUrl) {
    this._resourceUrl = resourceUrl;
  }

  resourceUrl() {
    return this._resourceUrl || undefined;
  }

  invalidateCredentials(scope) {
    if (scope === "all" || scope === "client") this._clientInformation.clear();
    if (scope === "all" || scope === "tokens") this._tokens.clear();
    if (scope === "all" || scope === "verifier") this._codeVerifier = "";
    if (scope === "all" || scope === "discovery") this._discoveryState = undefined;
  }

  currentTokens() {
    return this._tokens.get(this._lastIssuer);
  }

  poisonAccessToken() {
    const current = this.currentTokens();
    assert.ok(current?.refresh_token, "refresh token exists before forced refresh");
    const invalidAccessToken = `invalid-${crypto.randomBytes(16).toString("hex")}`;
    this._tokens.set(this._lastIssuer, {
      ...current,
      access_token: invalidAccessToken,
    });
    return invalidAccessToken;
  }
}

async function authorizeOperator({ authorizationUrl, issuer, operatorSecret, expectedState }) {
  assert.equal(authorizationUrl.origin, issuer, "authorization endpoint uses discovered issuer");
  assert.equal(authorizationUrl.pathname, "/authorize", "SDK uses the authorization endpoint");
  assert.equal(authorizationUrl.searchParams.get("state"), expectedState, "SDK preserves provider state");
  assert.equal(authorizationUrl.searchParams.get("resource"), `${issuer}/mcp`, "SDK binds the grant to the MCP resource");
  assert.equal(authorizationUrl.searchParams.get("code_challenge_method"), "S256", "SDK uses PKCE S256");

  const authorizeResponse = await fetch(authorizationUrl, { redirect: "manual" });
  assert.equal(authorizeResponse.status, 302, "authorization request reaches operator login");
  const loginUrl = new URL(authorizeResponse.headers.get("location"));
  const pid = loginUrl.searchParams.get("pid");
  assert.ok(pid, "operator login carries a pending authorization id");

  const loginResponse = await fetch(`${issuer}/oauth/operator-login`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      pid,
      client_id: authorizationUrl.searchParams.get("client_id"),
      redirect_uri: authorizationUrl.searchParams.get("redirect_uri"),
      scope: authorizationUrl.searchParams.get("scope"),
      password: operatorSecret,
    }),
    redirect: "manual",
  });
  assert.equal(loginResponse.status, 302, "operator authorization succeeds");

  const callback = new URL(loginResponse.headers.get("location"));
  assert.equal(callback.searchParams.get("state"), expectedState, "host validates callback state");
  assert.equal(callback.searchParams.get("iss"), issuer, "callback carries RFC 9207 issuer");
  assert.ok(callback.searchParams.get("code"), "callback carries authorization code");
  return callback;
}

async function connectAndExercise({
  mcpUrl,
  provider,
  label,
  options = { versionNegotiation: { mode: "auto" } },
  expectedEra = "modern",
  expectedVersion = "2026-07-28",
}) {
  const clientName = `mcp-tests-official-sdk-oauth-${label}`;
  const client = new Client({ name: clientName, version: CLIENT_VERSION }, options || undefined);
  const transport = new StreamableHTTPClientTransport(new URL(mcpUrl), { authProvider: provider });
  await client.connect(transport);
  try {
    assert.equal(client.getProtocolEra(), expectedEra, `${label} uses expected protocol era`);
    assert.equal(client.getNegotiatedProtocolVersion(), expectedVersion, `${label} negotiates expected protocol`);

    const toolList = await client.listTools();
    assert.ok(toolList.tools.length >= 80, `${label} receives the authenticated tool surface`);
    for (const toolName of [
      "get_info",
      "build_index",
      "cbm_index_repository",
      "memory_search",
      "process_start",
      "process_status",
      "process_output",
      "process_cancel",
    ]) {
      assert.ok(toolList.tools.some((tool) => tool.name === toolName), `${label} exposes ${toolName}`);
    }

    const call = await client.callTool({ name: "get_info", arguments: { path: "." } });
    assert.notEqual(call.isError, true, `${label} authenticated tool call succeeds`);
    assert.equal(call.structuredContent?.success, true, `${label} returns structured success`);
    assert.equal(call.structuredContent?.type, "directory", `${label} reads the workspace root`);

    const started = await client.callTool({
      name: "process_start",
      arguments: {
        command: "node",
        args: ["-e", "process.stdout.write('oauth-process-ok')"],
        cwd: "mcp-tests",
        timeout_ms: 5000,
      },
    });
    assert.notEqual(started.isError, true, `${label} starts an async process job`);
    const jobId = started.structuredContent?.job_id;
    assert.equal(typeof jobId, "string", `${label} receives an async process job id`);

    let terminalStatus = null;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const status = await client.callTool({
        name: "process_status",
        arguments: { job_id: jobId },
      });
      if (status.structuredContent?.terminal === true) {
        terminalStatus = status.structuredContent;
        break;
      }
      await wait(20);
    }
    assert.equal(terminalStatus?.status, "ok", `${label} completes the async process job`);

    const output = await client.callTool({
      name: "process_output",
      arguments: { job_id: jobId, max_chars: 65536 },
    });
    assert.equal(output.structuredContent?.stdout, "oauth-process-ok", `${label} reads async output by cursor`);
    assert.equal(output.structuredContent?.stdout_eof, true, `${label} reaches async stdout EOF`);

    if (label === "authorized-modern") {
      const longJob = await client.callTool({
        name: "process_start",
        arguments: {
          command: "node",
          args: ["-e", "setTimeout(() => {}, 5000)"],
          cwd: "mcp-tests",
          timeout_ms: 10000,
        },
      });
      const cancelled = await client.callTool({
        name: "process_cancel",
        arguments: {
          job_id: longJob.structuredContent?.job_id,
          reason: "oauth_e2e_cancel",
        },
      });
      assert.equal(cancelled.structuredContent?.status, "cancelled", `${label} cancels an owned async process job`);
      assert.equal(cancelled.structuredContent?.terminal, true, `${label} observes terminal cancellation`);
    }
  } finally {
    await client.close().catch(() => {});
  }
  return clientName;
}

(async () => {
  const packageJson = JSON.parse(fs.readFileSync(
    path.join(ROOT, "node_modules", "@modelcontextprotocol", "client", "package.json"),
    "utf8"
  ));
  assert.equal(packageJson.version, CLIENT_VERSION, "official client version is pinned");

  const port = await freePort();
  const issuer = `http://127.0.0.1:${port}`;
  const mcpUrl = `${issuer}/mcp`;
  const operatorSecret = `oauth-smoke-${crypto.randomBytes(24).toString("base64url")}`;
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-tests-official-sdk-v2-oauth-"));
  const auditPath = path.join(tempRoot, "audit.jsonl");
  const storagePath = path.join(tempRoot, "oauth.sqlite");
  const provider = new MemoryOAuthProvider("http://127.0.0.1/callback");
  const serverProcesses = [];
  let activeServer = startHermeticServer({
    tempRoot,
    auditPath,
    storagePath,
    issuer,
    operatorSecret,
    port,
  });
  serverProcesses.push(activeServer);

  try {
    const health = await waitHealth(issuer);
    assert.equal(health.auth.mode, "oauth21", "hermetic server uses OAuth 2.1");

    const bootstrapClient = new Client(
      { name: "mcp-tests-official-sdk-oauth-bootstrap", version: CLIENT_VERSION },
      { versionNegotiation: { mode: "auto" } }
    );
    const bootstrapTransport = new StreamableHTTPClientTransport(new URL(mcpUrl), {
      authProvider: provider,
    });

    let bootstrapError;
    try {
      await bootstrapClient.connect(bootstrapTransport);
    } catch (error) {
      bootstrapError = error;
    }
    assert.ok(bootstrapError instanceof UnauthorizedError, "first connection requests operator authorization");
    assert.equal(provider.authorizationUrls.length, 1, "SDK initiates exactly one browser authorization");
    assert.ok(provider.clientInformation({ issuer }), "SDK persists DCR client information by issuer");
    assert.ok(provider.discoveryState(), "SDK persists OAuth discovery state for callback validation");

    const callback = await authorizeOperator({
      authorizationUrl: provider.authorizationUrls[0],
      issuer,
      operatorSecret,
      expectedState: provider._state,
    });
    await bootstrapTransport.finishAuth(callback.searchParams);

    const initialTokens = { ...provider.currentTokens() };
    assert.ok(initialTokens.access_token, "authorization code exchange stores an access token");
    assert.ok(initialTokens.refresh_token, "authorization code exchange stores a refresh token");
    assert.equal(initialTokens.issuer, issuer, "tokens retain the authorization-server issuer stamp");

    const authorizedClientName = await connectAndExercise({
      mcpUrl,
      provider,
      label: "authorized-modern",
    });

    await stopChild(activeServer.child);
    activeServer = startHermeticServer({
      tempRoot,
      auditPath,
      storagePath,
      issuer,
      operatorSecret,
      port,
    });
    serverProcesses.push(activeServer);
    const restartedHealth = await waitHealth(issuer);
    assert.equal(restartedHealth.auth.mode, "oauth21", "restarted server preserves OAuth 2.1 mode");

    const resumedAfterRestartClientName = await connectAndExercise({
      mcpUrl,
      provider,
      label: "resumed-modern-after-restart",
    });
    assert.equal(provider.authorizationUrls.length, 1, "restart does not reopen operator authorization");

    const poisonedAccessToken = provider.poisonAccessToken();
    const refreshedLegacyClientName = await connectAndExercise({
      mcpUrl,
      provider,
      label: "refreshed-legacy-after-restart",
      options: null,
      expectedEra: "legacy",
      expectedVersion: "2025-11-25",
    });
    const refreshedTokens = provider.currentTokens();
    assert.notEqual(refreshedTokens.access_token, initialTokens.access_token, "401 recovery rotates the access token");
    assert.notEqual(refreshedTokens.refresh_token, initialTokens.refresh_token, "401 recovery rotates the refresh token");
    assert.equal(provider.authorizationUrls.length, 1, "refresh does not reopen operator authorization");

    const resumedModernClientName = await connectAndExercise({
      mcpUrl,
      provider,
      label: "resumed-modern-after-refresh",
    });

    assert.ok(fs.existsSync(storagePath), "OAuth state is persisted to the hermetic SQLite store");
    assert.ok(fs.statSync(storagePath).size > 0, "hermetic SQLite store is non-empty");

    const audit = readAudit(auditPath);
    assert.equal(
      audit.entries.filter((entry) => entry.event === "oauth21_operator_login_accepted").length,
      1,
      "server audit records one operator authorization"
    );
    assert.equal(
      audit.entries.filter((entry) => entry.event === "oauth21_refresh_token_accepted").length,
      1,
      "restarted server records automatic refresh-token rotation"
    );
    assert.equal(
      audit.entries.filter((entry) => entry.event === "server_start").length,
      2,
      "audit records both hermetic server processes"
    );
    assert.ok(
      audit.entries.some((entry) => (
        entry.event === "oauth21_clients_loaded"
        && entry.backend === "sqlite"
        && entry.client_count >= 1
      )),
      "restarted process loads the registered SDK client from SQLite"
    );
    assert.ok(
      audit.entries.some((entry) => (
        entry.event === "oauth21_state_loaded"
        && entry.backend === "sqlite"
        && entry.access_count >= 1
        && entry.refresh_count >= 1
      )),
      "restarted process loads active access and refresh tokens from SQLite"
    );
    assert.deepEqual(
      audit.entries
        .filter((entry) => entry.event === "server_discover_received")
        .map((entry) => entry.client_name),
      [authorizedClientName, resumedAfterRestartClientName, resumedModernClientName],
      "authenticated modern SDK sessions use the discovery path"
    );
    assert.deepEqual(
      audit.entries
        .filter((entry) => entry.event === "initialize_received")
        .map((entry) => entry.client_name),
      [refreshedLegacyClientName],
      "authenticated legacy SDK session uses initialize"
    );
    assert.equal(
      audit.entries.filter((entry) => entry.event === "tool_call_end" && entry.tool === "get_info").length,
      4,
      "all authenticated sessions complete a real authorized tool call"
    );
    for (const eventName of [
      "process_job_queued",
      "process_job_started",
      "process_job_completed",
      "process_job_output_read",
      "process_job_cancelled",
    ]) {
      assert.ok(
        audit.entries.some((entry) => entry.event === eventName),
        `async process lifecycle records ${eventName}`
      );
    }
    assert.ok(
      audit.entries.some((entry) => (
        entry.event === "tool_call_decision"
        && entry.decision_receipt?.redacted_context?.tool === "process_start"
        && entry.decision_receipt?.reason_codes?.includes("guarded_process_execution")
      )),
      "central runtime policy explicitly authorizes guarded process execution"
    );
    assert.equal(audit.raw.includes("oauth-process-ok"), false, "audit log does not expose process output");
    assert.equal(audit.raw.includes("oauth_e2e_cancel"), false, "audit log does not expose raw cancellation reasons");
    for (const secret of [
      operatorSecret,
      callback.searchParams.get("code"),
      provider._codeVerifier,
      poisonedAccessToken,
      ...provider.savedTokenHistory.flatMap((tokens) => [tokens.access_token, tokens.refresh_token]),
    ].filter(Boolean)) {
      assert.equal(audit.raw.includes(secret), false, "audit log does not expose OAuth secrets or tokens");
    }
  } catch (error) {
    const serverOutput = serverProcesses.map((item) => item.getOutput()).filter(Boolean).join("\n");
    if (serverOutput) console.error(serverOutput);
    throw error;
  } finally {
    await stopChild(activeServer.child);
    fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }

  console.log("smoke_official_sdk_v2_oauth_interop ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});

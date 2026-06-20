"use strict";

const AUTH_DEFAULT_PORTS = Object.freeze({
  none: 3009,
  access: 3005,
  bearer: 3006,
  oauth: 3007,
  oauth21: 3008,
});

const AUTH_PUBLIC_BASE_URLS = Object.freeze({
  none: "https://mcp-tests.romionologic.dev",
  access: "https://mcp-tests-access.romionologic.dev",
  bearer: "https://mcp-tests-bearer.romionologic.dev",
});

const AUTH_MODE_STATUS = Object.freeze({
  none: "current_fallback",
  access: "planned_cloudflare_access_presence_check",
  bearer: "planned_token_file_bearer",
  oauth: "reserved_future_not_implemented",
  oauth21: "reserved_future_not_implemented",
});

const VALID_AUTH_MODES = new Set(Object.keys(AUTH_DEFAULT_PORTS));
const RESERVED_AUTH_MODES = new Set(["oauth", "oauth21"]);
const HARD_FALLBACK_PORT = 3009;
const HARD_FALLBACK_HOST = "127.0.0.1";
const HARD_FALLBACK_PUBLIC_BASE_URL = AUTH_PUBLIC_BASE_URLS.none;

function normalizeAuthMode(value, source) {
  const mode = String(value || "none").trim().toLowerCase();
  if (!VALID_AUTH_MODES.has(mode)) {
    throw new Error(`Invalid auth mode from ${source}: ${mode}. Allowed values: none, access, bearer, oauth, oauth21.`);
  }
  return mode;
}

function parsePort(value, source) {
  const text = String(value || "").trim();
  if (!/^\d+$/.test(text)) {
    throw new Error(`Invalid port from ${source}: ${value}`);
  }

  const port = Number(text);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port from ${source}: ${value}`);
  }

  return port;
}

function takeNextArg(args, index, name) {
  const next = args[index + 1];
  if (next === undefined || String(next).startsWith("--")) {
    throw new Error(`Missing value for ${name}`);
  }
  return { value: String(next), nextIndex: index + 1 };
}

function parseBootstrapArgs(argv = []) {
  const args = Array.from(argv || []).map((arg) => String(arg));
  const parsed = {
    authMode: undefined,
    port: undefined,
    tokenFile: undefined,
    allowQueryToken: false,
    trustedProxy: false,
    selfTest: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--self-test") {
      parsed.selfTest = true;
      continue;
    }

    if (arg === "--allow-query-token") {
      parsed.allowQueryToken = true;
      continue;
    }

    if (arg === "--trusted-proxy") {
      parsed.trustedProxy = true;
      continue;
    }

    if (arg === "--auth") {
      const next = takeNextArg(args, index, "--auth");
      parsed.authMode = next.value;
      index = next.nextIndex;
      continue;
    }

    if (arg.startsWith("--auth=")) {
      parsed.authMode = arg.slice("--auth=".length);
      if (!parsed.authMode) throw new Error("Missing value for --auth");
      continue;
    }

    if (arg === "--port") {
      const next = takeNextArg(args, index, "--port");
      parsed.port = next.value;
      index = next.nextIndex;
      continue;
    }

    if (arg.startsWith("--port=")) {
      parsed.port = arg.slice("--port=".length);
      if (!parsed.port) throw new Error("Missing value for --port");
      continue;
    }

    if (arg === "--token-file") {
      const next = takeNextArg(args, index, "--token-file");
      parsed.tokenFile = next.value;
      index = next.nextIndex;
      continue;
    }

    if (arg.startsWith("--token-file=")) {
      parsed.tokenFile = arg.slice("--token-file=".length);
      if (!parsed.tokenFile) throw new Error("Missing value for --token-file");
      continue;
    }

    throw new Error(`Unsupported bootstrap argument: ${arg}`);
  }

  return parsed;
}

function resolveAuthBootstrapConfig({ argv = [], env = process.env } = {}) {
  const parsed = parseBootstrapArgs(argv);
  const envMap = env || {};

  const authModeSource = parsed.authMode !== undefined
    ? "cli"
    : envMap.MCP_TEST_AUTH_MODE
      ? "env"
      : "auth_default";
  const authMode = normalizeAuthMode(
    parsed.authMode !== undefined ? parsed.authMode : envMap.MCP_TEST_AUTH_MODE || "none",
    authModeSource
  );

  const authDefaultPort = AUTH_DEFAULT_PORTS[authMode] || HARD_FALLBACK_PORT;
  const portSource = parsed.port !== undefined
    ? "cli"
    : envMap.MCP_TEST_PORT
      ? "env"
      : authDefaultPort
        ? "auth_default"
        : "hard_fallback";
  const port = parsed.port !== undefined
    ? parsePort(parsed.port, "cli")
    : envMap.MCP_TEST_PORT
      ? parsePort(envMap.MCP_TEST_PORT, "env")
      : authDefaultPort || HARD_FALLBACK_PORT;

  const hostSource = envMap.MCP_TEST_HOST ? "env" : "hard_fallback";
  const host = String(envMap.MCP_TEST_HOST || HARD_FALLBACK_HOST).trim() || HARD_FALLBACK_HOST;
  const hostWide = !["127.0.0.1", "localhost", "::1"].includes(host);
  const allowPublicBind = ["1", "true", "yes", "on"].includes(String(envMap.MCP_TEST_ALLOW_PUBLIC_BIND || "").trim().toLowerCase());
  if (hostWide && authMode === "none" && !allowPublicBind) {
    throw new Error("Refusing to bind auth.none server to non-localhost host without MCP_TEST_ALLOW_PUBLIC_BIND=1.");
  }

  const tokenFileSource = parsed.tokenFile !== undefined
    ? "cli"
    : envMap.MCP_TEST_TOKEN_FILE
      ? "env"
      : "unset";
  const tokenFile = parsed.tokenFile !== undefined
    ? String(parsed.tokenFile)
    : envMap.MCP_TEST_TOKEN_FILE
      ? String(envMap.MCP_TEST_TOKEN_FILE)
      : "";
  const envAllowQueryToken = ["1", "true", "yes", "on"].includes(
    String(envMap.MCP_TEST_BEARER_ALLOW_QUERY_TOKEN || "").trim().toLowerCase()
  );
  const allowQueryToken = parsed.allowQueryToken || envAllowQueryToken;
  const allowQueryTokenSource = parsed.allowQueryToken ? "cli" : envAllowQueryToken ? "env" : "default";

  const envTrustedProxy = ["1", "true", "yes", "on"].includes(
    String(envMap.MCP_TEST_ACCESS_TRUSTED_PROXY || "").trim().toLowerCase()
  );
  const trustedProxy = parsed.trustedProxy || envTrustedProxy;
  const trustedProxySource = parsed.trustedProxy ? "cli" : envTrustedProxy ? "env" : "default";

  const publicBaseUrlSource = envMap.MCP_TEST_PUBLIC_BASE_URL ? "env" : "auth_default";
  const publicBaseUrl = String(
    envMap.MCP_TEST_PUBLIC_BASE_URL || AUTH_PUBLIC_BASE_URLS[authMode] || HARD_FALLBACK_PUBLIC_BASE_URL
  ).replace(/\/+$/, "");

  return {
    authMode,
    authModeSource,
    authModeStatus: AUTH_MODE_STATUS[authMode],
    authModeReserved: RESERVED_AUTH_MODES.has(authMode),
    port,
    portSource,
    host,
    hostSource,
    tokenFile,
    tokenFileSource,
    allowQueryToken,
    allowQueryTokenSource,
    trustedProxy,
    trustedProxySource,
    publicBaseUrl,
    publicBaseUrlSource,
    selfTest: parsed.selfTest === true,
    authDefaultPort,
  };
}

module.exports = {
  AUTH_DEFAULT_PORTS,
  AUTH_MODE_STATUS,
  AUTH_PUBLIC_BASE_URLS,
  HARD_FALLBACK_HOST,
  HARD_FALLBACK_PORT,
  HARD_FALLBACK_PUBLIC_BASE_URL,
  RESERVED_AUTH_MODES,
  VALID_AUTH_MODES,
  parseBootstrapArgs,
  resolveAuthBootstrapConfig,
};

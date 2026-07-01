"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  AUTH_DEFAULT_PORTS,
  parseBootstrapArgs,
  resolveAuthBootstrapConfig,
} = require("../src/runtime/auth_bootstrap_config_resolver");

const ROOT = path.resolve(__dirname, "..");
const POLICY_PATH = path.join(ROOT, "_workflow", "policies", "stage11_auth_port_policy.json");
const SERVER_PATH = path.join(ROOT, "server.js");
const BOOTSTRAP_RUNTIME_PATH = path.join(ROOT, "src", "runtime", "server_bootstrap_runtime.js");

function env(overrides = {}) {
  return { ...overrides };
}

function mustThrow(fn, pattern) {
  assert.throws(fn, pattern);
}

assert.deepEqual(AUTH_DEFAULT_PORTS, { none: 3009, oauth: 3007, oauth21: 3008 });

{
  const config = resolveAuthBootstrapConfig({ argv: [], env: env() });
  assert.equal(config.authMode, "none");
  assert.equal(config.authModeSource, "auth_default");
  assert.equal(config.port, 3009);
  assert.equal(config.portSource, "auth_default");
  assert.equal(config.authDefaultPort, 3009);
  assert.equal(config.host, "127.0.0.1");
  assert.equal(config.hostSource, "hard_fallback");
  assert.equal(config.tokenFile, "");
  assert.equal(config.tokenFileSource, "unset");
  assert.equal(config.selfTest, false);
}

mustThrow(
  () => resolveAuthBootstrapConfig({ argv: [], env: env({ MCP_TEST_AUTH_MODE: "bearer" }) }),
  /Retired auth mode/
);

mustThrow(
  () => resolveAuthBootstrapConfig({ argv: [], env: env({ MCP_TEST_AUTH_MODE: "access" }) }),
  /Retired auth mode/
);

{
  const config = resolveAuthBootstrapConfig({
    argv: [],
    env: env({ MCP_TEST_AUTH_MODE: "oauth" }),
  });
  assert.equal(config.authMode, "oauth");
  assert.equal(config.port, 3007);
  assert.equal(config.authModeReserved, true);
  assert.equal(config.authModeStatus, "legacy_resource_server_validation_not_target_live_instance");
}

{
  const config = resolveAuthBootstrapConfig({
    argv: [],
    env: env({ MCP_TEST_AUTH_MODE: "oauth21" }),
  });
  assert.equal(config.authMode, "oauth21");
  assert.equal(config.port, 3008);
  assert.equal(config.authModeReserved, false);
  assert.equal(config.authModeStatus, "active_local_oauth21_authorization_server");
}

mustThrow(
  () => resolveAuthBootstrapConfig({ argv: [], env: env({ MCP_TEST_AUTH_MODE: "bearer", MCP_TEST_PORT: "4010" }) }),
  /Retired auth mode/
);

mustThrow(
  () => resolveAuthBootstrapConfig({ argv: ["--port", "4011"], env: env({ MCP_TEST_AUTH_MODE: "bearer", MCP_TEST_PORT: "4010" }) }),
  /Retired auth mode/
);

mustThrow(
  () => resolveAuthBootstrapConfig({ argv: ["--auth=access"], env: env({ MCP_TEST_AUTH_MODE: "bearer" }) }),
  /Retired auth mode/
);

{
  const config = resolveAuthBootstrapConfig({
    argv: ["--token-file", "C:\\Work\\mcp-tests\\.secrets\\future-token.txt"],
    env: env({ MCP_TEST_TOKEN_FILE: "C:\\should\\not\\win.txt" }),
  });
  assert.equal(config.tokenFile, "C:\\Work\\mcp-tests\\.secrets\\future-token.txt");
  assert.equal(config.tokenFileSource, "cli");
}

{
  const config = resolveAuthBootstrapConfig({
    argv: [],
    env: env({ MCP_TEST_TOKEN_FILE: "C:\\Work\\mcp-tests\\.secrets\\env-token.txt" }),
  });
  assert.equal(config.tokenFile, "C:\\Work\\mcp-tests\\.secrets\\env-token.txt");
  assert.equal(config.tokenFileSource, "env");
}

{
  const parsed = parseBootstrapArgs(["--self-test"]);
  assert.equal(parsed.selfTest, true);
  const config = resolveAuthBootstrapConfig({ argv: ["--self-test"], env: env() });
  assert.equal(config.selfTest, true);
}

mustThrow(
  () => resolveAuthBootstrapConfig({ argv: ["--auth", "bearer", "--port=4555", "--token-file=relative-token.txt"], env: env({ MCP_TEST_HOST: "0.0.0.0" }) }),
  /Retired auth mode/
);

mustThrow(
  () => resolveAuthBootstrapConfig({ argv: ["--auth", "invalid"], env: env() }),
  /Invalid auth mode/
);
mustThrow(
  () => resolveAuthBootstrapConfig({ argv: ["--port", "0"], env: env() }),
  /Invalid port/
);
mustThrow(
  () => resolveAuthBootstrapConfig({ argv: [], env: env({ MCP_TEST_PORT: "not-a-port" }) }),
  /Invalid port/
);
mustThrow(
  () => parseBootstrapArgs(["--token-file"]),
  /Missing value/
);

const serverSource = fs.readFileSync(SERVER_PATH, "utf8");
const bootstrapRuntimeSource = fs.readFileSync(BOOTSTRAP_RUNTIME_PATH, "utf8");
assert.match(
  serverSource,
  /runServerBootstrapRuntime\s*\(\s*\{/,
  "server.js runtime startup must delegate to the bootstrap runtime after Step38X"
);
assert.match(
  bootstrapRuntimeSource,
  /const\s+bootstrapConfig\s*=\s*resolveAuthBootstrapConfig\s*\(/,
  "server bootstrap runtime must use the bootstrap resolver after Step38X"
);
assert.match(
  bootstrapRuntimeSource,
  /const\s+host\s*=\s*bootstrapConfig\.host/,
  "server bootstrap runtime host must come from resolved bootstrap config after Step38X"
);
assert.match(
  bootstrapRuntimeSource,
  /const\s+port\s*=\s*bootstrapConfig\.port/,
  "server bootstrap runtime port must come from resolved bootstrap config after Step38X"
);

console.log("smoke_auth_bootstrap_config_resolver ok");

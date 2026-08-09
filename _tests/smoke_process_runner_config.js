"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  buildProcessEnv,
  prepareProcessInvocation,
  resolveProcessRunnerConfig,
} = require("../src/util/process_runner_config");
const { RUN_PROCESS_INPUT_SCHEMA } = require("../src/schemas/process_tools");
const { safeWorkspacePath } = require("../src/util/workspace_roots");

function assertConfigFailure(env, pattern) {
  assert.throws(() => resolveProcessRunnerConfig(env), pattern);
}

const config = resolveProcessRunnerConfig({});

assert.equal(config.defaultTimeoutMs, 60000);
assert.equal(config.maxTimeoutMs, 600000);
assert.equal(config.defaultOutputChars, 250000);
assert.equal(config.hardOutputChars, 1000000);
assert.equal(config.maxConcurrent, 2);
assert.equal(config.maxQueued, 8);
assert.equal(config.maxRetained, 32);
assert.equal(config.retentionMs, 1800000);
assert.equal(config.allowedCommands.includes("docker"), true);
assert.equal(config.allowedCommands.includes("docker-compose"), true);
assert.equal(config.allowedCommands.includes("kubectl"), false);

assertConfigFailure({ MCP_PROCESS_MAX_TIMEOUT_MS: "NaN" }, /finite integer/i);
assertConfigFailure({ MCP_PROCESS_TIMEOUT_MS: "1.5" }, /finite integer/i);
assertConfigFailure({ MCP_PROCESS_MAX_TIMEOUT_MS: "700000" }, /between 100 and 600000/i);
assertConfigFailure(
  { MCP_PROCESS_TIMEOUT_MS: "1001", MCP_PROCESS_MAX_TIMEOUT_MS: "1000" },
  /must not exceed MCP_PROCESS_MAX_TIMEOUT_MS/i
);
assertConfigFailure(
  { MCP_PROCESS_MAX_OUTPUT_CHARS: "1001", MCP_PROCESS_HARD_OUTPUT_CHARS: "1000" },
  /must not exceed MCP_PROCESS_HARD_OUTPUT_CHARS/i
);

assert.equal(RUN_PROCESS_INPUT_SCHEMA.properties.timeout_ms.default, 60000);
assert.equal(RUN_PROCESS_INPUT_SCHEMA.properties.timeout_ms.maximum, 600000);
assert.equal(RUN_PROCESS_INPUT_SCHEMA.properties.max_output_chars.default, 250000);
assert.equal(RUN_PROCESS_INPUT_SCHEMA.properties.max_output_chars.maximum, 1000000);

const nodeInvocation = prepareProcessInvocation({
  command: "node",
  args: ["--version"],
  cwd: ".",
}, config);
assert.equal(nodeInvocation.logicalCommand, "node");
assert.equal(nodeInvocation.executable, process.execPath);
assert.equal(nodeInvocation.family, "runtime");
assert.equal(nodeInvocation.resolutionClass, "pinned_node_runtime");

assert.throws(
  () => buildProcessEnv("runtime", { PATH: "C:\\attacker" }, config),
  /reserved environment variable: PATH/i
);
assert.throws(
  () => buildProcessEnv("runtime", { NODE_OPTIONS: "--require attacker.js" }, config),
  /reserved environment variable: NODE_OPTIONS/i
);
assert.throws(
  () => buildProcessEnv("container", { KUBECONFIG: "C:\\attacker" }, config),
  /reserved environment variable: KUBECONFIG/i
);

const inherited = buildProcessEnv("runtime", {}, config, {
  PATH: "C:\\trusted",
  PATHEXT: ".EXE;.CMD",
  SYSTEMROOT: "C:\\Windows",
  PYTHONPATH: "C:\\unsafe-python",
  NODE_PATH: "C:\\unsafe-node",
  KUBECONFIG: "C:\\unsafe-kube",
  MCP_PROCESS_TIMEOUT_MS: "999999",
});
assert.equal(inherited.PATH, "C:\\trusted");
assert.equal(inherited.PATHEXT, ".EXE;.CMD");
assert.equal(inherited.SYSTEMROOT, "C:\\Windows");
assert.equal(Object.hasOwn(inherited, "PYTHONPATH"), false);
assert.equal(Object.hasOwn(inherited, "NODE_PATH"), false);
assert.equal(Object.hasOwn(inherited, "KUBECONFIG"), false);
assert.equal(Object.hasOwn(inherited, "MCP_PROCESS_TIMEOUT_MS"), false);

const packageEnv = buildProcessEnv("package", {}, config, {
  PATH: "C:\\trusted",
  HTTPS_PROXY: "http://proxy.example",
  DOCKER_HOST: "tcp://docker.example",
});
assert.equal(packageEnv.HTTPS_PROXY, "http://proxy.example");
assert.equal(Object.hasOwn(packageEnv, "DOCKER_HOST"), false);

const dockerEnv = buildProcessEnv("container", {}, config, {
  PATH: "C:\\trusted",
  HTTPS_PROXY: "http://proxy.example",
  DOCKER_HOST: "npipe:////./pipe/docker_engine",
});
assert.equal(dockerEnv.HTTPS_PROXY, "http://proxy.example");
assert.equal(dockerEnv.DOCKER_HOST, "npipe:////./pipe/docker_engine");

const repo = safeWorkspacePath("mcp-tests");
const fixtureRoot = fs.mkdtempSync(path.join(repo.absolutePath, "_tmp-process-runner-config-"));
try {
  const relativeCwd = path.relative(repo.rootPath, fixtureRoot).replaceAll("\\", "/");
  const pythonPath = path.join(
    fixtureRoot,
    ".venv",
    process.platform === "win32" ? "Scripts/python.exe" : "bin/python"
  );
  fs.mkdirSync(path.dirname(pythonPath), { recursive: true });
  fs.writeFileSync(pythonPath, "fixture", "utf8");

  const pipInvocation = prepareProcessInvocation({
    command: "pip",
    args: ["--version"],
    cwd: relativeCwd,
  }, config);
  assert.equal(pipInvocation.executable, pythonPath);
  assert.deepEqual(pipInvocation.prefixArgs, ["-m", "pip"]);
  assert.equal(pipInvocation.resolutionClass, "workspace_python_venv");

  const packageRoot = path.join(fixtureRoot, "node_modules", "typescript");
  const tscPath = path.join(packageRoot, "bin", "tsc.js");
  fs.mkdirSync(path.dirname(tscPath), { recursive: true });
  fs.writeFileSync(
    path.join(packageRoot, "package.json"),
    JSON.stringify({ name: "typescript", bin: { tsc: "bin/tsc.js" } }),
    "utf8"
  );
  fs.writeFileSync(tscPath, "fixture", "utf8");

  const tscInvocation = prepareProcessInvocation({
    command: "tsc",
    args: ["--noEmit"],
    cwd: relativeCwd,
  }, config);
  assert.equal(tscInvocation.executable, process.execPath);
  assert.deepEqual(tscInvocation.prefixArgs, [tscPath]);
  assert.equal(tscInvocation.resolutionClass, "workspace_node_package");
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}

console.log("smoke_process_runner_config ok");

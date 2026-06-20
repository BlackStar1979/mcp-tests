"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const childProcess = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function check(rel) {
  const result = childProcess.spawnSync(process.execPath, ["--check", rel], { cwd: ROOT, encoding: "utf8" });
  assert.equal(result.status, 0, `${rel} syntax check failed\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
}

check("server.js");
check("src/runtime/server_cli_args.js");
check("src/runtime/static_docs.js");

const server = read("server.js");
const bootstrap = read("src/runtime/server_bootstrap_runtime.js");
assert.ok(bootstrap.includes("./server_cli_args"));
assert.ok(bootstrap.includes("./static_docs"));
assert.equal(server.includes("function parseServerCliArgs"), false);
assert.equal(server.includes("const DOCS = ["), false);
assert.equal(bootstrap.includes("function parseServerCliArgs"), false);
assert.equal(bootstrap.includes("const DOCS = ["), false);

const { parseServerCliArgs } = require("../src/runtime/server_cli_args");
assert.deepEqual(parseServerCliArgs([]), { bootstrapArgv: [], serverProfileName: "public" });
assert.deepEqual(parseServerCliArgs(["--profile", "tests", "--auth", "bearer"]), { bootstrapArgv: ["--auth", "bearer"], serverProfileName: "tests" });
assert.deepEqual(parseServerCliArgs(["--profile=tests", "--self-test"]), { bootstrapArgv: ["--self-test"], serverProfileName: "tests" });
assert.throws(() => parseServerCliArgs(["--profile"]), /Missing value for --profile/);
assert.throws(() => parseServerCliArgs(["--memory-tools"]), /Memory tools are selected by server profile/);

const { DOCS } = require("../src/runtime/static_docs");
assert.equal(Array.isArray(DOCS), true);
assert.equal(DOCS.length, 7);
assert.ok(DOCS.some((doc) => doc.id === "test-mcp-health-canary"));
assert.ok(DOCS.some((doc) => doc.id === "cloudflare-tunnel-localhost"));

console.log("smoke_stage12_step38p_server_runtime_extraction ok");

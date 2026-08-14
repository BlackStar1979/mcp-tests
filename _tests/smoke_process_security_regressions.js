"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { resolveProcessJobOwner } = require("../src/util/process_job_owner");
const { normalizeProcessToolError } = require("../src/util/process_tool_errors");

const ROOT = path.join(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), "utf8");
const bootstrapSource = read("src", "runtime", "server_bootstrap_runtime.js");
const managerSource = read("src", "util", "process_job_manager.js");

assert.doesNotMatch(
  bootstrapSource,
  /processIdempotencySecret\s*\|\|=\s*secretConfig\.operatorSecret/,
  "OAuth operator secret must not be reused as the current process idempotency HMAC key"
);
assert.match(
  bootstrapSource,
  /processIdempotencySecret\s*&&\s*processIdempotencySecret\s*===\s*secretConfig\.operatorSecret/,
  "explicit process/OAuth secret reuse must fail closed"
);
assert.match(
  bootstrapSource,
  /legacyProcessIdempotencySecret\s*=\s*secretConfig\.operatorSecret/,
  "legacy OAuth-secret mappings need lookup-only migration support"
);
assert.match(
  bootstrapSource,
  /legacyIdempotencySecret:\s*legacyProcessIdempotencySecret/,
  "bootstrap must pass lookup-only migration material to the process registry"
);
assert.match(
  managerSource,
  /store\.lookupIdempotent\([\s\S]*legacyKeyHash/,
  "manager must attempt legacy retained mapping lookup"
);
assert.doesNotMatch(
  managerSource,
  /createIdempotent\(record,\s*[^)]*legacy/i,
  "legacy idempotency material must never create new mappings"
);

assert.throws(
  () => resolveProcessJobOwner({}),
  (error) => error?.code === "process_job_owner_required"
);

assert.deepEqual(
  normalizeProcessToolError(Object.assign(
    new Error("Authenticated process job owner is required."),
    { code: "process_job_owner_required" }
  )),
  {
    success: false,
    error: {
      code: "process_job_owner_required",
      message: "Authenticated process job owner is required.",
      retryable: false,
    },
  }
);

for (const file of [
  "process_start.js",
  "process_status.js",
  "process_output.js",
  "process_cancel.js",
  "process_list.js",
  "process_events.js",
]) {
  const source = read("tools", file);
  assert.match(source, /require\("\.\.\/src\/util\/process_job_owner"\)/, `${file}: safe owner resolver import`);
  assert.match(source, /ownerId:\s*resolveProcessJobOwner\(context\)/, `${file}: owner binding`);
}

console.log("smoke_process_security_regressions ok");

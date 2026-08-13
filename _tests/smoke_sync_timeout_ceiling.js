"use strict";

// Regression guard for the 2026-08-10 contract defect: `run_process` and `process_start`
// shared one input schema, so the SYNCHRONOUS runner advertised the ASYNCHRONOUS runner's
// 600000 ms ceiling — a promise the MCP transport cannot keep.
//
// Measured on the live workbench before the fix:
//     122 s sync  -> OK (one connector)      130 s / 155 s / 200 s sync -> transport died
//     240 s ASYNC -> exit_code 0, survived all three synchronous failures
//
// The cost of the false promise was not a crash: a consumer trusted the advertised limit,
// read the resulting `ExceptionGroup: unhandled errors in a TaskGroup` as a server defect,
// and spent hours routing around a healthy server. A ceiling the transport cannot hold is
// worse than a lower one, because the failure it produces does not name its own cause.
//
// This guard fails if the two schemas are ever collapsed back into one.

const assert = require("node:assert/strict");

const {
  RUN_PROCESS_INPUT_SCHEMA,
  SYNC_RUN_PROCESS_INPUT_SCHEMA,
  SYNC_TIMEOUT_CEILING_MS,
} = require("../src/schemas/process_tools");
const { runProcessTool } = require("../tools/run_process");
const { processStartTool } = require("../tools/process_start");

const asyncMax = RUN_PROCESS_INPUT_SCHEMA.properties.timeout_ms.maximum;
const syncMax = SYNC_RUN_PROCESS_INPUT_SCHEMA.properties.timeout_ms.maximum;

assert.equal(syncMax, SYNC_TIMEOUT_CEILING_MS, "sync ceiling must come from the named constant");
assert.ok(syncMax < asyncMax, `sync ceiling ${syncMax} must be below async ceiling ${asyncMax}`);
// Keep a substantial margin below Cloudflare's documented 125 s Proxy Read Timeout.
// `run_process` buffers its output, so the proxy receives no response bytes until completion.
const CLOUDFLARE_PROXY_READ_TIMEOUT_MS = 125000;
assert.ok(syncMax < CLOUDFLARE_PROXY_READ_TIMEOUT_MS,
  `sync ceiling ${syncMax} must stay below the proxy read timeout ${CLOUDFLARE_PROXY_READ_TIMEOUT_MS}`);
assert.ok(CLOUDFLARE_PROXY_READ_TIMEOUT_MS - syncMax >= 30000,
  "sync ceiling must retain at least 30 seconds of proxy margin");

// The tools must not share the schema object again.
assert.equal(
  runProcessTool.descriptor.inputSchema.properties.timeout_ms.maximum,
  SYNC_TIMEOUT_CEILING_MS,
  "run_process must advertise the SYNC ceiling",
);
assert.equal(
  processStartTool.descriptor.inputSchema.properties.timeout_ms.maximum,
  asyncMax,
  "process_start must keep the full asynchronous ceiling",
);
assert.notEqual(
  runProcessTool.descriptor.inputSchema,
  processStartTool.descriptor.inputSchema,
  "run_process and process_start must not share one input schema object",
);

// Everything except the ceiling must stay identical, so the fix narrows one field and
// nothing else silently drifted.
for (const key of Object.keys(RUN_PROCESS_INPUT_SCHEMA.properties)) {
  if (key === "timeout_ms") continue;
  assert.deepEqual(
    SYNC_RUN_PROCESS_INPUT_SCHEMA.properties[key],
    RUN_PROCESS_INPUT_SCHEMA.properties[key],
    `sync schema drifted on '${key}' — only timeout_ms may differ`,
  );
}

// The description must SEND the caller somewhere, not merely state a limit: the consumer who
// lost hours here had the async tools available the whole time and never called them.
const description = String(runProcessTool.descriptor.description || "");
assert.ok(/process_start/.test(description), "run_process description must name process_start");
assert.ok(/90 seconds|90s/i.test(description), "run_process description must state the real ceiling");
assert.ok(/125-second proxy read timeout/i.test(description), "run_process description must name the real transport limit");

console.log("smoke_sync_timeout_ceiling: ok");
console.log(`  sync  run_process   timeout_ms max = ${syncMax} ms`);
console.log(`  async process_start timeout_ms max = ${asyncMax} ms`);

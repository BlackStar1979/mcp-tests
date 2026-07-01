"use strict";

// Stage 9 / Step 3 - Baseline drift guard (negative / meta-test).
//
// Proves the positive baseline smoke (smoke_baseline_manifest.js) fails
// CLOSED when controlled drift is injected, and that the frozen manifest is never
// mutated by the run. Drift is injected via environment ONLY
// (MCP_TEST_OUTPUT_MODE=content-only): no runtime mutation, no file mutation, no
// manifest mutation, no port 3009 bind, no server.js import, no public network.
//
// Layer note: this is a MAP-level check (it validates the guard's behavior). It
// must not alter CORE (runtime) or FRACTURE (the frozen manifest); it only injects
// env and observes the positive smoke's exit code and output markers.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const REPO_ROOT = path.join(__dirname, "..");
const POSITIVE_SMOKE = path.join(__dirname, "smoke_baseline_manifest.js");
const MANIFEST_PATH = path.join(
  REPO_ROOT,
  "_workflow",
  "baselines",
  "stage8_frozen_runtime_baseline.json"
);

// Stable markers present in the positive smoke's drift output. Do not assert full
// text or an exact diverged-field count (kept robust).
const DRIFT_MARKERS = ["outputMode", "combined_fingerprint", "expected", "computed"];

// Run the positive smoke with an EXPLICIT MCP_TEST_OUTPUT_MODE (never ambient).
function runPositiveSmoke(outputMode) {
  return spawnSync(process.execPath, [POSITIVE_SMOKE], {
    cwd: REPO_ROOT,
    env: { ...process.env, MCP_TEST_OUTPUT_MODE: outputMode },
    encoding: "utf8",
  });
}

// A. Positive baseline run must pass under structured (explicit, not ambient).
const positive = runPositiveSmoke("structured");
assert.equal(
  positive.status,
  0,
  `positive baseline smoke must exit 0 under structured; got ${positive.status}\n` +
    `${positive.stdout || ""}\n${positive.stderr || ""}`
);

// B. Snapshot the frozen manifest before injecting drift.
const manifestBefore = fs.readFileSync(MANIFEST_PATH, "utf8");

// C. Drift-injected run must fail closed.
const drift = runPositiveSmoke("content-only");
assert.notEqual(
  drift.status,
  0,
  "drift-injected baseline smoke must exit non-zero (fail closed)"
);

// D. Output must contain stable drift markers (not full-text equality).
const combined = `${drift.stdout || ""}${drift.stderr || ""}`;
for (const marker of DRIFT_MARKERS) {
  assert.ok(combined.includes(marker), `drift output must contain marker: ${marker}`);
}

// E. The frozen manifest must be byte-identical after the drift run.
const manifestAfter = fs.readFileSync(MANIFEST_PATH, "utf8");
assert.equal(
  manifestAfter,
  manifestBefore,
  "frozen manifest must not change during the drift guard"
);

console.log("smoke_baseline_drift_guard ok");

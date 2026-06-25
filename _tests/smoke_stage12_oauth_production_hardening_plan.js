"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const plan = fs.readFileSync(path.join(root, "_workflow", "OAUTH_PRODUCTION_HARDENING_PLAN.md"), "utf8");
const state = JSON.parse(fs.readFileSync(path.join(root, "_workflow", "state.json"), "utf8"));

for (const required of [
  "External authorization server metadata integration",
  "Token validation mode: JWKS / RS256 or introspection",
  "Dynamic client registration policy",
  "PKCE / client-facing authorization flow at AS boundary",
  "Key rotation",
  "Sampling user-approval policy",
  "SSE keepalive and resumability",
  "Live connector refresh after explicit operator approval",
  "H1 - AS metadata integration",
  "H9 - Live connector refresh readiness",
  "Do not refresh the live connector before H9",
  "Do not claim production OAuth until H1-H6 are green",
]) {
  assert.ok(plan.includes(required), `${required} missing`);
}

for (const guard of [
  "smoke_stage12_oauth_as_metadata_integration.js",
  "smoke_stage12_oauth_jwks_rs256_validation.js",
  "smoke_stage12_oauth_introspection_validation.js",
  "smoke_stage12_oauth_dcr_policy.js",
  "smoke_stage12_oauth_pkce_policy.js",
  "smoke_stage12_oauth_key_rotation.js",
  "smoke_stage12_sampling_user_approval_policy.js",
  "smoke_stage12_sse_keepalive.js",
  "smoke_stage12_sse_resumability.js",
  "smoke_stage12_connector_refresh_readiness.js",
]) {
  assert.ok(plan.includes(guard), `${guard} missing`);
}

assert.ok(state.stage14 && String(state.stage14.status || "").includes("no_apply"));
console.log("smoke_stage12_oauth_production_hardening_plan ok");

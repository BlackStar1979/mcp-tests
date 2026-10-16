"use strict";

// auth_mode_exclusions was validated by the profile schema but never APPLIED (found 2026-10-16):
// a tool listed there to hide it stayed exposed. These checks pin that the loader honours it.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { loadOptionalTools } = require("../src/tool_loader");

const testsProfile = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "profiles", "tests.json"), "utf8"));
const baseSurface = testsProfile.surfaces.authenticated;

function namesFor(authMode, exclusions) {
  const surface = { ...baseSurface, auth_mode_exclusions: exclusions };
  return loadOptionalTools({
    profile: "internal",
    authMode,
    authPolicy: { mode: authMode, requiresAuth: true },
    serverProfileConfig: { surface },
  }).map((tool) => tool.name);
}

const baseline = namesFor("oauth21", {});
assert.ok(baseline.includes("code_sample_js"), "fixture: code_sample_js loads without exclusions");
assert.ok(baseline.includes("memory_save"), "fixture: memory_save loads without exclusions");

const excluded = namesFor("oauth21", { oauth21: ["code_sample_js", "memory_save"] });
assert.equal(excluded.includes("code_sample_js"), false, "excluded tool must not be loaded");
assert.equal(excluded.includes("memory_save"), false, "excluded tool must not be loaded");
assert.equal(excluded.length, baseline.length - 2, "exactly the excluded tools disappear");

const otherMode = namesFor("oauth21", { bearer: ["code_sample_js"] });
assert.ok(otherMode.includes("code_sample_js"), "an exclusion for another auth mode does not apply");

assert.throws(
  () => namesFor("oauth21", { oauth21: ["code_sample_jss"] }),
  /unknown tool/i,
  "a misspelled exclusion must fail startup, not silently leave the tool exposed"
);

console.log("smoke_profile_auth_mode_exclusions ok");

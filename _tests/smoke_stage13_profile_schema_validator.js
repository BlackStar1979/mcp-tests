"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { validateProfileObject, validateProfilesDirectory } = require("../src/profile_schema_validator");
const { loadServerProfileConfig } = require("../src/server_profile_loader");

const ROOT = path.join(__dirname, "..");
const live = validateProfilesDirectory(ROOT);
assert.equal(live.ok, true, live.errors.join("; "));
assert.ok(live.profile_count >= 2);
assert.ok(live.results.some((result) => result.profile === "public"));
assert.ok(live.results.some((result) => result.profile === "tests"));

const publicProfile = require("../profiles/public.json");
const testsProfile = require("../profiles/tests.json");

assert.equal(validateProfileObject(publicProfile, { expectedName: "public", profilePath: path.join(ROOT, "profiles", "public.json") }).ok, true);
assert.equal(validateProfileObject(testsProfile, { expectedName: "tests", profilePath: path.join(ROOT, "profiles", "tests.json") }).ok, true);

assert.equal(loadServerProfileConfig({ profileName: "public", authMode: "none", rootDir: ROOT }).surfaceName, "public");
assert.equal(loadServerProfileConfig({ profileName: "public", authMode: "access", rootDir: ROOT }).surfaceName, "authenticated");
assert.equal(loadServerProfileConfig({ profileName: "tests", authMode: "none", rootDir: ROOT }).surfaceName, "public");
assert.equal(loadServerProfileConfig({ profileName: "tests", authMode: "bearer", rootDir: ROOT }).surfaceName, "authenticated");

function copy(value) { return JSON.parse(JSON.stringify(value)); }
function expectInvalid(profile, expectedName, label, needle) {
  const result = validateProfileObject(profile, { expectedName, profilePath: path.join(ROOT, "profiles", expectedName + ".json") });
  assert.equal(result.ok, false, label + " must be invalid");
  assert.ok(result.errors.join("; ").includes(needle), label + " must include " + needle + "; got " + result.errors.join("; "));
}

{
  const p = copy(testsProfile); delete p.surfaces.public;
  expectInvalid(p, "tests", "missing public surface", "profile.surfaces.public is required");
}
{
  const p = copy(testsProfile); delete p.surfaces.authenticated;
  expectInvalid(p, "tests", "missing authenticated surface", "profile.surfaces.authenticated is required");
}
{
  const p = copy(testsProfile); p.name = "wrong";
  expectInvalid(p, "tests", "name mismatch", "profile.name must match file name");
}
{
  const p = copy(testsProfile); p.surfaces.public.optional_tool_groups.push("authorized");
  expectInvalid(p, "tests", "public includes authorized group", "must not include authorized runtime tool group");
}
{
  const p = copy(testsProfile); p.surfaces.public.include_non_public_tools = true;
  expectInvalid(p, "tests", "public include non-public", "include_non_public_tools must be false");
}
{
  const p = copy(testsProfile); p.surfaces.public.include_memory_tools = true;
  expectInvalid(p, "tests", "public include memory", "include_memory_tools must be false");
}
{
  const p = copy(testsProfile); p.surfaces.authenticated.optional_tool_groups.push("unknown");
  expectInvalid(p, "tests", "unknown group", "contains unknown group");
}
{
  const p = copy(testsProfile); p.surfaces.authenticated.auth_mode_exclusions.ssh = [];
  expectInvalid(p, "tests", "unknown auth exclusion", "unknown auth mode");
}
{
  const p = copy(testsProfile); p.surfaces.authenticated.auth_mode_exclusions.bearer = "memory_save";
  expectInvalid(p, "tests", "bad auth exclusion value", "must be an array");
}

console.log("smoke_stage13_profile_schema_validator ok");

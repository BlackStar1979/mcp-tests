"use strict";

const fs = require("node:fs");
const path = require("node:path");

const PROFILE_NAME_RE = /^[a-z0-9_-]+$/;
const VALID_SURFACES = new Set(["public", "authenticated"]);
const VALID_TOOL_GROUPS = new Set(["public", "authorized"]);
const VALID_AUTH_EXCLUSION_KEYS = new Set(["access", "bearer", "oauth", "oauth21"]);
const TOP_LEVEL_KEYS = new Set(["name", "version", "description", "surfaces"]);
const SURFACE_KEYS = new Set(["description", "optional_tool_groups", "include_non_public_tools", "include_memory_tools", "auth_mode_exclusions", "allowed_resource_policy_refs", "denied_resource_policy_refs", "allowed_memory_scopes", "denied_memory_scopes", "allowed_network_scopes", "denied_network_scopes", "allowed_database_scopes", "denied_database_scopes", "allowed_plugin_scopes", "denied_plugin_scopes"]);
const VALID_PLUGIN_SCOPES = new Set(["plugin_registry_read", "plugin_visibility_plan", "plugin_visibility_status", "plugin_execution_preflight", "plugin_execution_readonly"]);
const VALID_DATABASE_SCOPES = new Set(["state_store", "memory_store", "network_cache_store", "plugin_visibility_store", "audit_receipt_store", "operator_config_store", "schema_migration_store"]);
const VALID_NETWORK_SCOPES = new Set(["allowlisted_https_fetch", "allowlisted_text_fetch", "allowlisted_head", "github_raw_allowlisted", "package_metadata_npm", "package_metadata_pypi"]);
const VALID_MEMORY_SCOPES = new Set(["agent_state", "memory_entries", "task_entries"]);
const VALID_RESOURCE_POLICY_REFS = new Set(["public_index", "filesystem_public", "filesystem_workspace_readonly", "network_allowlisted", "memory_context_scoped", "plugin_registry_readonly", "plugin_visibility_state_preview", "plugin_execution_readonly", "auth_runtime_readonly", "observability_audit_readonly", "tool_surface_planning", "runtime_status_readonly", "database_store_bounded"]);
const PUBLIC_ALLOWED_RESOURCE_POLICY_REFS = new Set(["public_index", "filesystem_public", "network_allowlisted"]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function push(errors, message) { errors.push(message); }

function validateAuthModeExclusions(prefix, value, errors) {
  if (value === undefined) return;
  if (!isPlainObject(value)) { push(errors, prefix + ".auth_mode_exclusions must be an object when present"); return; }
  for (const [mode, excludedTools] of Object.entries(value)) {
    if (!VALID_AUTH_EXCLUSION_KEYS.has(mode)) push(errors, prefix + ".auth_mode_exclusions has unknown auth mode: " + mode);
    if (!Array.isArray(excludedTools)) { push(errors, prefix + ".auth_mode_exclusions." + mode + " must be an array"); continue; }
    for (const toolName of excludedTools) {
      if (typeof toolName !== "string" || !/^[a-z][a-z0-9_]{1,80}$/.test(toolName)) push(errors, prefix + ".auth_mode_exclusions." + mode + " contains invalid tool name: " + String(toolName));
    }
  }
}
function validateResourcePolicyRefs(prefix, surfaceName, surface, errors) {
  for (const field of ["allowed_resource_policy_refs", "denied_resource_policy_refs"]) {
    const value = surface[field];
    if (value === undefined) continue;
    if (!Array.isArray(value)) { push(errors, prefix + "." + field + " must be an array when present"); continue; }
    const seen = new Set();
    for (const ref of value) {
      if (typeof ref !== "string") { push(errors, prefix + "." + field + " entries must be strings"); continue; }
      if (seen.has(ref)) push(errors, prefix + "." + field + " contains duplicate: " + ref);
      seen.add(ref);
      if (!VALID_RESOURCE_POLICY_REFS.has(ref)) push(errors, prefix + "." + field + " contains unknown resource policy ref: " + ref);
      if (surfaceName === "public" && !PUBLIC_ALLOWED_RESOURCE_POLICY_REFS.has(ref)) push(errors, prefix + "." + field + " contains non-public resource policy ref: " + ref);
    }
  }
}

function validateMemoryScopes(prefix, surfaceName, surface, errors) {
  for (const field of ["allowed_memory_scopes", "denied_memory_scopes"]) {
    const value = surface[field];
    if (value === undefined) continue;
    if (!Array.isArray(value)) { push(errors, prefix + "." + field + " must be an array when present"); continue; }
    const seen = new Set();
    for (const scope of value) {
      if (typeof scope !== "string") { push(errors, prefix + "." + field + " entries must be strings"); continue; }
      if (seen.has(scope)) push(errors, prefix + "." + field + " contains duplicate: " + scope);
      seen.add(scope);
      if (!VALID_MEMORY_SCOPES.has(scope)) push(errors, prefix + "." + field + " contains unknown memory scope: " + scope);
      if (surfaceName === "public" && field === "allowed_memory_scopes") push(errors, prefix + "." + field + " must be empty on public surface");
    }
  }
  const allowed = surface.allowed_memory_scopes || [];
  if (allowed.length > 0 && surface.include_memory_tools !== true) push(errors, prefix + ".allowed_memory_scopes requires include_memory_tools=true");
  if (surface.include_memory_tools === true && allowed.length === 0) push(errors, prefix + ".include_memory_tools=true requires allowed_memory_scopes");
}

function validateNetworkScopes(prefix, surface, errors) {
  for (const field of ["allowed_network_scopes", "denied_network_scopes"]) {
    const value = surface[field];
    if (value === undefined) continue;
    if (!Array.isArray(value)) { push(errors, prefix + "." + field + " must be an array when present"); continue; }
    const seen = new Set();
    for (const scope of value) {
      if (typeof scope !== "string") { push(errors, prefix + "." + field + " entries must be strings"); continue; }
      if (seen.has(scope)) push(errors, prefix + "." + field + " contains duplicate: " + scope);
      seen.add(scope);
      if (!VALID_NETWORK_SCOPES.has(scope)) push(errors, prefix + "." + field + " contains unknown network scope: " + scope);
    }
  }
}

function validateDatabaseScopes(prefix, surfaceName, surface, errors) {
  for (const field of ["allowed_database_scopes", "denied_database_scopes"]) {
    const value = surface[field];
    if (value === undefined) continue;
    if (!Array.isArray(value)) { push(errors, prefix + "." + field + " must be an array when present"); continue; }
    const seen = new Set();
    for (const scope of value) {
      if (typeof scope !== "string") { push(errors, prefix + "." + field + " entries must be strings"); continue; }
      if (seen.has(scope)) push(errors, prefix + "." + field + " contains duplicate: " + scope);
      seen.add(scope);
      if (!VALID_DATABASE_SCOPES.has(scope)) push(errors, prefix + "." + field + " contains unknown database scope: " + scope);
      if (surfaceName === "public" && field === "allowed_database_scopes") push(errors, prefix + "." + field + " must be empty on public surface");
    }
  }
}

function validatePluginScopes(prefix, surfaceName, surface, errors) {
  for (const field of ["allowed_plugin_scopes", "denied_plugin_scopes"]) {
    const value = surface[field];
    if (value === undefined) continue;
    if (!Array.isArray(value)) { push(errors, prefix + "." + field + " must be an array when present"); continue; }
    const seen = new Set();
    for (const scope of value) {
      if (typeof scope !== "string") { push(errors, prefix + "." + field + " entries must be strings"); continue; }
      if (seen.has(scope)) push(errors, prefix + "." + field + " contains duplicate: " + scope);
      seen.add(scope);
      if (!VALID_PLUGIN_SCOPES.has(scope)) push(errors, prefix + "." + field + " contains unknown plugin scope: " + scope);
      if (surfaceName === "public" && field === "allowed_plugin_scopes") push(errors, prefix + "." + field + " must be empty on public surface");
    }
  }
}
function validateSurface(profileName, surfaceName, surface, errors) {
  const prefix = profileName + ".surfaces." + surfaceName;
  if (!isPlainObject(surface)) { push(errors, prefix + " must be an object"); return; }
  for (const key of Object.keys(surface)) if (!SURFACE_KEYS.has(key)) push(errors, prefix + " has unknown key: " + key);
  if (surface.description !== undefined && typeof surface.description !== "string") push(errors, prefix + ".description must be a string when present");
  if (!Array.isArray(surface.optional_tool_groups)) {
    push(errors, prefix + ".optional_tool_groups must be an array");
  } else {
    if (surface.optional_tool_groups.length === 0) push(errors, prefix + ".optional_tool_groups must not be empty");
    const seen = new Set();
    for (const group of surface.optional_tool_groups) {
      if (typeof group !== "string") { push(errors, prefix + ".optional_tool_groups entries must be strings"); continue; }
      if (seen.has(group)) push(errors, prefix + ".optional_tool_groups contains duplicate: " + group);
      seen.add(group);
      if (!VALID_TOOL_GROUPS.has(group)) push(errors, prefix + ".optional_tool_groups contains unknown group: " + group);
    }
  }
  if (typeof surface.include_non_public_tools !== "boolean") push(errors, prefix + ".include_non_public_tools must be boolean");
  if (typeof surface.include_memory_tools !== "boolean") push(errors, prefix + ".include_memory_tools must be boolean");
  const groups = new Set(Array.isArray(surface.optional_tool_groups) ? surface.optional_tool_groups : []);
  if (surfaceName === "public") {
    if (groups.has("authorized")) push(errors, prefix + " must not include authorized runtime tool group");
    if (surface.include_non_public_tools !== false) push(errors, prefix + ".include_non_public_tools must be false");
    if (surface.include_memory_tools !== false) push(errors, prefix + ".include_memory_tools must be false");
  }
  if (groups.has("authorized") && surface.include_non_public_tools !== true) push(errors, prefix + " includes internal group but include_non_public_tools is not true");
  if (surface.include_memory_tools === true && surface.include_non_public_tools !== true) push(errors, prefix + ".include_memory_tools true requires include_non_public_tools true");
  if (surface.include_memory_tools === true && !groups.has("authorized")) push(errors, prefix + ".include_memory_tools true requires authorized runtime tool group");
  validateAuthModeExclusions(prefix, surface.auth_mode_exclusions, errors);
  validateResourcePolicyRefs(prefix, surfaceName, surface, errors);
  validateMemoryScopes(prefix, surfaceName, surface, errors);
  validateNetworkScopes(prefix, surface, errors);
  validateDatabaseScopes(prefix, surfaceName, surface, errors);
  validatePluginScopes(prefix, surfaceName, surface, errors);
}
function validateProfileObject(profile, options = {}) {
  const errors = [];
  const expectedName = options.expectedName || "";
  const profilePath = options.profilePath || "";
  const profileName = String(profile && profile.name || "").trim().toLowerCase();
  if (!isPlainObject(profile)) return { ok: false, profile: expectedName || "", path: profilePath, errors: ["profile must be an object"] };
  for (const key of Object.keys(profile)) if (!TOP_LEVEL_KEYS.has(key)) push(errors, "profile has unknown top-level key: " + key);
  if (!profileName) push(errors, "profile.name is required");
  else if (!PROFILE_NAME_RE.test(profileName)) push(errors, "profile.name has invalid format: " + profileName);
  if (expectedName && profileName !== expectedName) push(errors, "profile.name must match file name: expected " + expectedName + " got " + profileName);
  if (profilePath) {
    const fromFile = path.basename(profilePath, ".json").toLowerCase();
    if (fromFile && profileName && fromFile !== profileName) push(errors, "profile.name must match profile file basename: " + fromFile);
  }
  if (!Number.isInteger(profile.version) || profile.version < 1) push(errors, "profile.version must be a positive integer");
  if (profile.description !== undefined && typeof profile.description !== "string") push(errors, "profile.description must be a string when present");
  if (!isPlainObject(profile.surfaces)) {
    push(errors, "profile.surfaces must be an object");
  } else {
    for (const surfaceName of Object.keys(profile.surfaces)) if (!VALID_SURFACES.has(surfaceName)) push(errors, "profile.surfaces has unknown surface: " + surfaceName);
    for (const surfaceName of VALID_SURFACES) {
      if (!Object.prototype.hasOwnProperty.call(profile.surfaces, surfaceName)) push(errors, "profile.surfaces." + surfaceName + " is required");
      else validateSurface(profileName || expectedName || "profile", surfaceName, profile.surfaces[surfaceName], errors);
    }
  }
  return { ok: errors.length === 0, profile: profileName, path: profilePath, errors };
}
function validateProfileFile(profilePath, options = {}) {
  const expectedName = options.expectedName || path.basename(profilePath, ".json").toLowerCase();
  const profile = JSON.parse(fs.readFileSync(profilePath, "utf8"));
  return validateProfileObject(profile, { expectedName, profilePath });
}

function validateProfilesDirectory(rootDir = path.join(__dirname, "..")) {
  const profileDir = path.join(rootDir, "profiles");
  const results = [];
  for (const entry of fs.readdirSync(profileDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    results.push(validateProfileFile(path.join(profileDir, entry.name)));
  }
  const errors = results.flatMap((result) => result.errors.map((error) => result.profile + ": " + error));
  return { ok: errors.length === 0, profile_count: results.length, results, errors };
}

module.exports = {
  VALID_AUTH_EXCLUSION_KEYS,
  VALID_SURFACES,
  VALID_TOOL_GROUPS,
  validateProfileFile,
  validateProfileObject,
  validateProfilesDirectory,
};

const VALID_PROFILES = new Set(["public", "internal"]);
const VALID_STATUSES = new Set(["candidate", "enabled", "disabled", "quarantined"]);

const TOOL_NAME_PATTERN = /^[a-z][a-z0-9_]{2,80}$/;
const PLUGIN_ID_PATTERN = /^[a-z][a-z0-9_.-]{2,100}$/;

const REQUIRED_ANNOTATION_KEYS = ["readOnlyHint", "destructiveHint", "idempotentHint", "openWorldHint"];
const REQUIRED_PERMISSION_KEYS = ["network", "fs", "process", "write", "destructive"];

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function pushIf(errors, condition, message) {
  if (condition) errors.push(message);
}

function validateProfiles(value, field, errors) {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push(`${field} must be a non-empty array`);
    return [];
  }
  const out = [];
  for (const profile of value) {
    if (!VALID_PROFILES.has(profile)) errors.push(`${field} contains invalid profile: ${profile}`);
    else out.push(profile);
  }
  return out;
}

function validateObjectSchema(schema, field, errors) {
  if (!isPlainObject(schema)) {
    errors.push(`${field} must be an object schema`);
    return;
  }
  if (schema.type !== "object") errors.push(`${field}.type must be object`);
  if (schema.additionalProperties !== false) errors.push(`${field}.additionalProperties must be false`);
  if (!isPlainObject(schema.properties)) errors.push(`${field}.properties must be an object`);
  if (schema.required !== undefined && !Array.isArray(schema.required)) errors.push(`${field}.required must be an array when present`);
}

function validateAnnotations(annotations, field, errors) {
  if (!isPlainObject(annotations)) {
    errors.push(`${field} must be an object`);
    return null;
  }
  for (const key of REQUIRED_ANNOTATION_KEYS) {
    if (typeof annotations[key] !== "boolean") errors.push(`${field}.${key} must be boolean`);
  }
  return annotations;
}

function validatePermissions(permissions, field, errors) {
  if (!isPlainObject(permissions)) {
    errors.push(`${field} must be an object`);
    return null;
  }
  for (const key of REQUIRED_PERMISSION_KEYS) {
    if (typeof permissions[key] !== "boolean") errors.push(`${field}.${key} must be boolean`);
  }
  return permissions;
}

function classifyToolRisk(tool = {}) {
  const permissions = tool.permissions || {};
  const annotations = tool.annotations || {};
  if (permissions.destructive || permissions.write || annotations.destructiveHint) return "destructive";
  if (permissions.process) return "process";
  if (permissions.fs) return "filesystem";
  if (permissions.network || annotations.openWorldHint) return "network";
  return "readonly-local";
}

function validatePluginManifest(manifest, context = {}) {
  const errors = [];
  const warnings = [];
  const reservedToolNames = new Set(context.reservedToolNames || []);
  const source = context.source || "plugin.manifest.json";

  if (!isPlainObject(manifest)) {
    return {
      ok: false,
      source,
      plugin_id: "",
      tool_names: [],
      errors: ["manifest must be a JSON object"],
      warnings,
    };
  }

  pushIf(errors, manifest.manifest_version !== "test-mcp-plugin-manifest-v1", "manifest_version must be test-mcp-plugin-manifest-v1");
  pushIf(errors, typeof manifest.plugin_id !== "string" || !PLUGIN_ID_PATTERN.test(manifest.plugin_id || ""), "plugin_id has invalid format");
  pushIf(errors, typeof manifest.plugin_version !== "string" || manifest.plugin_version.length < 1 || manifest.plugin_version.length > 40, "plugin_version must be a short string");
  pushIf(errors, typeof manifest.name !== "string" || manifest.name.length < 1 || manifest.name.length > 120, "name must be 1..120 chars");
  pushIf(errors, typeof manifest.description !== "string" || manifest.description.length < 1 || manifest.description.length > 1000, "description must be 1..1000 chars");
  pushIf(errors, typeof manifest.public_safe !== "boolean", "public_safe must be boolean");
  pushIf(errors, !VALID_STATUSES.has(manifest.status), "status must be candidate/enabled/disabled/quarantined");

  validateProfiles(manifest.profile_allowed, "profile_allowed", errors);

  if (typeof manifest.entrypoint !== "string" || !manifest.entrypoint.endsWith(".js")) {
    errors.push("entrypoint must be a .js file name for future execution stages");
  }
  if (typeof manifest.entrypoint === "string" && (manifest.entrypoint.includes("..") || manifest.entrypoint.includes("/") || manifest.entrypoint.includes("\\"))) {
    errors.push("entrypoint must be a local file name without path traversal");
  }

  if (manifest.tags !== undefined) {
    if (!Array.isArray(manifest.tags)) errors.push("tags must be an array when present");
    else if (manifest.tags.some((tag) => typeof tag !== "string" || tag.length > 40)) errors.push("tags must contain short strings");
  }

  if (!Array.isArray(manifest.tools) || manifest.tools.length === 0) {
    errors.push("tools must be a non-empty array");
  } else if (manifest.tools.length > 20) {
    errors.push("tools must not contain more than 20 tools per plug-in");
  }

  const toolNames = [];
  const seen = new Set();
  for (const [index, tool] of Array.isArray(manifest.tools) ? manifest.tools.entries() : []) {
    const prefix = `tools[${index}]`;
    if (!isPlainObject(tool)) {
      errors.push(`${prefix} must be an object`);
      continue;
    }

    pushIf(errors, typeof tool.name !== "string" || !TOOL_NAME_PATTERN.test(tool.name || ""), `${prefix}.name has invalid format`);
    if (typeof tool.name === "string") {
      toolNames.push(tool.name);
      if (seen.has(tool.name)) errors.push(`${prefix}.name duplicates another tool in this manifest: ${tool.name}`);
      seen.add(tool.name);
      if (reservedToolNames.has(tool.name)) errors.push(`${prefix}.name collides with active/core tool: ${tool.name}`);
    }

    pushIf(errors, typeof tool.title !== "string" || tool.title.length < 1 || tool.title.length > 120, `${prefix}.title must be 1..120 chars`);
    pushIf(errors, typeof tool.description !== "string" || tool.description.length < 1 || tool.description.length > 1000, `${prefix}.description must be 1..1000 chars`);
    pushIf(errors, typeof tool.public_safe !== "boolean", `${prefix}.public_safe must be boolean`);
    validateProfiles(tool.profile_allowed, `${prefix}.profile_allowed`, errors);
    const annotations = validateAnnotations(tool.annotations, `${prefix}.annotations`, errors);
    const permissions = validatePermissions(tool.permissions, `${prefix}.permissions`, errors);
    validateObjectSchema(tool.inputSchema, `${prefix}.inputSchema`, errors);
    validateObjectSchema(tool.outputSchema, `${prefix}.outputSchema`, errors);

    if (tool.public_safe === true) {
      if (annotations?.readOnlyHint !== true) errors.push(`${prefix} public_safe tool must be read-only`);
      if (annotations?.destructiveHint !== false) errors.push(`${prefix} public_safe tool must not be destructive`);
      if (permissions?.write) errors.push(`${prefix} public_safe tool must not request write permission`);
      if (permissions?.process) errors.push(`${prefix} public_safe tool must not request process permission`);
      if (permissions?.destructive) errors.push(`${prefix} public_safe tool must not request destructive permission`);
    }

    if (manifest.public_safe === true && tool.public_safe !== true) {
      errors.push(`${prefix} must be public_safe when manifest public_safe=true`);
    }
  }

  if (manifest.status === "enabled") {
    warnings.push("enabled status is recorded but Stage 7 is preview-only and does not activate plug-in execution");
  }

  return {
    ok: errors.length === 0,
    source,
    plugin_id: typeof manifest.plugin_id === "string" ? manifest.plugin_id : "",
    tool_names: toolNames,
    errors,
    warnings,
  };
}

module.exports = {
  PLUGIN_ID_PATTERN,
  TOOL_NAME_PATTERN,
  VALID_PROFILES,
  VALID_STATUSES,
  classifyToolRisk,
  validatePluginManifest,
};

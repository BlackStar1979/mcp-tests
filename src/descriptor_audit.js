const { AUTHORIZED_MCP_TOOL_NAMES, PUBLIC_TOOL_NAMES } = require("./tool_policy");

const EXPECTED_TOOL_NAMES = [
  ...PUBLIC_TOOL_NAMES,
  ...AUTHORIZED_MCP_TOOL_NAMES,
];

function auditToolDescriptors(tools, options = {}) {
  const errors = [];
  const annotationMode = options.annotationMode || "read_only";
  const names = tools.map((tool) => tool.name);
  const sortedNames = [...names].sort();
  const expectedNames = Array.isArray(options.expectedToolNames) ? options.expectedToolNames : EXPECTED_TOOL_NAMES;
  const expected = [...expectedNames].sort();

  if (JSON.stringify(sortedNames) !== JSON.stringify(expected)) {
    errors.push(`tool surface mismatch: got ${sortedNames.join(",")} expected ${expected.join(",")}`);
  }

  const seen = new Set();

  for (const tool of tools) {
    if (!tool || typeof tool !== "object") {
      errors.push("tool descriptor is not an object");
      continue;
    }

    if (!tool.name || typeof tool.name !== "string") {
      errors.push("tool missing string name");
      continue;
    }

    if (seen.has(tool.name)) {
      errors.push(`duplicate tool: ${tool.name}`);
    }
    seen.add(tool.name);

    if (!/^[a-z][a-z0-9_]{1,80}$/.test(tool.name)) {
      errors.push(`${tool.name} invalid tool name format`);
    }

    if (!tool.title) errors.push(`${tool.name} missing title`);
    if (!tool.description) errors.push(`${tool.name} missing description`);
    if (!tool.inputSchema) errors.push(`${tool.name} missing inputSchema`);
    if (!tool.outputSchema) errors.push(`${tool.name} missing outputSchema`);
    if (!tool.annotations) errors.push(`${tool.name} missing annotations`);

    const annotations = tool.annotations || {};
    for (const key of ["readOnlyHint", "destructiveHint", "idempotentHint", "openWorldHint"]) {
      if (typeof annotations[key] !== "boolean") {
        errors.push(`${tool.name} ${key} must be boolean`);
      }
    }

    if (annotationMode === "read_only") {
      if (annotations.readOnlyHint !== true) errors.push(`${tool.name} readOnlyHint must be true`);
      if (annotations.destructiveHint !== false) errors.push(`${tool.name} destructiveHint must be false`);
      if (annotations.idempotentHint !== true) errors.push(`${tool.name} idempotentHint must be true`);

      const expectedOpenWorld = tool.name.startsWith("net_");
      if (annotations.openWorldHint !== expectedOpenWorld) {
        errors.push(`${tool.name} openWorldHint must be ${expectedOpenWorld}`);
      }
    } else if (annotationMode !== "structural") {
      errors.push(`unsupported annotation mode: ${annotationMode}`);
    }

    if (tool.inputSchema?.type !== "object") {
      errors.push(`${tool.name} inputSchema.type must be object`);
    }

    if (tool.inputSchema?.additionalProperties !== false) {
      errors.push(`${tool.name} inputSchema.additionalProperties must be false`);
    }
  }

  return {
    ok: errors.length === 0,
    count: tools.length,
    expected_count: expectedNames.length,
    tool_names: names,
    errors,
  };
}

function assertToolDescriptors(tools, options = {}) {
  const result = auditToolDescriptors(tools, options);
  if (!result.ok) {
    throw new Error(`descriptor audit failed: ${result.errors.join("; ")}`);
  }
  return result;
}

module.exports = {
  EXPECTED_TOOL_NAMES,
  PUBLIC_TOOL_NAMES,
  assertToolDescriptors,
  auditToolDescriptors,
};

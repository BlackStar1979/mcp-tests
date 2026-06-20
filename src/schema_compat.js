const crypto = require("node:crypto");

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function hash(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, 16);
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function add(issues, tool, path, severity, message, detail = {}) {
  issues.push({ tool, path, severity, message, ...detail });
}

function auditNode(schema, tool, path, issues) {
  if (!isObject(schema)) {
    add(issues, tool, path, "error", "schema node must be object");
    return;
  }

  if (schema.description === "") add(issues, tool, `${path}.description`, "warning", "empty description");

  if (schema.properties !== undefined && !isObject(schema.properties)) {
    add(issues, tool, `${path}.properties`, "error", "properties must be object");
  }

  if (schema.required !== undefined) {
    if (!Array.isArray(schema.required)) {
      add(issues, tool, `${path}.required`, "error", "required must be array");
    } else {
      const seen = new Set();
      for (const item of schema.required) {
        if (typeof item !== "string" || item === "") add(issues, tool, `${path}.required`, "error", "required entries must be strings");
        if (seen.has(item)) add(issues, tool, `${path}.required`, "error", "required entries must be unique", { field: item });
        seen.add(item);
        if (isObject(schema.properties) && typeof item === "string" && !Object.prototype.hasOwnProperty.call(schema.properties, item)) {
          add(issues, tool, `${path}.required`, "error", "required entry missing from properties", { field: item });
        }
      }
    }
  }

  if (isObject(schema.properties)) {
    for (const [name, child] of Object.entries(schema.properties)) auditNode(child, tool, `${path}.properties.${name}`, issues);
  }

  for (const key of ["items", "additionalProperties"]) {
    if (isObject(schema[key])) auditNode(schema[key], tool, `${path}.${key}`, issues);
  }

  for (const key of ["anyOf", "oneOf", "allOf"]) {
    if (Array.isArray(schema[key])) {
      schema[key].forEach((child, index) => {
        if (isObject(child)) auditNode(child, tool, `${path}.${key}[${index}]`, issues);
      });
    }
  }
}

function auditToolSchemas(tools = []) {
  const issues = [];
  const perTool = [];
  const hashes = [];

  for (const tool of tools) {
    const name = tool?.name || "unknown";
    const input = tool?.inputSchema;
    const output = tool?.outputSchema;
    const local = [];

    if (!isObject(input)) add(local, name, "inputSchema", "error", "inputSchema must be object");
    else {
      if (input.type !== "object") add(local, name, "inputSchema.type", "error", "inputSchema.type must be object", { actual: input.type ?? null });
      if (!isObject(input.properties)) add(local, name, "inputSchema.properties", "error", "inputSchema.properties must be object");
      auditNode(input, name, "inputSchema", local);
    }

    if (!isObject(output)) add(local, name, "outputSchema", "error", "outputSchema must be object");
    else {
      if (output.type !== "object") add(local, name, "outputSchema.type", "error", "outputSchema.type must be object", { actual: output.type ?? null });
      if (!isObject(output.properties)) add(local, name, "outputSchema.properties", "error", "outputSchema.properties must be object");
      if (output.additionalProperties !== false) add(local, name, "outputSchema.additionalProperties", "error", "outputSchema.additionalProperties must be false", { actual: output.additionalProperties ?? null });
      auditNode(output, name, "outputSchema", local);
    }

    issues.push(...local);
    const errorCount = local.filter((item) => item.severity === "error").length;
    const warningCount = local.filter((item) => item.severity === "warning").length;
    const inputHash = hash(stable(input || null));
    const outputHash = hash(stable(output || null));
    hashes.push(`${name}:${inputHash}:${outputHash}`);
    perTool.push({ tool: name, status: errorCount ? "error" : warningCount ? "warning" : "ok", error_count: errorCount, warning_count: warningCount, input_schema_hash: inputHash, output_schema_hash: outputHash, issues: local });
  }

  const errorCount = issues.filter((item) => item.severity === "error").length;
  const warningCount = issues.filter((item) => item.severity === "warning").length;
  return {
    success: errorCount === 0,
    status: errorCount ? "error" : warningCount ? "warning" : "ok",
    tool_count: tools.length,
    error_count: errorCount,
    warning_count: warningCount,
    schema_fingerprint: hash(hashes.sort().join("|")),
    per_tool: perTool,
    issues,
  };
}

function buildToolSurfaceFingerprint(tools = []) {
  const normalized = tools
    .map((tool) => ({
      name: tool?.name || "",
      title: tool?.title || "",
      description: tool?.description || "",
      inputSchema: tool?.inputSchema || null,
      outputSchema: tool?.outputSchema || null,
      annotations: tool?.annotations || null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const toolNames = normalized.map((tool) => tool.name);
  const inputSchemaParts = normalized.map((tool) => `${tool.name}:${hash(stable(tool.inputSchema))}`);
  const outputSchemaParts = normalized.map((tool) => `${tool.name}:${hash(stable(tool.outputSchema))}`);
  const descriptorParts = normalized.map((tool) => `${tool.name}:${hash(stable(tool))}`);

  return {
    tool_count: normalized.length,
    tool_names: toolNames,
    tool_names_hash: hash(toolNames.join("|")),
    input_schema_fingerprint: hash(inputSchemaParts.join("|")),
    output_schema_fingerprint: hash(outputSchemaParts.join("|")),
    descriptor_fingerprint: hash(descriptorParts.join("|")),
    combined_fingerprint: hash(stable(normalized)),
    per_tool: normalized.map((tool) => ({
      tool: tool.name,
      input_schema_hash: hash(stable(tool.inputSchema)),
      output_schema_hash: hash(stable(tool.outputSchema)),
      descriptor_hash: hash(stable(tool)),
    })),
  };
}

function assertToolSchemas(tools = []) {
  const audit = auditToolSchemas(tools);
  if (!audit.success) {
    const first = audit.issues[0];
    throw new Error(`schema compatibility audit failed: ${first.tool} ${first.path} ${first.message}`);
  }
  return audit;
}

module.exports = { auditToolSchemas, assertToolSchemas, buildToolSurfaceFingerprint };

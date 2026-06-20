const READ_ONLY_PLUGIN_CATALOG_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

const PLUGIN_CATALOG_SEARCH_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [],
  properties: {
    query: { type: "string", maxLength: 200, default: "" },
    plugin_id: { type: "string", maxLength: 120, default: "" },
    profile: { type: "string", enum: ["", "public", "internal"], default: "" },
    risk: { type: "string", enum: ["", "readonly-local", "network", "filesystem", "process", "destructive"], default: "" },
    tag: { type: "string", maxLength: 60, default: "" },
    detail_level: { type: "string", enum: ["name", "summary", "full"], default: "summary" },
    max_results: { type: "integer", minimum: 1, maximum: 50, default: 10 },
  },
};

const PLUGIN_CATALOG_DESCRIBE_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["tool_name"],
  properties: {
    tool_name: { type: "string", minLength: 1, maxLength: 120 },
    detail_level: { type: "string", enum: ["name", "summary", "full"], default: "full" },
  },
};

const GENERIC_PLUGIN_CATALOG_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [],
  properties: {},
};

module.exports = {
  GENERIC_PLUGIN_CATALOG_OUTPUT_SCHEMA,
  PLUGIN_CATALOG_DESCRIBE_INPUT_SCHEMA,
  PLUGIN_CATALOG_SEARCH_INPUT_SCHEMA,
  READ_ONLY_PLUGIN_CATALOG_ANNOTATIONS,
};

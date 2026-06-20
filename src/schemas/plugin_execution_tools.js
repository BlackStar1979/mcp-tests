const READ_ONLY_PLUGIN_EXECUTION_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};


const PLUGIN_EXECUTION_GOVERNANCE_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [],
  properties: {},
};

const PLUGIN_EXECUTION_PREFLIGHT_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["tool_name"],
  properties: {
    tool_name: {
      type: "string",
      minLength: 1,
      maxLength: 120,
    },
  },
};

const PLUGIN_EXECUTE_READONLY_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["tool_name", "text"],
  properties: {
    tool_name: {
      type: "string",
      minLength: 1,
      maxLength: 120,
    },
    text: {
      type: "string",
      minLength: 1,
      maxLength: 1000,
      description: "Text to echo through the allowlisted read-only wrapper."
    },
  },
};

const PLUGIN_EXECUTION_VERIFY_RECEIPT_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["version", "stage", "operation", "execution_id", "policy_hash", "success"],
  properties: {
    version: { type: "string", minLength: 1, maxLength: 120 },
    stage: { type: "string", minLength: 1, maxLength: 120 },
    operation: { type: "string", enum: ["governance", "preflight", "execute"] },
    execution_id: { type: "string", minLength: 24, maxLength: 24 },
    tool_name: { type: "string", maxLength: 160, default: "" },
    plugin_id: { type: "string", maxLength: 160, default: "" },
    handler_type: { type: "string", maxLength: 160, default: "" },
    input_hash: { type: "string", maxLength: 64, default: "" },
    result_hash: { type: "string", maxLength: 64, default: "" },
    policy_hash: { type: "string", minLength: 64, maxLength: 64 },
    success: { type: "string", enum: ["true", "false"] },
  },
};

const GENERIC_PLUGIN_EXECUTION_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [],
  properties: {},
};

module.exports = {
  GENERIC_PLUGIN_EXECUTION_OUTPUT_SCHEMA,
  PLUGIN_EXECUTION_GOVERNANCE_INPUT_SCHEMA,
  PLUGIN_EXECUTE_READONLY_INPUT_SCHEMA,
  PLUGIN_EXECUTION_PREFLIGHT_INPUT_SCHEMA,
  PLUGIN_EXECUTION_VERIFY_RECEIPT_INPUT_SCHEMA,
  READ_ONLY_PLUGIN_EXECUTION_ANNOTATIONS,
};

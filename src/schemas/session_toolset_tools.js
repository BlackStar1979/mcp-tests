const READ_ONLY_SESSION_TOOLSET_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

const EMPTY_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [],
  properties: {},
};

const SESSION_TOOLSET_PLAN_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [],
  properties: {
    profile: {
      type: "string",
      enum: ["public", "internal"],
      default: "public",
    },
    include_plugin_candidates: {
      type: "boolean",
      default: false,
    },
    detail_level: {
      type: "string",
      enum: ["summary", "full"],
      default: "summary",
    },
  },
};

const GENERIC_SESSION_TOOLSET_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [],
  properties: {},
};

module.exports = {
  EMPTY_INPUT_SCHEMA,
  GENERIC_SESSION_TOOLSET_OUTPUT_SCHEMA,
  READ_ONLY_SESSION_TOOLSET_ANNOTATIONS,
  SESSION_TOOLSET_PLAN_INPUT_SCHEMA,
};

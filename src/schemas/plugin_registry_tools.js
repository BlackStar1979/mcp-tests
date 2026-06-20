const READ_ONLY_PLUGIN_REGISTRY_ANNOTATIONS = {
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

const PLUGIN_ID_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["plugin_id"],
  properties: {
    plugin_id: {
      type: "string",
      minLength: 1,
      maxLength: 120,
    },
  },
};

const GENERIC_PLUGIN_REGISTRY_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [],
  properties: {},
};

module.exports = {
  EMPTY_INPUT_SCHEMA,
  GENERIC_PLUGIN_REGISTRY_OUTPUT_SCHEMA,
  PLUGIN_ID_INPUT_SCHEMA,
  READ_ONLY_PLUGIN_REGISTRY_ANNOTATIONS,
};

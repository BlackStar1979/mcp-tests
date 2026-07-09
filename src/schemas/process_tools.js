const EMPTY_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [],
  properties: {},
};

const READ_ONLY_PROCESS_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

const PROCESS_RUNNER_STATUS_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "status",
    "allowed_commands",
    "defaults",
    "powershell",
    "workspace_roots",
    "env_policy",
  ],
  properties: {
    status: { type: "string", enum: ["ok"] },
    allowed_commands: {
      type: "array",
      items: { type: "string" },
    },
    defaults: {
      type: "object",
      additionalProperties: false,
      required: [
        "timeout_ms",
        "max_timeout_ms",
        "max_output_chars",
        "hard_output_chars",
      ],
      properties: {
        timeout_ms: { type: "integer", minimum: 1 },
        max_timeout_ms: { type: "integer", minimum: 1 },
        max_output_chars: { type: "integer", minimum: 1 },
        hard_output_chars: { type: "integer", minimum: 1 },
      },
    },
    powershell: {
      type: "object",
      additionalProperties: false,
      required: [
        "raw_powershell_enabled",
        "command_enabled",
        "default_policy",
      ],
      properties: {
        raw_powershell_enabled: { type: "boolean" },
        command_enabled: { type: "boolean" },
        default_policy: { type: "string" },
      },
    },
    workspace_roots: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["alias", "path", "primary"],
        properties: {
          alias: { type: "string" },
          path: { type: "string" },
          primary: { type: "boolean" },
        },
      },
    },
    env_policy: {
      type: "object",
      additionalProperties: false,
      required: [
        "inherits_full_parent_env",
        "inherited_keys",
        "caller_env_is_sanitized",
      ],
      properties: {
        inherits_full_parent_env: { type: "boolean", enum: [false] },
        inherited_keys: {
          type: "array",
          items: { type: "string" },
        },
        caller_env_is_sanitized: { type: "boolean", enum: [true] },
      },
    },
  },
};

module.exports = {
  EMPTY_INPUT_SCHEMA,
  READ_ONLY_PROCESS_ANNOTATIONS,
  PROCESS_RUNNER_STATUS_OUTPUT_SCHEMA,
};

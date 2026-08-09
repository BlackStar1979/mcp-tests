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

const PROCESS_TOOL_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
};

const RUN_PROCESS_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["command"],
  properties: {
    command: { type: "string", minLength: 1, maxLength: 200 },
    args: {
      type: "array",
      default: [],
      maxItems: 100,
      items: { type: "string", maxLength: 4000 },
    },
    cwd: { type: "string", default: ".", maxLength: 1000 },
    timeout_ms: { type: "integer", minimum: 100, maximum: 600000, default: 60000 },
    max_output_chars: { type: "integer", minimum: 1000, maximum: 1000000, default: 250000 },
    env: {
      type: "object",
      default: {},
      additionalProperties: { type: "string" },
    },
    trace_id: {
      anyOf: [
        { type: "string", maxLength: 200 },
        { type: "null" },
      ],
      default: null,
    },
  },
};

const RUN_PROCESS_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "status",
    "command",
    "args",
    "cwd",
    "workspace",
    "exit_code",
    "signal",
    "timed_out",
    "duration_ms",
    "stdout",
    "stderr",
    "stdout_truncated",
    "stderr_truncated",
    "output_limit_chars",
    "trace_id",
    "error",
  ],
  properties: {
    status: { type: "string", enum: ["ok", "nonzero_exit", "timeout", "spawn_error"] },
    command: { type: "string" },
    args: { type: "array", items: { type: "string" } },
    cwd: { type: "string" },
    workspace: { type: "string" },
    exit_code: { type: ["integer", "null"] },
    signal: { type: ["string", "null"] },
    timed_out: { type: "boolean" },
    duration_ms: { type: "integer", minimum: 0 },
    stdout: { type: "string" },
    stderr: { type: "string" },
    stdout_truncated: { type: "boolean" },
    stderr_truncated: { type: "boolean" },
    output_limit_chars: { type: "integer", minimum: 1 },
    trace_id: { type: ["string", "null"] },
    error: { type: ["string", "null"] },
  },
};

const PROCESS_JOB_STATUSES = [
  "queued",
  "running",
  "ok",
  "nonzero_exit",
  "timeout",
  "spawn_error",
  "cancelled",
  "interrupted",
];

const PROCESS_TOOL_ERROR_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["success", "error"],
  properties: {
    success: { type: "boolean", enum: [false] },
    error: {
      type: "object",
      additionalProperties: false,
      required: ["code", "message", "retryable"],
      properties: {
        code: { type: "string" },
        message: { type: "string" },
        retryable: { type: "boolean" },
      },
    },
  },
};

function processToolOutputSchema(successSchema) {
  const properties = {
    ...(successSchema.properties || {}),
    ...PROCESS_TOOL_ERROR_OUTPUT_SCHEMA.properties,
  };
  if (successSchema.properties?.error) properties.error = {};
  return {
    type: "object",
    additionalProperties: false,
    required: [],
    properties,
    oneOf: [successSchema, PROCESS_TOOL_ERROR_OUTPUT_SCHEMA],
  };
}

const PROCESS_JOB_ID_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["job_id"],
  properties: {
    job_id: { type: "string", minLength: 1, maxLength: 200 },
  },
};

const PROCESS_CANCEL_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["job_id"],
  properties: {
    job_id: { type: "string", minLength: 1, maxLength: 200 },
    reason: { type: "string", minLength: 1, maxLength: 200, default: "cancelled" },
  },
};

const PROCESS_OUTPUT_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["job_id"],
  properties: {
    job_id: { type: "string", minLength: 1, maxLength: 200 },
    stdout_offset: { type: "integer", minimum: 0, maximum: 1000000, default: 0 },
    stderr_offset: { type: "integer", minimum: 0, maximum: 1000000, default: 0 },
    max_chars: { type: "integer", minimum: 1, maximum: 65536, default: 65536 },
  },
};

const PROCESS_JOB_STATUS_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "job_id",
    "status",
    "terminal",
    "command",
    "family",
    "resolution_class",
    "cwd",
    "workspace",
    "queue_position",
    "created_at",
    "started_at",
    "finished_at",
    "duration_ms",
    "timeout_ms",
    "output_limit_chars",
    "stdout_chars",
    "stderr_chars",
    "stdout_truncated",
    "stderr_truncated",
    "exit_code",
    "signal",
    "timed_out",
    "error",
    "durable",
    "recovered_after_restart",
  ],
  properties: {
    job_id: { type: "string" },
    status: { type: "string", enum: PROCESS_JOB_STATUSES },
    terminal: { type: "boolean" },
    command: { type: "string" },
    family: { type: "string" },
    resolution_class: { type: "string" },
    cwd: { type: "string" },
    workspace: { type: "string" },
    queue_position: { type: ["integer", "null"], minimum: 1 },
    created_at: { type: "string" },
    started_at: { type: ["string", "null"] },
    finished_at: { type: ["string", "null"] },
    duration_ms: { type: "integer", minimum: 0 },
    timeout_ms: { type: "integer", minimum: 100, maximum: 600000 },
    output_limit_chars: { type: "integer", minimum: 1000, maximum: 1000000 },
    stdout_chars: { type: "integer", minimum: 0, maximum: 1000000 },
    stderr_chars: { type: "integer", minimum: 0, maximum: 1000000 },
    stdout_truncated: { type: "boolean" },
    stderr_truncated: { type: "boolean" },
    exit_code: { type: ["integer", "null"] },
    signal: { type: ["string", "null"] },
    timed_out: { type: "boolean" },
    error: { type: ["string", "null"] },
    durable: { type: "boolean", enum: [true] },
    recovered_after_restart: { type: "boolean" },
  },
};

const PROCESS_LIST_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [],
  properties: {
    status: { type: "string", enum: PROCESS_JOB_STATUSES },
    limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
  },
};

const PROCESS_LIST_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["durable", "jobs"],
  properties: {
    durable: { type: "boolean", enum: [true] },
    jobs: { type: "array", items: PROCESS_JOB_STATUS_OUTPUT_SCHEMA },
  },
};

const PROCESS_EVENTS_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["job_id"],
  properties: {
    job_id: { type: "string", minLength: 1, maxLength: 200 },
    limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
  },
};

const PROCESS_EVENTS_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["job_id", "durable", "events"],
  properties: {
    job_id: { type: "string" },
    durable: { type: "boolean", enum: [true] },
    events: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["sequence", "from_status", "to_status", "event", "reason_code", "created_at", "server_instance_id"],
        properties: {
          sequence: { type: "integer", minimum: 1 },
          from_status: { type: ["string", "null"] },
          to_status: { type: "string", enum: PROCESS_JOB_STATUSES },
          event: { type: "string" },
          reason_code: { type: ["string", "null"] },
          created_at: { type: "string" },
          server_instance_id: { type: "string" },
        },
      },
    },
  },
};

const PROCESS_OUTPUT_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "job_id",
    "stdout",
    "stderr",
    "stdout_offset",
    "stderr_offset",
    "stdout_next_offset",
    "stderr_next_offset",
    "stdout_eof",
    "stderr_eof",
    "terminal",
    "status",
  ],
  properties: {
    job_id: { type: "string" },
    stdout: { type: "string" },
    stderr: { type: "string" },
    stdout_offset: { type: "integer", minimum: 0 },
    stderr_offset: { type: "integer", minimum: 0 },
    stdout_next_offset: { type: "integer", minimum: 0 },
    stderr_next_offset: { type: "integer", minimum: 0 },
    stdout_eof: { type: "boolean" },
    stderr_eof: { type: "boolean" },
    terminal: { type: "boolean" },
    status: { type: "string", enum: PROCESS_JOB_STATUSES },
  },
};

module.exports = {
  EMPTY_INPUT_SCHEMA,
  PROCESS_CANCEL_INPUT_SCHEMA,
  PROCESS_JOB_ID_INPUT_SCHEMA,
  PROCESS_JOB_STATUS_OUTPUT_SCHEMA,
  PROCESS_LIST_INPUT_SCHEMA,
  PROCESS_LIST_OUTPUT_SCHEMA,
  PROCESS_EVENTS_INPUT_SCHEMA,
  PROCESS_EVENTS_OUTPUT_SCHEMA,
  PROCESS_OUTPUT_INPUT_SCHEMA,
  PROCESS_OUTPUT_OUTPUT_SCHEMA,
  PROCESS_TOOL_ANNOTATIONS,
  PROCESS_TOOL_ERROR_OUTPUT_SCHEMA,
  READ_ONLY_PROCESS_ANNOTATIONS,
  RUN_PROCESS_INPUT_SCHEMA,
  RUN_PROCESS_OUTPUT_SCHEMA,
  PROCESS_RUNNER_STATUS_OUTPUT_SCHEMA,
  processToolOutputSchema,
};

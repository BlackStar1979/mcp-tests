const READ_ONLY_NETWORK_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};

const URL_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["url"],
  properties: {
    url: {
      type: "string",
      minLength: 1,
      maxLength: 4096,
      description: "HTTPS URL on the TEST MCP allowlist. No credentials, cookies, or auth headers.",
    },
    max_bytes: {
      type: "integer",
      minimum: 1024,
      maximum: 2097152,
      default: 262144,
      description: "Maximum response bytes to return for body-fetching tools.",
    },
  },
};

const HEAD_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["url"],
  properties: {
    url: URL_INPUT_SCHEMA.properties.url,
  },
};

const GITHUB_RAW_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["owner", "repo", "ref", "path"],
  properties: {
    owner: { type: "string", pattern: "^[A-Za-z0-9_.-]{1,100}$" },
    repo: { type: "string", pattern: "^[A-Za-z0-9_.-]{1,100}$" },
    ref: { type: "string", minLength: 1, maxLength: 200 },
    path: { type: "string", minLength: 1, maxLength: 1000 },
    max_bytes: URL_INPUT_SCHEMA.properties.max_bytes,
  },
};

const PACKAGE_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["package"],
  properties: {
    package: {
      type: "string",
      minLength: 1,
      maxLength: 214,
      description: "Package name. npm scoped names and PyPI normalized names are accepted by their respective tools.",
    },
  },
};

const NETWORK_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "success",
    "url",
    "final_url",
    "origin",
    "status",
    "ok",
    "content_type",
    "bytes",
    "truncated",
    "duration_ms",
    "sha256",
    "text",
    "error",
  ],
  properties: {
    success: { type: "boolean" },
    url: { type: "string" },
    final_url: { type: "string" },
    origin: { type: "string" },
    status: { type: "integer", minimum: 0 },
    ok: { type: "boolean" },
    content_type: { type: "string" },
    bytes: { type: "integer", minimum: 0 },
    truncated: { type: "boolean" },
    duration_ms: { type: "integer", minimum: 0 },
    sha256: { type: "string" },
    text: { type: "string" },
    error: { type: "string" },
  },
};

const PACKAGE_LOOKUP_STATUS_SCHEMA = {
  type: "string",
  enum: [
    "ok",
    "not_found",
    "http_error",
    "payload_too_large",
    "invalid_json",
    "blocked",
  ],
};

const PACKAGE_METADATA_COMMON_PROPERTIES = {
  package: { type: "string" },
  found: { type: "boolean" },
  package_status: PACKAGE_LOOKUP_STATUS_SCHEMA,
  name: { type: "string" },
  version: { type: "string" },
  license: { type: ["string", "null"] },
};

const NPM_PACKAGE_OUTPUT_SCHEMA = {
  ...NETWORK_OUTPUT_SCHEMA,
  properties: {
    ...NETWORK_OUTPUT_SCHEMA.properties,
    ...PACKAGE_METADATA_COMMON_PROPERTIES,
    description: { type: "string" },
    homepage: { type: ["string", "null"] },
    repository_url: { type: ["string", "null"] },
  },
};

const PYPI_PACKAGE_OUTPUT_SCHEMA = {
  ...NETWORK_OUTPUT_SCHEMA,
  properties: {
    ...NETWORK_OUTPUT_SCHEMA.properties,
    ...PACKAGE_METADATA_COMMON_PROPERTIES,
    summary: { type: "string" },
    project_url: { type: ["string", "null"] },
    package_url: { type: ["string", "null"] },
    requires_python: { type: ["string", "null"] },
    vulnerabilities_count: { type: "integer", minimum: 0 },
  },
};

module.exports = {
  GITHUB_RAW_INPUT_SCHEMA,
  HEAD_INPUT_SCHEMA,
  NETWORK_OUTPUT_SCHEMA,
  NPM_PACKAGE_OUTPUT_SCHEMA,
  PACKAGE_INPUT_SCHEMA,
  PYPI_PACKAGE_OUTPUT_SCHEMA,
  READ_ONLY_NETWORK_ANNOTATIONS,
  URL_INPUT_SCHEMA,
};

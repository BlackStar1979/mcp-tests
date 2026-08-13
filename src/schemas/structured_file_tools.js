"use strict";

const STRUCTURED_CONTENT_CHUNK_MAX_CHARS = 8192;
const SHA256_PATTERN = "^[a-fA-F0-9]{64}$";

const WORKSPACE_PATH_SCHEMA = Object.freeze({
  type: "string",
  minLength: 1,
  maxLength: 1000,
  description: "Path inside configured workspace roots. Bare paths use the primary work root; @alias/... selects another configured root.",
});

const SHA256_SCHEMA = Object.freeze({
  type: "string",
  pattern: SHA256_PATTERN,
  description: "Lowercase or uppercase hexadecimal SHA-256 digest used as a concurrency precondition.",
});

const STAGE_ID_SCHEMA = Object.freeze({
  type: "string",
  minLength: 16,
  maxLength: 128,
  pattern: "^[A-Za-z0-9_-]+$",
});

function closedObject(required, properties, description) {
  return {
    type: "object",
    additionalProperties: false,
    required,
    properties,
    ...(description ? { description } : {}),
  };
}

const BYTES_SELECTOR_SCHEMA = closedObject(["kind", "start_byte", "end_byte"], {
  kind: { type: "string", enum: ["bytes"] },
  start_byte: { type: "integer", minimum: 0 },
  end_byte: { type: "integer", minimum: 0 },
  expected_sha256: SHA256_SCHEMA,
}, "Select a zero-based half-open byte range [start_byte, end_byte). UTF-8 boundaries are verified before mutation.");

const LINES_SELECTOR_SCHEMA = closedObject(["kind", "start_line", "end_line"], {
  kind: { type: "string", enum: ["lines"] },
  start_line: { type: "integer", minimum: 1 },
  end_line: { type: "integer", minimum: 1 },
  expected_sha256: SHA256_SCHEMA,
}, "Select an inclusive one-based line range.");

const ANCHOR_SELECTOR_SCHEMA = closedObject(["kind", "text"], {
  kind: { type: "string", enum: ["anchor"] },
  text: { type: "string", minLength: 1, maxLength: STRUCTURED_CONTENT_CHUNK_MAX_CHARS },
  occurrence: { type: "integer", minimum: 1, default: 1 },
  include_anchor: { type: "boolean", default: true },
  expected_matches: { type: "integer", minimum: 1, maximum: 100, default: 1 },
  expected_sha256: SHA256_SCHEMA,
}, "Select one exact text occurrence. Mutations fail closed when expected_matches does not match reality. include_anchor=false selects a zero-length insertion point immediately after the anchor.");

const MARKDOWN_SECTION_SELECTOR_SCHEMA = closedObject(["kind", "heading_path"], {
  kind: { type: "string", enum: ["markdown_section"] },
  heading_path: {
    type: "array",
    minItems: 1,
    maxItems: 16,
    items: { type: "string", minLength: 1, maxLength: 500 },
  },
  occurrence: { type: "integer", minimum: 1, default: 1 },
  expected_sha256: SHA256_SCHEMA,
}, "Select a Markdown section by its full heading ancestry and duplicate occurrence number.");

const EOF_SELECTOR_SCHEMA = closedObject(["kind"], {
  kind: { type: "string", enum: ["eof"] },
}, "Select the zero-length range at end of file.");

const FILE_SELECTOR_SCHEMA = Object.freeze({
  oneOf: [
    BYTES_SELECTOR_SCHEMA,
    LINES_SELECTOR_SCHEMA,
    ANCHOR_SELECTOR_SCHEMA,
    MARKDOWN_SECTION_SELECTOR_SCHEMA,
    EOF_SELECTOR_SCHEMA,
  ],
});

const CONTENT_SOURCE_SCHEMA = Object.freeze({
  oneOf: [
    closedObject(["inline"], {
      inline: { type: "string", maxLength: STRUCTURED_CONTENT_CHUNK_MAX_CHARS },
    }, "Use for replacement content that fits in one bounded tool call."),
    closedObject(["stage_id"], {
      stage_id: STAGE_ID_SCHEMA,
    }, "Use a sealed owner-scoped content stage for larger generated content."),
    closedObject(["file"], {
      file: closedObject(["path", "selector", "expected_file_sha256"], {
        path: WORKSPACE_PATH_SCHEMA,
        selector: FILE_SELECTOR_SCHEMA,
        expected_file_sha256: SHA256_SCHEMA,
      }),
    }, "Stream an exact, hash-bound range from another workspace file."),
  ],
});

const FILE_INSPECT_INPUT_SCHEMA = Object.freeze(closedObject(["path"], {
  path: WORKSPACE_PATH_SCHEMA,
  selector: FILE_SELECTOR_SCHEMA,
  context_before_chars: { type: "integer", minimum: 0, maximum: 4096, default: 0 },
  context_after_chars: { type: "integer", minimum: 0, maximum: 4096, default: 0 },
}, "Inspect hashes and bounded ranges without returning the complete file."));

const TOOL_ERROR_SCHEMA = Object.freeze(closedObject(["code", "message", "retryable"], {
  code: { type: "string" },
  message: { type: "string" },
  retryable: { type: "boolean" },
}));

const RESOLVED_SELECTOR_OUTPUT_SCHEMA = Object.freeze(closedObject([
  "kind", "start_byte", "end_byte", "bytes", "range_sha256", "matches", "line_start", "line_end",
], {
  kind: { type: "string" },
  start_byte: { type: "integer", minimum: 0 },
  end_byte: { type: "integer", minimum: 0 },
  bytes: { type: "integer", minimum: 0 },
  range_sha256: SHA256_SCHEMA,
  matches: { type: "integer", minimum: 0 },
  line_start: { anyOf: [{ type: "integer", minimum: 1 }, { type: "null" }] },
  line_end: { anyOf: [{ type: "integer", minimum: 1 }, { type: "null" }] },
}));

const FILE_INSPECT_OUTPUT_SCHEMA = Object.freeze(closedObject([
  "success", "path", "bytes", "file_sha256", "has_utf8_bom", "dominant_eol", "total_lines", "selector", "context", "error",
], {
  success: { type: "boolean" },
  path: { type: "string" },
  bytes: { type: "integer", minimum: 0 },
  file_sha256: { anyOf: [SHA256_SCHEMA, { type: "null" }] },
  has_utf8_bom: { type: "boolean" },
  dominant_eol: { type: "string", enum: ["\n", "\r\n", "\r"] },
  total_lines: { type: "integer", minimum: 0 },
  selector: { anyOf: [RESOLVED_SELECTOR_OUTPUT_SCHEMA, { type: "null" }] },
  context: {
    anyOf: [
      closedObject(["before", "selected", "after", "truncated"], {
        before: { type: "string", maxLength: 4096 },
        selected: { type: "string", maxLength: STRUCTURED_CONTENT_CHUNK_MAX_CHARS },
        after: { type: "string", maxLength: 4096 },
        truncated: { type: "boolean" },
      }),
      { type: "null" },
    ],
  },
  error: { anyOf: [TOOL_ERROR_SCHEMA, { type: "null" }] },
}));

const CONTENT_STAGE_INPUT_SCHEMA = Object.freeze(closedObject(["action"], {
  action: { type: "string", enum: ["create", "append", "seal", "status", "release"] },
  stage_id: STAGE_ID_SCHEMA,
  sequence: { type: "integer", minimum: 0 },
  chunk: { type: "string", maxLength: STRUCTURED_CONTENT_CHUNK_MAX_CHARS },
  expected_chars: { type: "integer", minimum: 0, maximum: 8388608 },
  expected_sha256: SHA256_SCHEMA,
}, "Create, append, seal, inspect, or release durable owner-scoped content. Append requires stage_id, sequence, and chunk; seal requires stage_id and integrity expectations."));

const CONTENT_STAGE_OUTPUT_SCHEMA = Object.freeze(closedObject([
  "success", "action", "stage_id", "state", "next_sequence", "chars", "bytes",
  "sha256", "expires_at", "accepted_chars", "accepted_bytes", "error",
], {
  success: { type: "boolean" },
  action: { type: "string", enum: ["create", "append", "seal", "status", "release", "unknown"] },
  stage_id: { type: "string" },
  state: { type: "string", enum: ["open", "sealed", "released", "error"] },
  next_sequence: { type: "integer", minimum: 0 },
  chars: { type: "integer", minimum: 0 },
  bytes: { type: "integer", minimum: 0 },
  sha256: { anyOf: [SHA256_SCHEMA, { type: "null" }] },
  expires_at: { anyOf: [{ type: "string" }, { type: "null" }] },
  accepted_chars: { type: "integer", minimum: 0 },
  accepted_bytes: { type: "integer", minimum: 0 },
  error: {
    anyOf: [
      { type: "null" },
      closedObject(["code", "message", "retryable"], {
        code: { type: "string" },
        message: { type: "string" },
        retryable: { type: "boolean" },
      }),
    ],
  },
}));

const FILE_TRANSFORM_OPERATION_SCHEMA = Object.freeze({
  oneOf: [
    closedObject(["kind", "selector", "content"], {
      kind: { type: "string", enum: ["replace", "insert_before", "insert_after"] },
      selector: FILE_SELECTOR_SCHEMA,
      content: CONTENT_SOURCE_SCHEMA,
    }),
    closedObject(["kind", "content"], {
      kind: { type: "string", enum: ["append"] },
      content: CONTENT_SOURCE_SCHEMA,
    }),
    closedObject(["kind", "selector"], {
      kind: { type: "string", enum: ["delete"] },
      selector: FILE_SELECTOR_SCHEMA,
    }),
  ],
});

const FILE_TRANSFORM_INPUT_SCHEMA = Object.freeze(closedObject(["action", "path", "expected_file_sha256", "operations"], {
  action: { type: "string", enum: ["preview", "commit"] },
  path: WORKSPACE_PATH_SCHEMA,
  expected_file_sha256: SHA256_SCHEMA,
  operations: {
    type: "array",
    minItems: 1,
    maxItems: 100,
    items: FILE_TRANSFORM_OPERATION_SCHEMA,
  },
  receipt: { type: "string", minLength: 16, maxLength: 4096 },
  allow_protected: { type: "boolean", default: false },
}, "Use for exact single-file insert, replace, delete, or append operations. Preview first; commit must include its receipt."));

const FILE_TRANSFORM_OPERATION_OUTPUT_SCHEMA = Object.freeze(closedObject([
  "ordinal", "kind", "start_byte", "end_byte", "range_sha256", "content_kind", "content_fingerprint", "content_bytes", "stage_sha256", "source_path",
], {
  ordinal: { type: "integer", minimum: 0 },
  kind: { type: "string" },
  start_byte: { type: "integer", minimum: 0 },
  end_byte: { type: "integer", minimum: 0 },
  range_sha256: SHA256_SCHEMA,
  content_kind: { anyOf: [{ type: "string" }, { type: "null" }] },
  content_fingerprint: { anyOf: [SHA256_SCHEMA, { type: "null" }] },
  content_bytes: { type: "integer", minimum: 0 },
  stage_sha256: { anyOf: [SHA256_SCHEMA, { type: "null" }] },
  source_path: { anyOf: [{ type: "string" }, { type: "null" }] },
}));

const FILE_TRANSFORM_OUTPUT_SCHEMA = Object.freeze(closedObject([
  "success", "status", "path", "source_sha256", "result_sha256", "source_bytes", "bytes_before", "bytes_after",
  "delta_bytes", "operation_count", "operations", "receipt", "backup", "warnings", "error",
], {
  success: { type: "boolean" },
  status: { type: "string", enum: ["preview", "committed", "error"] },
  path: { type: "string" },
  source_sha256: { anyOf: [SHA256_SCHEMA, { type: "null" }] },
  result_sha256: { anyOf: [SHA256_SCHEMA, { type: "null" }] },
  source_bytes: { type: "integer", minimum: 0 },
  bytes_before: { type: "integer", minimum: 0 },
  bytes_after: { type: "integer", minimum: 0 },
  delta_bytes: { type: "integer" },
  operation_count: { type: "integer", minimum: 0 },
  operations: { type: "array", maxItems: 100, items: FILE_TRANSFORM_OPERATION_OUTPUT_SCHEMA },
  receipt: { type: "string" },
  backup: { anyOf: [{ type: "string" }, { type: "null" }] },
  warnings: { type: "array", items: { type: "string" } },
  error: { anyOf: [TOOL_ERROR_SCHEMA, { type: "null" }] },
}));

const FILE_SPLIT_PART_SCHEMA = Object.freeze(closedObject(["destination", "selector"], {
  destination: WORKSPACE_PATH_SCHEMA,
  selector: FILE_SELECTOR_SCHEMA,
}));

const FILE_SPLIT_INPUT_SCHEMA = Object.freeze(closedObject(["action", "source", "expected_source_sha256", "parts"], {
  action: { type: "string", enum: ["preview", "commit"] },
  source: WORKSPACE_PATH_SCHEMA,
  expected_source_sha256: SHA256_SCHEMA,
  parts: {
    type: "array",
    minItems: 1,
    maxItems: 100,
    items: FILE_SPLIT_PART_SCHEMA,
  },
  require_full_coverage: { type: "boolean", default: false },
  receipt: { type: "string", minLength: 16, maxLength: 4096 },
  allow_protected: { type: "boolean", default: false },
}, "Use only when one physical source file must become several physical destination files. Source preservation is mandatory."));

const FILE_MERGE_SOURCE_SCHEMA = Object.freeze(closedObject(["path", "expected_sha256"], {
  path: WORKSPACE_PATH_SCHEMA,
  expected_sha256: SHA256_SCHEMA,
}));

const FILE_MERGE_INPUT_SCHEMA = Object.freeze(closedObject(["action", "sources", "destination"], {
  action: { type: "string", enum: ["preview", "commit"] },
  sources: {
    type: "array",
    minItems: 1,
    maxItems: 100,
    items: FILE_MERGE_SOURCE_SCHEMA,
  },
  destination: WORKSPACE_PATH_SCHEMA,
  separator: { type: "string", maxLength: STRUCTURED_CONTENT_CHUNK_MAX_CHARS, default: "" },
  allow_repeated_sources: { type: "boolean", default: false },
  receipt: { type: "string", minLength: 16, maxLength: 4096 },
  allow_protected: { type: "boolean", default: false },
}, "Use only when several physical source files must be concatenated into one destination. Sources are preserved."));

const FILE_COMPOSE_OUTPUT_ITEM_SCHEMA = Object.freeze(closedObject([
  "ordinal", "destination", "bytes", "result_sha256", "prior_sha256", "prior_exists", "selector",
], {
  ordinal: { type: "integer", minimum: 0 },
  destination: { type: "string" },
  bytes: { type: "integer", minimum: 0 },
  result_sha256: SHA256_SCHEMA,
  prior_sha256: { anyOf: [SHA256_SCHEMA, { type: "null" }] },
  prior_exists: { type: "boolean" },
  selector: {
    anyOf: [
      closedObject(["start_byte", "end_byte", "range_sha256"], {
        start_byte: { type: "integer", minimum: 0 },
        end_byte: { type: "integer", minimum: 0 },
        range_sha256: SHA256_SCHEMA,
      }),
      { type: "null" },
    ],
  },
}));

const FILE_COMPOSE_OUTPUT_SCHEMA = Object.freeze(closedObject([
  "success", "status", "kind", "operation_id", "source_count", "output_count", "outputs", "receipt", "error",
], {
  success: { type: "boolean" },
  status: { type: "string", enum: ["preview", "committed", "error"] },
  kind: { type: "string", enum: ["split", "merge"] },
  operation_id: { anyOf: [{ type: "string" }, { type: "null" }] },
  source_count: { type: "integer", minimum: 0 },
  output_count: { type: "integer", minimum: 0 },
  outputs: { type: "array", maxItems: 100, items: FILE_COMPOSE_OUTPUT_ITEM_SCHEMA },
  receipt: { type: "string" },
  error: { anyOf: [TOOL_ERROR_SCHEMA, { type: "null" }] },
}));

const MARKDOWN_INSPECT_INPUT_SCHEMA = Object.freeze(closedObject(["path"], {
  path: WORKSPACE_PATH_SCHEMA,
  max_nodes: { type: "integer", minimum: 1, maximum: 500, default: 100 },
  include_document_features: { type: "boolean", default: true },
}, "Inspect Markdown headings, section hashes, source ranges, and document features without rewriting the document."));

const MARKDOWN_SECTION_REFERENCE_SCHEMA = Object.freeze(closedObject(["heading_path"], {
  heading_path: {
    type: "array",
    minItems: 1,
    maxItems: 16,
    items: { type: "string", minLength: 1, maxLength: 500 },
  },
  occurrence: { type: "integer", minimum: 1, default: 1 },
  expected_section_sha256: SHA256_SCHEMA,
}));

const MARKDOWN_TRANSFORM_OPERATION_SCHEMA = Object.freeze(closedObject(["kind", "section", "content"], {
  kind: {
    type: "string",
    enum: ["replace_section_body", "append_to_section", "insert_section_before", "insert_section_after", "replace_section"],
  },
  section: MARKDOWN_SECTION_REFERENCE_SCHEMA,
  content: CONTENT_SOURCE_SCHEMA,
}));

const MARKDOWN_TRANSFORM_INPUT_SCHEMA = Object.freeze(closedObject(["action", "path", "expected_file_sha256", "operation"], {
  action: { type: "string", enum: ["preview", "commit"] },
  path: WORKSPACE_PATH_SCHEMA,
  expected_file_sha256: SHA256_SCHEMA,
  operation: MARKDOWN_TRANSFORM_OPERATION_SCHEMA,
  receipt: { type: "string", minLength: 16, maxLength: 4096 },
  allow_protected: { type: "boolean", default: false },
}, "Use when Markdown headings define the edit target. Preview first; commit must include its receipt."));

module.exports = {
  CONTENT_SOURCE_SCHEMA,
  CONTENT_STAGE_INPUT_SCHEMA,
  CONTENT_STAGE_OUTPUT_SCHEMA,
  FILE_INSPECT_INPUT_SCHEMA,
  FILE_INSPECT_OUTPUT_SCHEMA,
  FILE_COMPOSE_OUTPUT_SCHEMA,
  FILE_MERGE_INPUT_SCHEMA,
  FILE_SELECTOR_SCHEMA,
  FILE_SPLIT_INPUT_SCHEMA,
  FILE_TRANSFORM_INPUT_SCHEMA,
  FILE_TRANSFORM_OUTPUT_SCHEMA,
  MARKDOWN_INSPECT_INPUT_SCHEMA,
  MARKDOWN_TRANSFORM_INPUT_SCHEMA,
  STRUCTURED_CONTENT_CHUNK_MAX_CHARS,
  WORKSPACE_PATH_SCHEMA,
};

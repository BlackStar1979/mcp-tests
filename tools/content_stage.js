"use strict";

const {
  CONTENT_STAGE_INPUT_SCHEMA,
  CONTENT_STAGE_OUTPUT_SCHEMA,
} = require("../src/schemas/structured_file_tools");
const {
  resolveContentStageManager,
  resolveContentStageOwner,
} = require("../src/util/content_stage_manager");

const TOOL_NAME = "content_stage";
const ACTIONS = new Set(["create", "append", "seal", "status", "release"]);

function output(action, payload = {}, error = null) {
  return {
    success: !error,
    action: ACTIONS.has(action) ? action : "unknown",
    stage_id: String(payload.stage_id || ""),
    state: error ? "error" : String(payload.state || "open"),
    next_sequence: Number(payload.next_sequence || 0),
    chars: Number(payload.chars || 0),
    bytes: Number(payload.bytes || 0),
    sha256: payload.sha256 || null,
    expires_at: payload.expires_at || null,
    accepted_chars: Number(payload.accepted_chars || 0),
    accepted_bytes: Number(payload.accepted_bytes || 0),
    error,
  };
}

async function execute(args = {}, context = {}) {
  const action = String(args.action || "");
  try {
    if (!ACTIONS.has(action)) {
      const error = new Error(`Unsupported content_stage action: ${action || "(empty)"}`);
      error.code = "content_stage_action_invalid";
      throw error;
    }
    const manager = resolveContentStageManager(context);
    const ownerId = resolveContentStageOwner(context);
    let result;
    if (action === "create") result = manager.create(ownerId);
    if (action === "append") result = manager.append(ownerId, args.stage_id, args.sequence, args.chunk);
    if (action === "seal") result = manager.seal(ownerId, args.stage_id, {
      expected_chars: args.expected_chars,
      expected_sha256: args.expected_sha256,
    });
    if (action === "status") result = manager.status(ownerId, args.stage_id);
    if (action === "release") result = manager.release(ownerId, args.stage_id);
    return output(action, result);
  } catch (error) {
    return output(action, { stage_id: args.stage_id }, {
      code: String(error?.code || "content_stage_error"),
      message: String(error?.message || error),
      retryable: false,
    });
  }
}

const contentStageTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Stage bounded content durably",
    description: "Build generated UTF-8 content across bounded calls, then seal it for file_transform or markdown_transform. Use only when replacement content does not fit one inline call. Status never returns staged content.",
    inputSchema: CONTENT_STAGE_INPUT_SCHEMA,
    outputSchema: CONTENT_STAGE_OUTPUT_SCHEMA,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  execute,
  summarizeArgs(args = {}) {
    return {
      action: String(args.action || ""),
      stage_id_present: Boolean(args.stage_id),
      sequence: Number.isSafeInteger(args.sequence) ? args.sequence : null,
      chunk_chars: typeof args.chunk === "string" ? args.chunk.length : 0,
      expected_chars: Number.isSafeInteger(args.expected_chars) ? args.expected_chars : null,
      expected_sha256_present: Boolean(args.expected_sha256),
    };
  },
  resultStats(payload = {}) {
    return { result_count: payload.success ? 1 : 0, result_chars: 0 };
  },
};

module.exports = { contentStageTool };

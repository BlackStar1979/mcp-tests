"use strict";

const {
  CODE_APPLY_PATCH_INPUT_SCHEMA,
  CODE_APPLY_PATCH_OUTPUT_SCHEMA,
  STATE_CHANGING_CODE_MUTATION_ANNOTATIONS,
} = require("../src/schemas/code_mutation_tools");
const { executeCodeApplyPatch } = require("../src/util/code_mutation_tools");

const TOOL_NAME = "code_apply_patch";

const codeApplyPatchTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Apply code patch with guards",
    description: "Apply a code patch through guarded dry-run plus commit_ref confirmation flow with post-write syntax validation.",
    inputSchema: CODE_APPLY_PATCH_INPUT_SCHEMA,
    outputSchema: CODE_APPLY_PATCH_OUTPUT_SCHEMA,
    annotations: STATE_CHANGING_CODE_MUTATION_ANNOTATIONS,
  },
  execute(args = {}) {
    return executeCodeApplyPatch(args);
  },
  summarizeArgs(args = {}) {
    return {
      path_length_chars: String(args.path || "").length,
      target_length_chars: String(args.target || "").length,
      anchor_length_chars: String(args.anchor || "").length,
      content_length_chars: String(args.content || "").length,
      dry_run: args.dry_run !== false,
      has_commit_ref: typeof args.commit_ref === "string" && args.commit_ref.trim().length > 0,
    };
  },
  resultStats(payload = {}) {
    return {
      result_count: payload.operation_id ? 1 : 0,
      result_chars: JSON.stringify(payload || {}).length,
    };
  },
};

module.exports = { codeApplyPatchTool };

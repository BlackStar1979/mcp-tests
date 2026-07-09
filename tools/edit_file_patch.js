"use strict";

const {
  STATE_CHANGING_WORKSPACE_MUTATION_ANNOTATIONS,
  EDIT_FILE_PATCH_INPUT_SCHEMA,
  EDIT_FILE_PATCH_OUTPUT_SCHEMA,
} = require("../src/schemas/workspace_mutation_tools");
const { editFilePatch } = require("../src/util/workspace_mutation");

const TOOL_NAME = "edit_file_patch";

const editFilePatchTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Patch workspace text file by anchor",
    description: "Safely edit a UTF-8 text file inside configured workspace roots using an exact single anchor. Supports dry-run and backup-before-write.",
    inputSchema: EDIT_FILE_PATCH_INPUT_SCHEMA,
    outputSchema: EDIT_FILE_PATCH_OUTPUT_SCHEMA,
    annotations: STATE_CHANGING_WORKSPACE_MUTATION_ANNOTATIONS,
  },
  execute(args = {}) {
    return editFilePatch(args.path, {
      anchor: args.anchor,
      content: args.content,
      mode: args.mode,
      dry_run: args.dry_run !== false,
      allow_protected: args.allow_protected === true,
      require_markers: Array.isArray(args.require_markers) ? args.require_markers : [],
    });
  },
  summarizeArgs(args = {}) {
    return {
      path_length_chars: String(args.path || "").length,
      anchor_length_chars: String(args.anchor || "").length,
      content_length_chars: String(args.content || "").length,
      dry_run: args.dry_run !== false,
      mode: String(args.mode || "replace"),
    };
  },
  resultStats(payload = {}) {
    return {
      result_count: payload.status === "dry_run" || payload.status === "patched" ? 1 : 0,
      result_chars: JSON.stringify(payload || {}).length,
    };
  },
};

module.exports = { editFilePatchTool };

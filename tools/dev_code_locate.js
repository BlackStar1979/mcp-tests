const { DEV_CODE_LOCATE_INPUT_SCHEMA, DEV_CODE_LOCATE_OUTPUT_SCHEMA, READ_ONLY_DEV_ANNOTATIONS } = require("../src/schemas/dev_tools");
const { locateCode } = require("../src/util/code_workspace");
const { safeArgSummary } = require("../src/util/path_policy");

const TOOL_NAME = "dev_code_locate";

async function execute(args = {}) {
  try {
    const payload = await locateCode(args.path, args.query, {
      mode: args.mode,
      case_sensitive: args.case_sensitive,
      max_matches: args.max_matches,
      include_preview: args.include_preview,
      preview_chars: args.preview_chars,
    });
    return { success: true, error: "", ...payload };
  } catch (error) {
    return {
      success: false,
      error: error?.message || String(error),
      path: String(args.path || ""),
      language: "",
      query_sha256_prefix: "",
      mode: String(args.mode || "literal"),
      case_sensitive: args.case_sensitive !== false,
      total_lines: 0,
      match_count: 0,
      total_matches_estimate: 0,
      truncated: false,
      max_matches: Number(args.max_matches || 20),
      include_preview: args.include_preview === true,
      matches: [],
    };
  }
}

const devCodeLocateTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Locate developer code anchors",
    description: "Read-only bounded line locator for literal text or identifiers in one TEST MCP workspace code file. Returns line numbers, columns, short previews, and line hashes without dumping large code blocks.",
    inputSchema: DEV_CODE_LOCATE_INPUT_SCHEMA,
    outputSchema: DEV_CODE_LOCATE_OUTPUT_SCHEMA,
    annotations: READ_ONLY_DEV_ANNOTATIONS,
  },
  execute,
  summarizeArgs(args = {}) { return safeArgSummary(`${args.path || ""}:${args.mode || "literal"}:${args.query || ""}`); },
  resultStats(payload = {}) { return { result_count: payload.match_count || 0, result_chars: JSON.stringify(payload || {}).length }; },
};

module.exports = { devCodeLocateTool };

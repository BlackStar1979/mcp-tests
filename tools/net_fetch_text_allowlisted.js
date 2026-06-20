const {
  READ_ONLY_NETWORK_ANNOTATIONS,
  URL_INPUT_SCHEMA,
  NETWORK_OUTPUT_SCHEMA,
} = require("../src/schemas/net_tools");
const {
  fetchAllowlisted,
  makeBlockedOutput,
  networkResultStats,
  summarizeUrlArg,
} = require("../src/util/network_policy");

const TOOL_NAME = "net_fetch_text_allowlisted";

async function execute(args = {}) {
  try {
    return await fetchAllowlisted(args.url, {
      method: "GET",
      wantText: true,
      requireText: true,
      maxBytes: args.max_bytes,
    });
  } catch (error) {
    return makeBlockedOutput(args.url, error?.message || String(error));
  }
}

const netFetchTextAllowlistedTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Fetch allowlisted text URL",
    description:
      "Read-only HTTPS text fetch for allowlisted public domains. Requires text-like content type; SSRF-guarded and bounded.",
    inputSchema: URL_INPUT_SCHEMA,
    outputSchema: NETWORK_OUTPUT_SCHEMA,
    annotations: READ_ONLY_NETWORK_ANNOTATIONS,
  },
  execute,
  summarizeArgs: summarizeUrlArg,
  resultStats: networkResultStats,
};

module.exports = {
  netFetchTextAllowlistedTool,
};

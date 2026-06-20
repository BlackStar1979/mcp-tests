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

const TOOL_NAME = "net_http_get_allowlisted";

async function execute(args = {}) {
  try {
    return await fetchAllowlisted(args.url, {
      method: "GET",
      wantText: true,
      requireText: false,
      maxBytes: args.max_bytes,
    });
  } catch (error) {
    return makeBlockedOutput(args.url, error?.message || String(error));
  }
}

const netHttpGetAllowlistedTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "HTTP GET allowlisted URL",
    description:
      "Read-only HTTPS GET for allowlisted public domains. SSRF-guarded, bounded, no cookies, no auth, no disk writes.",
    inputSchema: URL_INPUT_SCHEMA,
    outputSchema: NETWORK_OUTPUT_SCHEMA,
    annotations: READ_ONLY_NETWORK_ANNOTATIONS,
  },
  execute,
  summarizeArgs: summarizeUrlArg,
  resultStats: networkResultStats,
};

module.exports = {
  netHttpGetAllowlistedTool,
};

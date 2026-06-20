const {
  READ_ONLY_NETWORK_ANNOTATIONS,
  HEAD_INPUT_SCHEMA,
  NETWORK_OUTPUT_SCHEMA,
} = require("../src/schemas/net_tools");
const {
  fetchAllowlisted,
  makeBlockedOutput,
  networkResultStats,
  summarizeUrlArg,
} = require("../src/util/network_policy");

const TOOL_NAME = "net_check_url_head";

async function execute(args = {}) {
  try {
    return await fetchAllowlisted(args.url, {
      method: "HEAD",
      wantText: false,
      requireText: false,
    });
  } catch (error) {
    return makeBlockedOutput(args.url, error?.message || String(error));
  }
}

const netCheckUrlHeadTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Check allowlisted URL HEAD",
    description:
      "Read-only HTTPS HEAD check for allowlisted public domains. SSRF-guarded, no body, no cookies, no auth.",
    inputSchema: HEAD_INPUT_SCHEMA,
    outputSchema: NETWORK_OUTPUT_SCHEMA,
    annotations: READ_ONLY_NETWORK_ANNOTATIONS,
  },
  execute,
  summarizeArgs: summarizeUrlArg,
  resultStats: networkResultStats,
};

module.exports = {
  netCheckUrlHeadTool,
};

const {
  READ_ONLY_NETWORK_ANNOTATIONS,
  GITHUB_RAW_INPUT_SCHEMA,
  NETWORK_OUTPUT_SCHEMA,
} = require("../src/schemas/net_tools");
const {
  fetchAllowlisted,
  makeBlockedOutput,
  networkResultStats,
  sha256,
} = require("../src/util/network_policy");

const TOOL_NAME = "net_fetch_github_raw";

function buildRawUrl(args = {}) {
  const owner = String(args.owner || "").trim();
  const repo = String(args.repo || "").trim();
  const ref = String(args.ref || "").trim();
  const filePath = String(args.path || "").replace(/^\/+/, "");

  if (!owner || !repo || !ref || !filePath || filePath.includes("..")) {
    throw new Error("Invalid GitHub raw file reference.");
  }

  return `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(ref)}/${filePath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/")}`;
}

async function execute(args = {}) {
  let url = "";
  try {
    url = buildRawUrl(args);
    return await fetchAllowlisted(url, {
      method: "GET",
      wantText: true,
      requireText: true,
      maxBytes: args.max_bytes,
    });
  } catch (error) {
    return makeBlockedOutput(url || "github_raw", error?.message || String(error));
  }
}

function summarizeArgs(args = {}) {
  const ref = `${args.owner || ""}/${args.repo || ""}@${args.ref || ""}:${args.path || ""}`;
  return {
    arg_name: "github_raw_ref",
    url_sha256: sha256(ref),
    url_length_chars: ref.length,
    origin: "https://raw.githubusercontent.com",
  };
}

const netFetchGithubRawTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Fetch GitHub raw file",
    description:
      "Read-only fetch of one raw.githubusercontent.com text file using owner/repo/ref/path fields. Allowlisted and bounded.",
    inputSchema: GITHUB_RAW_INPUT_SCHEMA,
    outputSchema: NETWORK_OUTPUT_SCHEMA,
    annotations: READ_ONLY_NETWORK_ANNOTATIONS,
  },
  execute,
  summarizeArgs,
  resultStats: networkResultStats,
};

module.exports = {
  netFetchGithubRawTool,
};

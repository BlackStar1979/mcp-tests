const {
  READ_ONLY_NETWORK_ANNOTATIONS,
  PACKAGE_INPUT_SCHEMA,
  NETWORK_OUTPUT_SCHEMA,
} = require("../src/schemas/net_tools");
const {
  fetchAllowlisted,
  makeBlockedOutput,
  networkResultStats,
  sha256,
} = require("../src/util/network_policy");

const TOOL_NAME = "net_check_npm_package";

function normalizePackageName(value) {
  const name = String(value || "").trim();
  if (!name || name.length > 214 || name.includes("..") || /[\\\s]/.test(name)) {
    throw new Error("Invalid npm package name.");
  }
  return name;
}

async function execute(args = {}) {
  let url = "";
  try {
    const packageName = normalizePackageName(args.package);
    url = `https://registry.npmjs.org/${encodeURIComponent(packageName).replace(/^%40/, "@")}`;
    return await fetchAllowlisted(url, {
      method: "GET",
      wantText: true,
      requireText: true,
      maxBytes: 262144,
    });
  } catch (error) {
    return makeBlockedOutput(url || String(args.package || ""), error?.message || String(error));
  }
}

function summarizeArgs(args = {}) {
  const packageName = String(args.package || "");
  return {
    arg_name: "package",
    url_sha256: sha256(packageName),
    url_length_chars: packageName.length,
    origin: "https://registry.npmjs.org",
  };
}

const netCheckNpmPackageTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Check npm package metadata",
    description:
      "Read-only bounded fetch of npm registry package metadata from registry.npmjs.org. No auth, no cookies, no disk writes.",
    inputSchema: PACKAGE_INPUT_SCHEMA,
    outputSchema: NETWORK_OUTPUT_SCHEMA,
    annotations: READ_ONLY_NETWORK_ANNOTATIONS,
  },
  execute,
  summarizeArgs,
  resultStats: networkResultStats,
};

module.exports = {
  netCheckNpmPackageTool,
};

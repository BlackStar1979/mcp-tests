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

const TOOL_NAME = "net_check_pypi_package";

function normalizePackageName(value) {
  const name = String(value || "").trim();
  if (!/^[A-Za-z0-9_.-]{1,214}$/.test(name)) {
    throw new Error("Invalid PyPI package name.");
  }
  return name;
}

async function execute(args = {}) {
  let url = "";
  try {
    const packageName = normalizePackageName(args.package);
    url = `https://pypi.org/pypi/${encodeURIComponent(packageName)}/json`;
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
    origin: "https://pypi.org",
  };
}

const netCheckPypiPackageTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Check PyPI package metadata",
    description:
      "Read-only bounded fetch of PyPI JSON package metadata from pypi.org. No auth, no cookies, no disk writes.",
    inputSchema: PACKAGE_INPUT_SCHEMA,
    outputSchema: NETWORK_OUTPUT_SCHEMA,
    annotations: READ_ONLY_NETWORK_ANNOTATIONS,
  },
  execute,
  summarizeArgs,
  resultStats: networkResultStats,
};

module.exports = {
  netCheckPypiPackageTool,
};

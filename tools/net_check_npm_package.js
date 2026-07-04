const {
  READ_ONLY_NETWORK_ANNOTATIONS,
  PACKAGE_INPUT_SCHEMA,
  NPM_PACKAGE_OUTPUT_SCHEMA,
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

function buildPackageOutput(base, packageName, packageFields = {}) {
  return {
    ...base,
    package: packageName,
    found: false,
    package_status: "blocked",
    name: packageName,
    version: "",
    license: null,
    homepage: null,
    repository_url: null,
    ...packageFields,
  };
}

async function execute(args = {}) {
  let url = "";
  let packageName = "";
  try {
    packageName = normalizePackageName(args.package);
    url = `https://registry.npmjs.org/${encodeURIComponent(packageName).replace(/^%40/, "@")}`;
    const result = await fetchAllowlisted(url, {
      method: "GET",
      wantText: true,
      requireText: true,
      maxBytes: 262144,
    });

    if (!result.success) {
      return buildPackageOutput(result, packageName);
    }

    if (result.status === 404) {
      return buildPackageOutput(result, packageName, { package_status: "not_found" });
    }

    if (!result.ok) {
      return buildPackageOutput(result, packageName, { package_status: "http_error" });
    }

    if (result.truncated) {
      return buildPackageOutput(result, packageName, { package_status: "payload_too_large" });
    }

    let parsed = null;
    try {
      parsed = JSON.parse(result.text || "{}");
    } catch {
      return buildPackageOutput(result, packageName, { package_status: "invalid_json" });
    }

    const repositoryUrl = typeof parsed?.repository === "string"
      ? parsed.repository
      : typeof parsed?.repository?.url === "string"
        ? parsed.repository.url
        : null;

    return buildPackageOutput(result, packageName, {
      package_status: "ok",
      found: true,
      name: String(parsed?.name || packageName),
      version: parsed?.version ? String(parsed.version) : "",
      description: parsed?.description ? String(parsed.description).slice(0, 1000) : "",
      homepage: parsed?.homepage ? String(parsed.homepage) : null,
      repository_url: repositoryUrl,
      license: parsed?.license ? String(parsed.license) : null,
    });
  } catch (error) {
    return buildPackageOutput(
      makeBlockedOutput(url || String(args.package || ""), error?.message || String(error)),
      packageName || String(args.package || "").trim() || "unknown"
    );
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
      "Read-only bounded fetch of npm registry package metadata from registry.npmjs.org with normalized summary fields. No auth, no cookies, no disk writes.",
    inputSchema: PACKAGE_INPUT_SCHEMA,
    outputSchema: NPM_PACKAGE_OUTPUT_SCHEMA,
    annotations: READ_ONLY_NETWORK_ANNOTATIONS,
  },
  execute,
  summarizeArgs,
  resultStats: networkResultStats,
};

module.exports = {
  netCheckNpmPackageTool,
};

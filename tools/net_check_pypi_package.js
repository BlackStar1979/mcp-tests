const {
  READ_ONLY_NETWORK_ANNOTATIONS,
  PACKAGE_INPUT_SCHEMA,
  PYPI_PACKAGE_OUTPUT_SCHEMA,
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

function buildPackageOutput(base, packageName, packageFields = {}) {
  return {
    ...base,
    package: packageName,
    found: false,
    package_status: "blocked",
    name: packageName,
    version: "",
    license: null,
    project_url: null,
    package_url: null,
    requires_python: null,
    vulnerabilities_count: 0,
    ...packageFields,
  };
}

async function execute(args = {}) {
  let url = "";
  let packageName = "";
  try {
    packageName = normalizePackageName(args.package);
    url = `https://pypi.org/pypi/${encodeURIComponent(packageName)}/json`;
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

    const info = parsed?.info && typeof parsed.info === "object" ? parsed.info : {};
    const vulnerabilities = Array.isArray(parsed?.vulnerabilities) ? parsed.vulnerabilities : [];

    return buildPackageOutput(result, packageName, {
      package_status: "ok",
      found: true,
      name: String(info.name || packageName),
      version: info.version ? String(info.version) : "",
      summary: info.summary ? String(info.summary).slice(0, 1000) : "",
      project_url: info.project_url ? String(info.project_url) : null,
      package_url: info.package_url ? String(info.package_url) : null,
      requires_python: info.requires_python ? String(info.requires_python) : null,
      license: info.license ? String(info.license) : null,
      vulnerabilities_count: vulnerabilities.length,
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
    origin: "https://pypi.org",
  };
}

const netCheckPypiPackageTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Check PyPI package metadata",
    description:
      "Read-only bounded fetch of PyPI JSON package metadata from pypi.org with normalized summary fields. No auth, no cookies, no disk writes.",
    inputSchema: PACKAGE_INPUT_SCHEMA,
    outputSchema: PYPI_PACKAGE_OUTPUT_SCHEMA,
    annotations: READ_ONLY_NETWORK_ANNOTATIONS,
  },
  execute,
  summarizeArgs,
  resultStats: networkResultStats,
};

module.exports = {
  netCheckPypiPackageTool,
};

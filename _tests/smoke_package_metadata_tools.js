"use strict";

const assert = require("node:assert/strict");

const {
  NPM_PACKAGE_OUTPUT_SCHEMA,
  PYPI_PACKAGE_OUTPUT_SCHEMA,
  NETWORK_OUTPUT_SCHEMA,
} = require("../src/schemas/net_tools");

function withStubbedNetworkPolicy(toolModulePath, stubExports) {
  const resolvedTool = require.resolve(toolModulePath);
  const resolvedPolicy = require.resolve("../src/util/network_policy");
  const previousPolicy = require.cache[resolvedPolicy];
  const previousTool = require.cache[resolvedTool];

  delete require.cache[resolvedTool];
  require.cache[resolvedPolicy] = {
    id: resolvedPolicy,
    filename: resolvedPolicy,
    loaded: true,
    exports: stubExports,
  };

  try {
    return require(toolModulePath);
  } finally {
    delete require.cache[resolvedTool];
    if (previousTool) {
      require.cache[resolvedTool] = previousTool;
    }
    if (previousPolicy) {
      require.cache[resolvedPolicy] = previousPolicy;
    } else {
      delete require.cache[resolvedPolicy];
    }
  }
}

function baseFetchResult(overrides = {}) {
  return {
    success: true,
    url: "https://example.test/request",
    final_url: "https://example.test/final",
    origin: "https://example.test",
    status: 200,
    ok: true,
    content_type: "application/json",
    bytes: 128,
    truncated: false,
    duration_ms: 12,
    sha256: "abc123",
    text: "{}",
    error: "",
    ...overrides,
  };
}

async function main() {
  const npmModule = withStubbedNetworkPolicy("../tools/net_check_npm_package", {
    fetchAllowlisted: async () => baseFetchResult({
      final_url: "https://registry.npmjs.org/lodash",
      origin: "https://registry.npmjs.org",
      text: JSON.stringify({
        name: "lodash",
        version: "4.17.21",
        description: "A modern JavaScript utility library.",
        homepage: "https://lodash.com",
        repository: { url: "https://github.com/lodash/lodash.git" },
        license: "MIT",
      }),
    }),
    makeBlockedOutput: (url, error) => baseFetchResult({
      success: false,
      url,
      final_url: "",
      origin: "",
      status: 0,
      ok: false,
      content_type: "",
      bytes: 0,
      truncated: false,
      duration_ms: 0,
      sha256: "",
      text: "",
      error,
    }),
    networkResultStats: () => ({}),
    sha256: () => "stub",
  });

  const pypiModule = withStubbedNetworkPolicy("../tools/net_check_pypi_package", {
    fetchAllowlisted: async (url) => {
      if (String(url).includes("/missing/json")) {
        return baseFetchResult({
          final_url: String(url),
          origin: "https://pypi.org",
          status: 404,
          ok: false,
        });
      }
      return baseFetchResult({
        final_url: String(url),
        origin: "https://pypi.org",
        text: JSON.stringify({
          info: {
            name: "requests",
            version: "2.32.3",
            summary: "Python HTTP for Humans.",
            project_url: "https://pypi.org/project/requests/",
            package_url: "https://files.pythonhosted.org/packages/example.whl",
            requires_python: ">=3.8",
            license: "Apache-2.0",
          },
          vulnerabilities: [{ id: "PYSEC-1" }, { id: "PYSEC-2" }],
        }),
      });
    },
    makeBlockedOutput: (url, error) => baseFetchResult({
      success: false,
      url,
      final_url: "",
      origin: "",
      status: 0,
      ok: false,
      content_type: "",
      bytes: 0,
      truncated: false,
      duration_ms: 0,
      sha256: "",
      text: "",
      error,
    }),
    networkResultStats: () => ({}),
    sha256: () => "stub",
  });

  assert.deepEqual(npmModule.netCheckNpmPackageTool.descriptor.outputSchema, NPM_PACKAGE_OUTPUT_SCHEMA);
  assert.deepEqual(pypiModule.netCheckPypiPackageTool.descriptor.outputSchema, PYPI_PACKAGE_OUTPUT_SCHEMA);
  assert.notDeepEqual(npmModule.netCheckNpmPackageTool.descriptor.outputSchema, NETWORK_OUTPUT_SCHEMA);
  assert.notDeepEqual(pypiModule.netCheckPypiPackageTool.descriptor.outputSchema, NETWORK_OUTPUT_SCHEMA);

  const npmOk = await npmModule.netCheckNpmPackageTool.execute({ package: "lodash" });
  assert.equal(npmOk.package_status, "ok");
  assert.equal(npmOk.found, true);
  assert.equal(npmOk.name, "lodash");
  assert.equal(npmOk.version, "4.17.21");
  assert.equal(npmOk.homepage, "https://lodash.com");
  assert.equal(npmOk.repository_url, "https://github.com/lodash/lodash.git");
  assert.equal(npmOk.license, "MIT");

  const pypiOk = await pypiModule.netCheckPypiPackageTool.execute({ package: "requests" });
  assert.equal(pypiOk.package_status, "ok");
  assert.equal(pypiOk.found, true);
  assert.equal(pypiOk.name, "requests");
  assert.equal(pypiOk.version, "2.32.3");
  assert.equal(pypiOk.project_url, "https://pypi.org/project/requests/");
  assert.equal(pypiOk.requires_python, ">=3.8");
  assert.equal(pypiOk.vulnerabilities_count, 2);

  const pypiMissing = await pypiModule.netCheckPypiPackageTool.execute({ package: "missing" });
  assert.equal(pypiMissing.package_status, "not_found");
  assert.equal(pypiMissing.found, false);
  assert.equal(pypiMissing.status, 404);

  console.log("smoke_package_metadata_tools ok");
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});

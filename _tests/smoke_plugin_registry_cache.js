const assert = require("node:assert/strict");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const MANIFEST_PATH = path.join(ROOT, "plugins", "sample_echo_readonly", "plugin.manifest.json");
const registryModule = require("../src/plugin_registry");

const ORIGINAL_MANIFEST = {
  manifest_version: "test-mcp-plugin-manifest-v1",
  plugin_id: "sample.echo_readonly",
  plugin_version: "0.1.0",
  name: "Sample Echo Read-only Plugin",
  description: "Sample read-only plug-in used to validate the manifest-backed execution wrapper. It is executed only through an allowlisted built-in readonly handler; no dynamic import is used.",
  entrypoint: "index.js",
  status: "candidate",
  tags: ["sample", "readonly", "stage7", "stage8_1", "execution-wrapper"],
  profile_allowed: ["public", "internal"],
  public_safe: true,
  tools: [
    {
      name: "plugin_sample_echo_preview",
      title: "Sample Echo Preview",
      description: "Read-only sample echo candidate used by the execution wrapper. Executed only through an allowlisted built-in handler; no dynamic import.",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      permissions: {
        network: false,
        fs: false,
        process: false,
        write: false,
        destructive: false,
      },
      profile_allowed: ["public", "internal"],
      public_safe: true,
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["text"],
        properties: {
          text: {
            type: "string",
            minLength: 1,
            maxLength: 200,
          },
        },
      },
      outputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["success", "echo", "error"],
        properties: {
          success: { type: "boolean" },
          echo: { type: "string" },
          error: { type: "string" },
        },
      },
      execution: {
        handler_type: "builtin.echo.readonly.v1",
        dynamic_import: false,
        allowlisted: true,
        readonly_wrapper: true,
      },
    },
  ],
};

const UPDATED_MANIFEST = {
  ...ORIGINAL_MANIFEST,
  plugin_version: "0.1.1",
};

let currentVersion = 1;
let readFileCalls = 0;
let statCalls = 0;
let existsSyncCalls = 0;
let readdirCalls = 0;

const originalExistsSync = fs.existsSync;
const originalReadFile = fsp.readFile;
const originalReaddir = fsp.readdir;
const originalStat = fsp.stat;

function makeDirent(name) {
  return {
    name,
    isDirectory() {
      return true;
    },
  };
}

function currentManifestText() {
  return JSON.stringify(currentVersion === 1 ? ORIGINAL_MANIFEST : UPDATED_MANIFEST);
}

function currentManifestSize() {
  return Buffer.byteLength(currentManifestText(), "utf8");
}

fs.existsSync = function existsSyncPatched(targetPath) {
  if (targetPath === MANIFEST_PATH) {
    existsSyncCalls += 1;
    return true;
  }
  return originalExistsSync.apply(this, arguments);
};

fsp.readdir = async function readdirPatched(targetPath, options) {
  if (targetPath === path.join(ROOT, "plugins")) {
    readdirCalls += 1;
    return [makeDirent("sample_echo_readonly")];
  }
  return originalReaddir.call(this, targetPath, options);
};

fsp.stat = async function statPatched(targetPath) {
  if (targetPath === MANIFEST_PATH) {
    statCalls += 1;
    return {
      mtimeMs: currentVersion,
      size: currentManifestSize(),
    };
  }
  return originalStat.apply(this, arguments);
};

fsp.readFile = async function readFilePatched(targetPath, encoding) {
  if (targetPath === MANIFEST_PATH) {
    readFileCalls += 1;
    assert.equal(encoding, "utf8");
    return currentManifestText();
  }
  return originalReadFile.call(this, targetPath, encoding);
};

(async () => {
  registryModule.resetPluginRegistryWarmCache();

  const cold = await registryModule.buildPluginRegistry();
  assert.equal(cold.ok, true);
  assert.equal(cold.plugins[0].plugin_version, "0.1.0");
  assert.equal(readFileCalls, 1);
  assert.equal(statCalls, 1);
  assert.equal(readdirCalls, 1);
  assert.equal(existsSyncCalls, 1);

  const warm = await registryModule.buildPluginRegistry();
  assert.equal(warm.ok, true);
  assert.equal(warm.plugins[0].plugin_version, "0.1.0");
  assert.equal(readFileCalls, 1, "warm cache should avoid rereading unchanged manifest");
  assert.equal(statCalls, 2, "warm cache may restat manifests to validate fingerprint");
  assert.equal(readdirCalls, 2, "warm cache may rediscover plugin directories");
  assert.equal(existsSyncCalls, 2);

  currentVersion = 2;
  const invalidated = await registryModule.buildPluginRegistry();
  assert.equal(invalidated.ok, true);
  assert.equal(invalidated.plugins[0].plugin_version, "0.1.1");
  assert.equal(readFileCalls, 2, "manifest change should invalidate warm cache");

  console.log("smoke_plugin_registry_cache ok");
})()
  .finally(() => {
    fs.existsSync = originalExistsSync;
    fsp.readFile = originalReadFile;
    fsp.readdir = originalReaddir;
    fsp.stat = originalStat;
    registryModule.resetPluginRegistryWarmCache();
  })
  .catch((error) => {
    console.error(error?.stack || error?.message || String(error));
    process.exit(1);
  });

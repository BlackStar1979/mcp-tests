"use strict";

const assert = require("node:assert/strict");

const {
  previewRemoteSiteRetention,
  readRemoteSiteFile,
  remoteSiteRuntimeStatus,
  withSftp,
} = require("../src/util/remote_site_tools");

function buildDeps({ endError = null, operationError = null, listError = null, getError = null } = {}) {
  const calls = [];
  class FakeSftpClient {
    async connect(config) {
      calls.push({ type: "connect", config });
    }
    async mkdir(remoteDir) {
      calls.push({ type: "mkdir", remoteDir });
    }
    async list(remoteDir) {
      calls.push({ type: "list", remoteDir });
      if (listError) throw listError;
      return [];
    }
    async stat(remotePath) {
      calls.push({ type: "stat", remotePath });
      return { type: "-", size: Buffer.byteLength("hello world", "utf8") };
    }
    async get(remotePath) {
      calls.push({ type: "get", remotePath });
      if (typeof getError === "function") {
        const maybeError = getError(remotePath);
        if (maybeError) throw maybeError;
      }
      if (remotePath.endsWith("/logs/site-files.log")) {
        return Buffer.from("", "utf8");
      }
      if (remotePath.endsWith(".json")) {
        return Buffer.from("{\"schema_version\":1,\"operation\":\"write\",\"operation_id\":\"op-1\"}", "utf8");
      }
      return Buffer.from("hello world", "utf8");
    }
    async end() {
      calls.push({ type: "end" });
      if (endError) throw endError;
    }
  }

  return {
    calls,
    deps: {
      async loadRemoteConfig() {
        return {
          host: "example.test",
          port: 22,
          username: "codex",
          privateKey: "key",
          passphrase: undefined,
          siteRoot: "/srv/site",
          opsRoot: "/srv/ops",
          maxFileBytes: 1024,
          allowedExtensions: new Set([".txt"]),
        };
      },
      async loadSftpClient() {
        return FakeSftpClient;
      },
    },
    operationError,
  };
}

(async () => {
  const success = buildDeps();
  const value = await withSftp("ignored.json", async () => "ok", success.deps);
  assert.equal(value, "ok");
  assert.ok(success.calls.some((entry) => entry.type === "connect"));
  assert.equal(success.calls.filter((entry) => entry.type === "mkdir").length, 4);
  assert.equal(success.calls.filter((entry) => entry.type === "end").length, 1);

  const readOnlyRead = buildDeps();
  const readResult = await readRemoteSiteFile({
    vps_config_ref: "ignored.json",
    remote_path: "index.html",
  }, readOnlyRead.deps);
  assert.equal(readResult.text, "hello world");
  assert.equal(readOnlyRead.calls.filter((entry) => entry.type === "mkdir").length, 0);

  const readOnlyStatus = buildDeps();
  const statusResult = await remoteSiteRuntimeStatus({
    vps_config_ref: "ignored.json",
  }, readOnlyStatus.deps);
  assert.equal(statusResult.status, "attention_required");
  assert.equal(readOnlyStatus.calls.filter((entry) => entry.type === "mkdir").length, 0);

  const missingOpsRootStatus = buildDeps({ listError: new Error("No such file") });
  const missingStatusResult = await remoteSiteRuntimeStatus({
    vps_config_ref: "ignored.json",
  }, missingOpsRootStatus.deps);
  assert.equal(missingStatusResult.status, "attention_required");
  assert.equal(missingStatusResult.inventory.total_artifacts, 0);
  assert.equal(missingOpsRootStatus.calls.filter((entry) => entry.type === "mkdir").length, 0);

  const missingOpsRootPreview = buildDeps({ listError: new Error("No such file") });
  const previewResult = await previewRemoteSiteRetention({
    vps_config_ref: "ignored.json",
  }, missingOpsRootPreview.deps);
  assert.equal(previewResult.purge_count, 0);
  assert.equal(missingOpsRootPreview.calls.filter((entry) => entry.type === "mkdir").length, 0);

  const logReadFailureStatus = buildDeps({
    getError(remotePath) {
      if (remotePath.endsWith("/logs/site-files.log")) {
        return new Error("Permission denied");
      }
      return null;
    },
  });
  const logReadFailureResult = await remoteSiteRuntimeStatus({
    vps_config_ref: "ignored.json",
  }, logReadFailureStatus.deps);
  assert.equal(logReadFailureResult.status, "attention_required");
  assert.ok(logReadFailureResult.warnings.some((warning) => warning.code === "log_read_failed"));
  assert.equal(logReadFailureStatus.calls.filter((entry) => entry.type === "mkdir").length, 0);

  const cleanupFailure = buildDeps({ endError: new Error("disconnect blocked") });
  await assert.rejects(
    () => withSftp("ignored.json", async () => "ok", cleanupFailure.deps),
    /disconnect blocked/
  );

  const operationFailure = buildDeps({
    endError: new Error("disconnect blocked"),
    operationError: new Error("operation failed"),
  });
  await assert.rejects(
    () => withSftp("ignored.json", async () => { throw operationFailure.operationError; }, operationFailure.deps),
    /operation failed \[cleanup failed: disconnect blocked\]/
  );

  const invalidSiteRoot = buildDeps();
  invalidSiteRoot.deps.loadRemoteConfig = async () => ({
    host: "example.test",
    port: 22,
    username: "codex",
    privateKey: "key",
    siteRoot: "srv/site",
    opsRoot: "/srv/ops",
    maxFileBytes: 1024,
    allowedExtensions: new Set([".txt"]),
  });
  await assert.rejects(
    () => withSftp("ignored.json", async () => "ok", invalidSiteRoot.deps),
    /siteRoot must be an absolute POSIX path/
  );
  assert.equal(invalidSiteRoot.calls.filter((entry) => entry.type === "connect").length, 0);

  const invalidOpsRoot = buildDeps();
  invalidOpsRoot.deps.loadRemoteConfig = async () => ({
    host: "example.test",
    port: 22,
    username: "codex",
    privateKey: "key",
    siteRoot: "/srv/site",
    opsRoot: "srv/ops",
    maxFileBytes: 1024,
    allowedExtensions: new Set([".txt"]),
  });
  await assert.rejects(
    () => withSftp("ignored.json", async () => "ok", invalidOpsRoot.deps),
    /opsRoot must be an absolute POSIX path/
  );
  assert.equal(invalidOpsRoot.calls.filter((entry) => entry.type === "connect").length, 0);

  console.log("smoke_remote_site_lifecycle ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});

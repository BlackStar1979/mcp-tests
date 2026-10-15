"use strict";

const assert = require("node:assert/strict");

const {
  moveRemoteSiteFile,
  writeRemoteSiteFile,
} = require("../src/util/remote_site_tools");

function missingError() {
  const error = new Error("No such file");
  error.code = "ENOENT";
  return error;
}

function buildHarness({ failMoveManifest = false } = {}) {
  const files = new Map([["/srv/site/file.txt", Buffer.from("before\n", "utf8")], ["/srv/site/source.txt", Buffer.from("move\n", "utf8")]]);
  const calls = [];

  class FakeSftpClient {
    async connect() {
      calls.push({ type: "connect" });
    }
    async mkdir(remotePath) {
      calls.push({ type: "mkdir", remotePath });
    }
    async stat(remotePath) {
      calls.push({ type: "stat", remotePath });
      if (!files.has(remotePath)) throw missingError();
      return { type: "-", size: files.get(remotePath).length };
    }
    async get(remotePath) {
      calls.push({ type: "get", remotePath });
      if (!files.has(remotePath)) throw missingError();
      return files.get(remotePath);
    }
    async put(data, remotePath) {
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(String(data), "utf8");
      calls.push({ type: "put", remotePath, text: buffer.toString("utf8") });
      if (remotePath.includes("/edits/") && remotePath.endsWith(".diff")) {
        await new Promise((resolve) => setTimeout(resolve, 8));
      }
      if (failMoveManifest && remotePath.includes("/meta/") && buffer.toString("utf8").includes('"operation": "move"')) {
        throw new Error("manifest write blocked");
      }
      files.set(remotePath, buffer);
    }
    async append(data, remotePath) {
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(String(data), "utf8");
      calls.push({ type: "append", remotePath, text: buffer.toString("utf8") });
      files.set(remotePath, Buffer.concat([files.get(remotePath) || Buffer.alloc(0), buffer]));
    }
    async rename(source, target) {
      calls.push({ type: "rename", source, target });
      if (!files.has(source)) throw missingError();
      files.set(target, files.get(source));
      files.delete(source);
    }
    async end() {
      calls.push({ type: "end" });
    }
  }

  return {
    files,
    calls,
    deps: {
      async loadRemoteConfig() {
        return {
          host: "example.test",
          port: 22,
          username: "operator",
          privateKey: "fixture",
          siteRoot: "/srv/site",
          opsRoot: "/srv/ops",
          maxFileBytes: 4096,
          allowedExtensions: new Set([".txt"]),
        };
      },
      async loadSftpClient() {
        return FakeSftpClient;
      },
    },
  };
}

(async () => {
  const writeHarness = buildHarness();
  const writeResult = await writeRemoteSiteFile({
    vps_config_ref: "fixture.json",
    remote_path: "file.txt",
    content: "after\n",
  }, writeHarness.deps);

  const diffPut = writeHarness.calls.find((call) => call.type === "put" && call.remotePath.includes("/edits/") && call.remotePath.endsWith(".diff"));
  const writeMetaPut = writeHarness.calls.find((call) => call.type === "put" && call.remotePath.includes("/meta/"));
  const writeLogAppend = writeHarness.calls.find((call) => call.type === "append" && call.remotePath.endsWith("/logs/site-files.log"));
  assert.ok(diffPut, "existing write must create one diff artifact");
  assert.ok(writeMetaPut, "write must create metadata manifest");
  assert.ok(writeLogAppend, "write must append audit log");
  const writeManifest = JSON.parse(writeMetaPut.text);
  const writeLog = JSON.parse(writeLogAppend.text.trim());
  assert.equal(writeManifest.artifact_path, diffPut.remotePath);
  assert.equal(writeLog.artifact, diffPut.remotePath);
  assert.equal(writeResult.diff, diffPut.remotePath);
  assert.equal(writeManifest.operation_id, writeLog.operation_id);
  assert.equal(writeManifest.operation_id, writeResult.operation_id);
  assert.equal(writeManifest.correlation_id, writeLog.correlation_id);
  assert.equal(writeManifest.correlation_id, writeResult.correlation_id);

  const moveHarness = buildHarness();
  const moveResult = await moveRemoteSiteFile({
    vps_config_ref: "fixture.json",
    source_path: "source.txt",
    target_path: "target.txt",
  }, moveHarness.deps);
  const moveMetaPut = moveHarness.calls.find((call) => call.type === "put" && call.remotePath.includes("/meta/") && call.text.includes('"operation": "move"'));
  const moveLogAppend = moveHarness.calls.find((call) => call.type === "append" && call.remotePath.endsWith("/logs/site-files.log"));
  assert.ok(moveMetaPut, "move must create metadata manifest");
  assert.ok(moveLogAppend, "move must append audit log");
  const moveManifest = JSON.parse(moveMetaPut.text);
  const moveLog = JSON.parse(moveLogAppend.text.trim());
  assert.equal(moveManifest.details.source_path, "source.txt");
  assert.equal(moveManifest.details.target_path, "target.txt");
  assert.equal(moveManifest.operation_id, moveLog.operation_id);
  assert.equal(moveManifest.operation_id, moveResult.operation_id);
  assert.equal(moveManifest.correlation_id, moveLog.correlation_id);
  assert.equal(moveManifest.correlation_id, moveResult.correlation_id);
  assert.equal(moveResult.metadata_path, moveMetaPut.remotePath);

  const rollbackHarness = buildHarness({ failMoveManifest: true });
  await assert.rejects(
    () => moveRemoteSiteFile({
      vps_config_ref: "fixture.json",
      source_path: "source.txt",
      target_path: "target.txt",
    }, rollbackHarness.deps),
    /audit failed.*rolled back|manifest write blocked.*rolled back/i
  );
  assert.equal(rollbackHarness.files.has("/srv/site/source.txt"), true);
  assert.equal(rollbackHarness.files.has("/srv/site/target.txt"), false);
  assert.deepEqual(
    rollbackHarness.calls.filter((call) => call.type === "rename").map((call) => [call.source, call.target]),
    [["/srv/site/source.txt", "/srv/site/target.txt"], ["/srv/site/target.txt", "/srv/site/source.txt"]]
  );

  console.log("smoke_remote_site_mutation_audit ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});

"use strict";

const assert = require("node:assert/strict");

const { withSftp } = require("../src/util/remote_site_tools");

function buildDeps({ endError = null, operationError = null } = {}) {
  const calls = [];
  class FakeSftpClient {
    async connect(config) {
      calls.push({ type: "connect", config });
    }
    async mkdir(remoteDir) {
      calls.push({ type: "mkdir", remoteDir });
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

  console.log("smoke_remote_site_lifecycle ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});

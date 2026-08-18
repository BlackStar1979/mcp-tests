"use strict";

const assert = require("node:assert/strict");
const { dispatchRpcMessage } = require("../src/runtime/rpc_message_dispatcher");
const {
  ARTIFACT_DEFAULT_CHUNK_CHARS,
  buildProcessArtifactResourceLink,
  buildProcessArtifactUri,
  parseProcessArtifactUri,
} = require("../src/runtime/process_artifact_resource");

const ARTIFACT_ID = "11111111111111111111111111111111";
const SHA = "a".repeat(64);

function baseArgs(context, prelude) {
  return {
    prelude,
    context,
    serverName: "test",
    serverVersion: "0.0.0",
    connectorShapeVersion: "shape",
    outputMode: "structured",
    authMode: "oauth21",
    profile: "internal",
    tools: [],
    documentRuntimeContext: () => ({ docs: [] }),
    auditLog() {},
    getOptionalTool() { return null; },
    rateLimiter: null,
    serverStartId: "start-1",
    disableLegacyInitialize: false,
  };
}

(async () => {
  const baseUri = buildProcessArtifactUri(ARTIFACT_ID);
  assert.equal(baseUri, `mcp-artifact://process/${ARTIFACT_ID}`);
  assert.deepEqual(parseProcessArtifactUri(`${baseUri}?offset=17&max_chars=4096`), {
    artifactId: ARTIFACT_ID,
    offset: 17,
    maxChars: 4096,
  });
  assert.equal(parseProcessArtifactUri("file:///tmp/not-artifact"), null);
  assert.equal(parseProcessArtifactUri(`mcp-artifact://process/${"0".repeat(32)}`), null);

  const link = buildProcessArtifactResourceLink({
    artifactId: ARTIFACT_ID,
    stream: "stdout",
    mimeType: "text/plain; charset=utf-8",
    chars: 120000,
    bytes: 120000,
    sha256: SHA,
    expiresAtMs: Date.parse("2026-08-15T12:00:00.000Z"),
  });
  assert.equal(link.type, "resource_link");
  assert.equal(link.uri, baseUri);
  assert.equal(link.name, "process-stdout.txt");
  assert.equal(link.mimeType, "text/plain; charset=utf-8");
  assert.match(link.description, /sha256=/);
  assert.equal(link.uri.includes("owner"), false);
  assert.equal(link.uri.includes("job"), false);

  let readCalls = 0;
  const manager = {
    readArtifact(artifactId, cursor, owner) {
      readCalls += 1;
      assert.equal(artifactId, ARTIFACT_ID);
      assert.equal(owner.ownerId, "client-a");
      assert.equal(cursor.offset, 17);
      assert.equal(cursor.maxChars, 4096);
      return {
        artifactId,
        stream: "stdout",
        mimeType: "text/plain; charset=utf-8",
        chars: 120000,
        bytes: 120000,
        sha256: SHA,
        createdAtMs: Date.parse("2026-08-14T12:00:00.000Z"),
        expiresAtMs: Date.parse("2026-08-15T12:00:00.000Z"),
        traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
        spanId: "00f067aa0ba902b7",
        text: "chunk",
        offset: 17,
        nextOffset: 22,
        eof: false,
      };
    },
  };
  const context = {
    requestId: "req-artifact-read",
    protocolVersion: "2026-07-28",
    authResult: { clientId: "client-a" },
    processJobManager: manager,
  };
  const read = await dispatchRpcMessage(baseArgs(context, {
    id: 1,
    method: "resources/read",
    params: { uri: `${baseUri}?offset=17&max_chars=4096` },
  }));
  assert.equal(readCalls, 1);
  assert.equal(read.result.contents.length, 1);
  assert.equal(read.result.contents[0].uri, `${baseUri}?offset=17&max_chars=4096`);
  assert.equal(read.result.contents[0].mimeType, "text/plain; charset=utf-8");
  assert.equal(read.result.contents[0].text, "chunk");
  assert.equal(read.result.cacheScope, "private");
  assert.equal(read.result._meta["mcp-tests/artifactSha256"], SHA);
  assert.equal(read.result._meta["mcp-tests/artifactNextOffset"], 22);
  assert.equal(read.result._meta["mcp-tests/artifactEof"], false);
  assert.equal(
    read.result._meta["mcp-tests/nextChunkUri"],
    `${baseUri}?offset=22&max_chars=4096`
  );
  assert.equal(JSON.stringify(read.result).includes("client-a"), false);

  const list = await dispatchRpcMessage(baseArgs(context, { id: 2, method: "resources/list", params: {} }));
  assert.deepEqual(list.result.resources, []);

  const missingManager = {
    readArtifact() { return null; },
  };
  const missing = await dispatchRpcMessage(baseArgs({ ...context, processJobManager: missingManager }, {
    id: 3,
    method: "resources/read",
    params: { uri: baseUri },
  }));
  assert.equal(missing.error.code, -32602);
  assert.equal(missing.error.message, "Resource not found");

  const defaultChunk = parseProcessArtifactUri(baseUri);
  assert.equal(defaultChunk.maxChars, ARTIFACT_DEFAULT_CHUNK_CHARS);

  console.log("smoke_process_artifact_resources ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});

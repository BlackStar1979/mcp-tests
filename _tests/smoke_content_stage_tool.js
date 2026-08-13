"use strict";

const assert = require("node:assert/strict");
const { contentStageTool } = require("../tools/content_stage");

const calls = [];
const manager = {
  create(ownerId) {
    calls.push(["create", ownerId]);
    return { stage_id: "stage-1234567890123456", state: "open", next_sequence: 0, chars: 0, bytes: 0, sha256: null, expires_at: "2026-08-14T00:00:00.000Z" };
  },
  append(ownerId, stageId, sequence, chunk) {
    calls.push(["append", ownerId, stageId, sequence, chunk]);
    return { stage_id: stageId, state: "open", next_sequence: 1, chars: chunk.length, bytes: chunk.length, sha256: null, expires_at: "2026-08-14T00:00:00.000Z", accepted_chars: chunk.length, accepted_bytes: chunk.length };
  },
  seal(ownerId, stageId, expected) {
    calls.push(["seal", ownerId, stageId, expected]);
    return { stage_id: stageId, state: "sealed", next_sequence: 1, chars: 5, bytes: 5, sha256: "a".repeat(64), expires_at: "2026-08-14T00:00:00.000Z" };
  },
  status(ownerId, stageId) {
    calls.push(["status", ownerId, stageId]);
    return { stage_id: stageId, state: "sealed", next_sequence: 1, chars: 5, bytes: 5, sha256: "a".repeat(64), expires_at: "2026-08-14T00:00:00.000Z" };
  },
  release(ownerId, stageId) {
    calls.push(["release", ownerId, stageId]);
    return { stage_id: stageId, state: "released", next_sequence: 1, chars: 5, bytes: 5, sha256: "a".repeat(64), expires_at: null };
  },
};

(async () => {
  assert.equal(contentStageTool.descriptor.annotations.readOnlyHint, false);
  assert.equal(contentStageTool.descriptor.annotations.destructiveHint, false);

  const context = { authResult: { clientId: "oauth-client-a" }, contentStageManager: manager };
  const created = await contentStageTool.execute({ action: "create" }, context);
  assert.equal(created.success, true);
  assert.deepEqual(calls.shift(), ["create", "oauth-client-a"]);

  const appended = await contentStageTool.execute({
    action: "append",
    stage_id: created.stage_id,
    sequence: 0,
    chunk: "alpha",
  }, context);
  assert.equal(appended.accepted_chars, 5);
  assert.deepEqual(calls.shift(), ["append", "oauth-client-a", created.stage_id, 0, "alpha"]);

  const sealed = await contentStageTool.execute({
    action: "seal",
    stage_id: created.stage_id,
    expected_chars: 5,
    expected_sha256: "a".repeat(64),
  }, context);
  assert.equal(sealed.state, "sealed");
  assert.equal(calls.shift()[0], "seal");

  await contentStageTool.execute({ action: "status", stage_id: created.stage_id }, context);
  assert.equal(calls.shift()[0], "status");
  await contentStageTool.execute({ action: "release", stage_id: created.stage_id }, context);
  assert.equal(calls.shift()[0], "release");

  const invalid = await contentStageTool.execute({ action: "unsupported" }, context);
  assert.equal(invalid.success, false);
  assert.equal(invalid.error.code, "content_stage_action_invalid");

  const summary = contentStageTool.summarizeArgs({ action: "append", stage_id: created.stage_id, chunk: "secret payload" });
  assert.equal(JSON.stringify(summary).includes("secret payload"), false);
  assert.equal(summary.chunk_chars, 14);

  console.log("smoke_content_stage_tool ok");
})().catch((error) => {
  console.error(error?.stack || error);
  process.exit(1);
});

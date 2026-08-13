"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const { createContentStageManager } = require("../src/util/content_stage_manager");

async function streamText(stream) {
  let text = "";
  for await (const chunk of stream) text += String(chunk);
  return text;
}

(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-content-stage-"));
  const storageFile = path.join(root, "stages.sqlite");
  const audit = [];
  let nowMs = Date.parse("2026-08-13T18:00:00.000Z");
  let idCounter = 0;
  const options = {
    storageFile,
    now: () => nowMs,
    randomUUID: () => `00000000-0000-4000-8000-${String(++idCounter).padStart(12, "0")}`,
    audit: (entry) => audit.push(entry),
  };

  let manager = createContentStageManager(options);
  const created = manager.create("client-a");
  assert.equal(created.state, "open");
  assert.equal(created.next_sequence, 0);
  assert.ok(!JSON.stringify(created).includes("client-a"));

  const first = manager.append("client-a", created.stage_id, 0, "alpha");
  assert.equal(first.next_sequence, 1);
  assert.equal(first.chars, 5);
  assert.throws(
    () => manager.append("client-a", created.stage_id, 0, "duplicate"),
    (error) => error.code === "content_stage_sequence_conflict"
  );
  manager.append("client-a", created.stage_id, 1, "beta");
  assert.throws(
    () => manager.status("client-b", created.stage_id),
    (error) => error.code === "content_stage_not_found"
  );

  const expectedSha = crypto.createHash("sha256").update("alphabeta").digest("hex");
  const sealed = manager.seal("client-a", created.stage_id, {
    expected_chars: 9,
    expected_sha256: expectedSha,
  });
  assert.equal(sealed.state, "sealed");
  assert.equal(sealed.sha256, expectedSha);
  assert.throws(
    () => manager.append("client-a", created.stage_id, 2, "blocked"),
    (error) => error.code === "content_stage_not_open"
  );
  assert.equal(await streamText(manager.openReadStream("client-a", created.stage_id)), "alphabeta");

  const mismatch = manager.create("client-a");
  manager.append("client-a", mismatch.stage_id, 0, "integrity");
  assert.throws(
    () => manager.seal("client-a", mismatch.stage_id, { expected_sha256: "0".repeat(64) }),
    (error) => error.code === "content_stage_integrity_mismatch"
  );
  assert.equal(manager.status("client-a", mismatch.stage_id).state, "open");
  manager.release("client-a", mismatch.stage_id);

  const unicode = manager.create("client-a");
  const unicodeAppend = manager.append("client-a", unicode.stage_id, 0, "😀");
  assert.equal(unicodeAppend.chars, 2);
  assert.equal(unicodeAppend.bytes, 4);
  assert.throws(
    () => manager.append("client-a", unicode.stage_id, 1, "\uD83D"),
    (error) => error.code === "content_stage_invalid_utf8"
  );
  manager.release("client-a", unicode.stage_id);
  manager.close();

  manager = createContentStageManager(options);
  assert.equal(manager.status("client-a", created.stage_id).sha256, expectedSha);
  assert.equal(await streamText(manager.openReadStream("client-a", created.stage_id)), "alphabeta");

  const db = new DatabaseSync(storageFile, { readOnly: true });
  const persisted = db.prepare("SELECT owner_key, state, char_count FROM content_stages WHERE stage_id=?").get(created.stage_id);
  assert.equal(persisted.state, "sealed");
  assert.equal(Number(persisted.char_count), 9);
  assert.notEqual(persisted.owner_key, "client-a");
  assert.equal(persisted.owner_key.length, 64);
  db.close();

  assert.ok(!JSON.stringify(audit).includes("alpha"));
  assert.ok(!JSON.stringify(audit).includes("beta"));
  assert.ok(!JSON.stringify(audit).includes("client-a"));

  manager.release("client-a", created.stage_id);
  assert.throws(
    () => manager.status("client-a", created.stage_id),
    (error) => error.code === "content_stage_not_found"
  );
  manager.close();

  const quotaManager = createContentStageManager({
    storageFile: path.join(root, "quotas.sqlite"),
    now: () => nowMs,
    randomUUID: () => `10000000-0000-4000-8000-${String(++idCounter).padStart(12, "0")}`,
    maxStageBytes: 8,
    maxOwnerBytes: 12,
    maxOwnerStages: 2,
    retentionMs: 1000,
  });
  const quotaA = quotaManager.create("owner");
  quotaManager.append("owner", quotaA.stage_id, 0, "12345678");
  assert.throws(
    () => quotaManager.append("owner", quotaA.stage_id, 1, "9"),
    (error) => error.code === "content_stage_size_limit"
  );
  const quotaB = quotaManager.create("owner");
  quotaManager.append("owner", quotaB.stage_id, 0, "1234");
  assert.throws(
    () => quotaManager.create("owner"),
    (error) => error.code === "content_stage_count_limit"
  );
  const otherOwner = quotaManager.create("other-owner");
  quotaManager.append("other-owner", otherOwner.stage_id, 0, "separate");
  nowMs += 1001;
  const afterPrune = quotaManager.create("owner");
  assert.equal(afterPrune.state, "open");
  quotaManager.close();

  fs.rmSync(root, { recursive: true, force: true });
  console.log("smoke_content_stage_manager ok");
})().catch((error) => {
  console.error(error?.stack || error);
  process.exit(1);
});

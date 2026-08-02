"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-tests-memory-task-lifecycle-"));
process.env.MCP_TEST_MEMORY_LOG_DIR = tempRoot;

const { createTask, getTasks } = require("../src/memory/memory_store");
const { memoryUpdateTaskTool } = require("../tools/memory_update_task");

(async () => {
  try {
    const task = await createTask({
      created_by: "codex",
      assigned_to: "codex",
      title: "Verify task lifecycle",
      description: "Exercise append-only task status snapshots.",
      priority: 8,
    });
    const other = await createTask({
      created_by: "codex",
      assigned_to: "hermes",
      title: "Preserve unrelated task",
      priority: 4,
    });

    const updated = await memoryUpdateTaskTool.execute({
      task_id: task.id,
      updated_by: "codex",
      status: "done",
    });
    assert.deepEqual(updated, {
      success: true,
      id: task.id,
      status: "done",
      previous_status: "pending",
      error: "",
    });

    assert.deepEqual((await getTasks({ assigned_to: "codex", status: "pending" })).map((item) => item.id), []);
    assert.deepEqual((await getTasks({ assigned_to: "codex", status: "done" })).map((item) => item.id), [task.id]);
    assert.deepEqual((await getTasks({ assigned_to: "hermes", status: "pending" })).map((item) => item.id), [other.id]);

    const idempotent = await memoryUpdateTaskTool.execute({
      task_id: task.id,
      updated_by: "codex",
      status: "done",
    });
    assert.equal(idempotent.success, true);
    assert.equal(idempotent.previous_status, "done");
    assert.deepEqual((await getTasks({ assigned_to: "codex", status: "done" })).map((item) => item.id), [task.id]);

    const missing = await memoryUpdateTaskTool.execute({
      task_id: "missing-task",
      updated_by: "codex",
      status: "cancelled",
    });
    assert.equal(missing.success, false);
    assert.equal(missing.error, "task_not_found");

    const invalid = await memoryUpdateTaskTool.execute({
      task_id: task.id,
      updated_by: "codex",
      status: "unknown",
    });
    assert.equal(invalid.success, false);
    assert.equal(invalid.error, "Invalid status: unknown");

    const snapshots = fs.readFileSync(path.join(tempRoot, ".mcp-agent-tasks.jsonl"), "utf8")
      .trim().split(/\r?\n/).map((line) => JSON.parse(line));
    assert.equal(snapshots.length, 4);
    assert.equal(snapshots[0].id, task.id);
    assert.equal(snapshots[3].id, task.id);
    assert.equal(snapshots[3].status, "done");
    assert.equal(snapshots[3].updated_by, "codex");
    assert.equal(typeof snapshots[3].updated_at, "string");
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    delete process.env.MCP_TEST_MEMORY_LOG_DIR;
  }

  console.log("smoke_memory_task_lifecycle ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});

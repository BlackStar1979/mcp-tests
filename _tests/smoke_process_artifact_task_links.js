"use strict";

const assert = require("node:assert/strict");
const {
  TASK_INLINE_OUTPUT_CHARS,
  buildDetailedTask,
} = require("../src/runtime/mcp_tasks_extension");

const ARTIFACT_ID = "11111111111111111111111111111111";

(() => {
  const stdout = "A".repeat(TASK_INLINE_OUTPUT_CHARS + 5000);
  const stderr = "B".repeat(1024);
  const status = {
    job_id: "job-artifact-task",
    status: "ok",
    terminal: true,
    command: "fixture",
    family: "runtime",
    resolution_class: "fixture",
    cwd: ".",
    workspace: "mcp-tests",
    created_at: "2026-08-14T12:00:00.000Z",
    started_at: "2026-08-14T12:00:00.100Z",
    finished_at: "2026-08-14T12:00:01.000Z",
    duration_ms: 900,
    timeout_ms: 5000,
    output_limit_chars: stdout.length + stderr.length,
    stdout_chars: stdout.length,
    stderr_chars: stderr.length,
    stdout_truncated: false,
    stderr_truncated: false,
    exit_code: 0,
    signal: null,
    timed_out: false,
    error: null,
    durable: true,
    recovered_after_restart: false,
  };
  const manager = {
    output(_jobId, cursor) {
      const max = cursor.max_chars;
      const out = stdout.slice(cursor.stdout_offset || 0, (cursor.stdout_offset || 0) + max);
      const remaining = Math.max(0, max - out.length);
      const err = stderr.slice(cursor.stderr_offset || 0, (cursor.stderr_offset || 0) + remaining);
      return {
        stdout: out,
        stderr: err,
        stdout_next_offset: (cursor.stdout_offset || 0) + out.length,
        stderr_next_offset: (cursor.stderr_offset || 0) + err.length,
        stdout_eof: (cursor.stdout_offset || 0) + out.length >= stdout.length,
        stderr_eof: (cursor.stderr_offset || 0) + err.length >= stderr.length,
        terminal: true,
        status: "ok",
      };
    },
    trace() {
      return { trace_id: "4bf92f3577b34da6a3ce929d0e0e4736" };
    },
    artifacts(_jobId, owner) {
      assert.equal(owner.ownerId, "client-a");
      return [
        {
          artifactId: ARTIFACT_ID,
          stream: "stdout",
          mimeType: "text/plain; charset=utf-8",
          chars: stdout.length,
          bytes: stdout.length,
          sha256: "a".repeat(64),
          expiresAtMs: Date.parse("2026-08-15T12:00:00.000Z"),
        },
        {
          artifactId: "22222222222222222222222222222222",
          stream: "stderr",
          mimeType: "text/plain; charset=utf-8",
          chars: stderr.length,
          bytes: stderr.length,
          sha256: "b".repeat(64),
          expiresAtMs: Date.parse("2026-08-15T12:00:00.000Z"),
        },
      ];
    },
  };

  const task = buildDetailedTask({ manager, ownerId: "client-a", status, outputMode: "structured" });
  assert.equal(task.status, "completed");
  assert.ok(task.result.structuredContent.stdout.length <= TASK_INLINE_OUTPUT_CHARS);
  assert.equal(task.result.structuredContent.stdout_truncated, true);
  assert.equal(task.result._meta["mcp-tests/processArtifactOutputExcerpt"], true);
  const links = task.result.content.filter((item) => item.type === "resource_link");
  assert.equal(links.length, 2);
  assert.equal(links[0].uri, `mcp-artifact://process/${ARTIFACT_ID}`);
  assert.equal(links[0].name, "process-stdout.txt");
  assert.equal(links[1].name, "process-stderr.txt");
  assert.equal(links[0]._meta?.["mcp-tests/outputTrust"], "untrusted_tool_output");
  assert.equal(links[1]._meta?.["mcp-tests/outputTrust"], "untrusted_tool_output");

  const smallStatus = { ...status, stdout_chars: 4, stderr_chars: 0, output_limit_chars: 4 };
  const smallManager = {
    output() {
      return {
        stdout: "done",
        stderr: "",
        stdout_next_offset: 4,
        stderr_next_offset: 0,
        stdout_eof: true,
        stderr_eof: true,
        terminal: true,
        status: "ok",
      };
    },
    trace: manager.trace,
    artifacts() { throw new Error("small results must not materialize resource links through the Task result path"); },
  };
  const small = buildDetailedTask({ manager: smallManager, ownerId: "client-a", status: smallStatus, outputMode: "structured" });
  assert.equal(small.result.structuredContent.stdout, "done");
  assert.equal(small.result.content.some((item) => item.type === "resource_link"), false);

  const invalidSchemaTask = buildDetailedTask({
    manager: smallManager,
    ownerId: "client-a",
    status: { ...smallStatus, command: 123 },
    outputMode: "structured",
  });
  assert.equal(invalidSchemaTask.result.isError, true, "Task process output must be fail-closed against RUN_PROCESS_OUTPUT_SCHEMA");
  assert.equal(invalidSchemaTask.result.structuredContent, undefined);

  console.log("smoke_process_artifact_task_links ok");
})();

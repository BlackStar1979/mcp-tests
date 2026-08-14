"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { createProcessJobStore } = require("../src/util/process_job_store");

const TRACE_ID = "4bf92f3577b34da6a3ce929d0e0e4736";
const SPAN_ID = "00f067aa0ba902b7";

(() => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-tests-trace-migration-"));
  const storageFile = path.join(tempRoot, "legacy.sqlite");
  let store = null;
  try {
    const legacy = new DatabaseSync(storageFile);
    legacy.exec(`
      CREATE TABLE process_jobs (
        job_id TEXT PRIMARY KEY,
        runtime_scope TEXT NOT NULL,
        owner_key TEXT NOT NULL,
        command TEXT NOT NULL,
        family TEXT NOT NULL,
        resolution_class TEXT NOT NULL,
        cwd TEXT NOT NULL,
        workspace TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at_ms INTEGER NOT NULL,
        started_at_ms INTEGER,
        finished_at_ms INTEGER,
        updated_at_ms INTEGER NOT NULL,
        timeout_ms INTEGER NOT NULL,
        output_limit_chars INTEGER NOT NULL,
        stdout TEXT NOT NULL DEFAULT '',
        stderr TEXT NOT NULL DEFAULT '',
        stdout_truncated INTEGER NOT NULL DEFAULT 0,
        stderr_truncated INTEGER NOT NULL DEFAULT 0,
        exit_code INTEGER,
        signal TEXT,
        timed_out INTEGER NOT NULL DEFAULT 0,
        error TEXT,
        cancellation_reason_code TEXT,
        server_instance_id TEXT NOT NULL,
        server_pid INTEGER,
        recovered_after_restart INTEGER NOT NULL DEFAULT 0
      );
    `);
    legacy.close();

    store = createProcessJobStore({
      storageFile,
      runtimeScope: "trace-migration",
      serverInstanceId: "migration-instance",
      serverPid: 4242,
      processKill: () => { throw new Error("not running"); },
    });
    store.create({
      id: "job-trace",
      ownerKey: "owner-key",
      command: "fixture",
      family: "runtime",
      resolutionClass: "fixture",
      cwd: ".",
      workspace: "mcp-tests",
      traceId: TRACE_ID,
      spanId: SPAN_ID,
      parentSpanId: null,
      traceFlags: "01",
      traceSource: "internal_child",
      createdAtMs: 1000,
      timeoutMs: 5000,
      outputLimit: 10000,
    });
    const migrated = store.get("job-trace", "owner-key");
    assert.equal(migrated.traceId, TRACE_ID);
    assert.equal(migrated.spanId, SPAN_ID);
    assert.equal(migrated.parentSpanId, null);
    assert.equal(migrated.traceFlags, "01");
    assert.equal(migrated.traceSource, "internal_child");
    store.close();
    store = null;

    const inspect = new DatabaseSync(storageFile);
    const columns = new Set(inspect.prepare("PRAGMA table_info(process_jobs)").all().map((row) => row.name));
    for (const column of ["trace_id", "span_id", "parent_span_id", "trace_flags", "trace_source"]) {
      assert.equal(columns.has(column), true, `missing migrated column ${column}`);
    }
    const schema = inspect.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='process_jobs'").get().sql;
    assert.equal(/baggage/i.test(schema), false);
    assert.equal(/tracestate/i.test(schema), false);
    inspect.close();

    console.log("smoke_w3c_trace_store_migration ok");
  } finally {
    store?.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
})();

const assert = require("node:assert/strict");
const path = require("node:path");
const { analyzeProcessRunnerLog, detectMarkers } = require("../_workflow/scripts/process_runner_observability.js");

const fixture = path.join(__dirname, "fixtures", "process_runner_audit_fixture.jsonl");

const summary = analyzeProcessRunnerLog({
  log: fixture,
  window: 100,
  slowMs: 120,
});

assert.equal(summary.success, true);
assert.equal(summary.analyzer_version, "process-runner-observability-v1");
assert.equal(summary.mode, "repo-local-script");
assert.equal(summary.log.exists, true);
assert.equal(summary.log.window_checked, 10);
assert.equal(summary.counts.parse_errors, 1);
assert.equal(summary.counts.process_start, 5);
assert.equal(summary.counts.process_finish, 4);
assert.equal(summary.counts.nonzero_exit, 1);
assert.equal(summary.counts.timeout, 1);
assert.equal(summary.counts.spawn_error, 1);
assert.equal(summary.counts.signal_exit, 1);
assert.equal(summary.counts.slow_process, 2);
assert.equal(summary.counts.stderr_truncated, 1);
assert.equal(summary.counts.marker_events, 1);
assert.equal(summary.by_marker.windows_node_uv_handle_closing_assertion, 1);
assert.equal(summary.by_marker.assertion_failed, 1);
assert.equal(summary.by_marker.node_internal_stack, 1);
assert.equal(summary.by_status.ok, 1);
assert.equal(summary.by_status.nonzero_exit, 1);
assert.equal(summary.by_status.timeout, 1);
assert.equal(summary.by_status.spawn_error, 1);
assert.equal(summary.orphan_starts.length, 1);
assert.equal(summary.orphan_starts[0].trace_id, "orphan-1");
assert.equal(summary.orphan_starts[0].command, "npm");
assert.equal(summary.latency_by_command.node.count, 3);
assert.equal(summary.raw_args_included, false);
assert.equal(summary.raw_stdout_included, false);
assert.equal(summary.raw_stderr_included, false);

const ignored = analyzeProcessRunnerLog({ log: fixture, window: 100, slowMs: 120, ignoreTraceIds: ["orphan-1"] });
assert.equal(ignored.orphan_starts.length, 0);
assert.deepEqual(ignored.ignored_trace_ids, ["orphan-1"]);

const markerNames = detectMarkers({ stderr: "Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\\win\\async.c, line 94" });
assert.ok(markerNames.includes("windows_node_uv_handle_closing_assertion"));
assert.ok(markerNames.includes("assertion_failed"));

const serialized = JSON.stringify(summary);
assert.equal(serialized.includes("bad-test.js"), false, "raw args should not be included");
assert.equal(serialized.includes("slow.py"), false, "raw args should not be included");
assert.equal(serialized.includes("Assertion failed:"), false, "raw stderr should not be included");

console.log("smoke_stage8_13_process_runner_observability ok");

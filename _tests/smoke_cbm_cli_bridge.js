"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-tests-cbm-"));
const fixturePath = path.join(tempRoot, "fake_cbm.js");
const counterPath = path.join(tempRoot, "version-count.txt");

fs.writeFileSync(
  fixturePath,
  `"use strict";
const fs = require("node:fs");
const args = process.argv.slice(2);

function bumpCounter() {
  const file = process.env.FAKE_CBM_COUNTER_PATH;
  if (!file) return;
  const current = fs.existsSync(file) ? Number(fs.readFileSync(file, "utf8") || 0) : 0;
  fs.writeFileSync(file, String(current + 1));
}

if (args[0] === "--version") {
  bumpCounter();
  if (process.env.FAKE_CBM_VERSION_MODE === "invalid") {
    process.stdout.write("unexpected-version-output\\n");
  } else if (process.env.FAKE_CBM_VERSION_MODE === "nonzero") {
    process.stderr.write("version failed\\n");
    process.exitCode = 9;
  } else {
    process.stdout.write("codebase-memory-mcp " + (process.env.FAKE_CBM_VERSION || "0.9.0") + "\\n");
  }
  return;
}

if (args[0] === "--help") {
  process.stdout.write("codebase-memory-mcp 0.9.0\\n\\nTools: index_repository, search_graph, query_graph, trace_path,\\n  get_code_snippet, get_graph_schema, get_architecture, search_code,\\n  list_projects, delete_project, index_status, detect_changes,\\n  manage_adr, ingest_traces\\n");
  return;
}

const stdinText = fs.readFileSync(0, "utf8");
const parsedInput = stdinText ? JSON.parse(stdinText) : {};
const mode = process.env.FAKE_CBM_CALL_MODE || "echo";
if (mode === "nonzero") {
  process.stderr.write("fixture nonzero failure\\n");
  process.exitCode = 7;
  return;
}
if (mode === "malformed") {
  process.stdout.write("not-json");
  return;
}
if (mode === "empty") {
  return;
}
if (mode === "large") {
  process.stdout.write("x".repeat(20000));
  return;
}
if (mode === "project_not_found") {
  process.stdout.write(JSON.stringify({ content: [{ type: "text", text: JSON.stringify({ project: "missing", status: "not_found" }) }], isError: true }));
  return;
}
if (mode === "changes_scoped") {
  process.stdout.write(JSON.stringify({ content: [{ type: "text", text: JSON.stringify({ changed_files: ["src/cbm/a.js", "src/other/b.js", "docs/c.md"], impacted_symbols: [{ qualified_name: "demo.a", file_path: "src/cbm/a.js" }, { qualified_name: "demo.b", file_path: "src/other/b.js" }], changed_count: 3, depth: 2 }) }] }));
  return;
}
if (mode === "changes_unresolved") {
  process.stdout.write(JSON.stringify({ content: [{ type: "text", text: JSON.stringify({ changed_files: ["src/a.js", "src/b.js"], impacted_symbols: [], changed_count: 2, depth: 2 }) }] }));
  return;
}
if (mode === "duplicate_changes") {
  process.stdout.write(JSON.stringify({ content: [{ type: "text", text: JSON.stringify({
    changed_files: ["src/A.js", "src/A.js", "src\\\\B.js", "src/B.js"],
    impacted_symbols: [
      { qualified_name: "demo.a", file_path: "src/A.js", label: "Function", depth: 1 },
      { qualified_name: "demo.a", file_path: "src/A.js", label: "Function", depth: 1 },
    ],
    changed_count: 4,
    depth: 2,
  }) }] }));
  return;
}
if (mode === "aggregate_suspect") {
  process.stdout.write(JSON.stringify({ content: [{ type: "text", text: JSON.stringify({ columns: ["labels(n)", "COUNT(*)"], rows: [["200", "200"]], total: 1 }) }] }));
  return;
}
if (mode === "large_detect") {
  const changed_files = Array.from({ length: 350 }, (_, index) => "src/file-" + index + ".js");
  const impacted_symbols = Array.from({ length: 350 }, (_, index) => ({ qualified_name: "demo.symbol." + index, depth: index % 3 }));
  process.stdout.write(JSON.stringify({ content: [{ type: "text", text: JSON.stringify({ changed_files, impacted_symbols, changed_count: changed_files.length, depth: 2 }) }] }));
  return;
}
if (mode === "trace_placeholder") {
  process.stdout.write(JSON.stringify({ content: [{ type: "text", text: JSON.stringify({ status: "accepted", traces_received: 1, note: "Runtime edge creation from traces not yet implemented" }) }] }));
  return;
}
if (mode === "partial") {
  process.stdout.write(JSON.stringify({
    content: [{ type: "text", text: JSON.stringify({ ok: true, skipped: [{ path: "broken.js", reason: "parse failed" }], warnings: ["fixture warning"] }) }],
  }));
  return;
}
if (mode === "tool_error") {
  process.stdout.write(JSON.stringify({
    content: [{ type: "text", text: JSON.stringify({ error: "fixture tool error", hint: "fixture hint" }) }],
    isError: true,
  }));
  return;
}

const sleepMs = Number(process.env.FAKE_CBM_SLEEP_MS || 0);
setTimeout(() => {
  process.stdout.write(JSON.stringify({
    content: [{
      type: "text",
      text: JSON.stringify({
        argv: args,
        ok: true,
        allowed_root: process.env.CBM_ALLOWED_ROOT || "",
        input_keys: Object.keys(parsedInput).sort(),
        input_content_length: String(parsedInput.content || "").length,
        stdin_chars: stdinText.length,
      }),
    }],
  }));
}, sleepMs);
`,
  "utf8"
);

const {
  TOOL_DEFINITIONS,
  callCbmTool,
  defaultExecutablePath,
  getCbmAvailability,
  getCbmRuntimeStatus,
  probeCbmAvailability,
  resetCbmBridgeForTests,
  resolveCbmRepositoryPath,
} = require("../src/integrations/codebase_memory/cbm_cli_bridge");

function fixtureOptions(overrides = {}) {
  return {
    executablePath: process.execPath,
    commandPrefixArgs: [fixturePath],
    env: {
      FAKE_CBM_COUNTER_PATH: counterPath,
      FAKE_CBM_VERSION_MODE: "valid",
      FAKE_CBM_CALL_MODE: "echo",
      ...(overrides.env || {}),
    },
    timeouts: {
      probe: 1000,
      simpleRead: 1000,
      heavyRead: 1000,
      index: 1000,
      hardIndex: 3000,
      ...(overrides.timeouts || {}),
    },
    maxOutputChars: overrides.maxOutputChars || 8192,
    allowedRoot: overrides.allowedRoot || "C:\\Work",
  };
}

(async () => {
  assert.equal(
    defaultExecutablePath({ LOCALAPPDATA: "", USERPROFILE: "" }, "win32"),
    "codebase-memory-mcp.exe"
  );
  assert.doesNotMatch(
    defaultExecutablePath({ LOCALAPPDATA: "", USERPROFILE: "" }, "win32"),
    /Users\\mczyz/i
  );

  resetCbmBridgeForTests();
  const missing = probeCbmAvailability({
    executablePath: path.join(tempRoot, "missing-cbm.exe"),
    timeouts: { probe: 200 },
  });
  assert.equal(missing.available, false);
  assert.equal(missing.executable_exists, false);
  assert.equal(missing.error_code, "executable_missing");

  resetCbmBridgeForTests();
  const invalid = probeCbmAvailability(fixtureOptions({
    env: { FAKE_CBM_VERSION_MODE: "invalid" },
  }));
  assert.equal(invalid.available, false);
  assert.equal(invalid.executable_exists, true);
  assert.equal(invalid.version_probe_ok, false);
  assert.equal(invalid.error_code, "invalid_version_output");

  resetCbmBridgeForTests();
  if (fs.existsSync(counterPath)) fs.unlinkSync(counterPath);
  const valid = getCbmAvailability(fixtureOptions());
  const cached = getCbmAvailability(fixtureOptions());
  assert.equal(valid.available, true);
  assert.equal(valid.version, "0.9.0");
  assert.equal(cached, valid);
  assert.equal(Number(fs.readFileSync(counterPath, "utf8")), 1);
  assert.equal(valid.compatibility_status, "compatible_binary_variant");
  assert.equal(valid.manifest_version, "0.9.0");
  assert.equal(valid.native_tool_count, 14);
  assert.equal(valid.executable_sha256.length, 64);

  resetCbmBridgeForTests();
  let identityGeneration = 1;
  let probeCalls = 0;
  const identityOptions = {
    executablePath: fixturePath,
    identityReader() {
      return {
        path: fixturePath,
        size: 100 + identityGeneration,
        mtime_ms: identityGeneration,
        sha256: "9a205fa5ae759fbc866bfe1554f0c05a303be9ae6e0a00f94d875dc0c25e0680",
      };
    },
    spawnSyncImpl(_executable, args) {
      probeCalls += 1;
      if (args.at(-1) === "--version") {
        return { status: 0, stdout: "codebase-memory-mcp 0.9.0\n", stderr: "" };
      }
      if (args.at(-1) === "--help") {
        return {
          status: 0,
          stdout: "codebase-memory-mcp 0.9.0\n\nTools: index_repository, search_graph, query_graph, trace_path,\n  get_code_snippet, get_graph_schema, get_architecture, search_code,\n  list_projects, delete_project, index_status, detect_changes,\n  manage_adr, ingest_traces\n",
          stderr: "",
        };
      }
      throw new Error("unexpected probe args: " + args.join(" "));
    },
    timeouts: { probe: 1000 },
  };
  const identityFirst = getCbmAvailability(identityOptions);
  const identityCached = getCbmAvailability(identityOptions);
  assert.equal(identityFirst, identityCached);
  assert.equal(identityFirst.compatibility_status, "compatible");
  assert.equal(probeCalls, 2);
  identityGeneration = 2;
  const identityChanged = getCbmAvailability(identityOptions);
  assert.notEqual(identityChanged, identityFirst);
  assert.equal(identityChanged.binary_changed_since_probe, true);
  assert.equal(probeCalls, 4);

  assert.deepEqual(Object.keys(TOOL_DEFINITIONS), [
    "list_projects",
    "index_repository",
    "get_architecture",
    "search_graph",
    "query_graph",
    "trace_path",
    "get_code_snippet",
    "get_graph_schema",
    "search_code",
    "delete_project",
    "index_status",
    "detect_changes",
    "manage_adr",
    "ingest_traces",
  ]);
  for (const operation of Object.keys(TOOL_DEFINITIONS)) {
    const result = await callCbmTool(operation, { project: "demo" }, fixtureOptions());
    assert.equal(result.success, true, operation);
    assert.equal(result.result.argv[2], operation);
  }
  const unsupported = await callCbmTool("arbitrary_native_tool", {}, fixtureOptions());
  assert.equal(unsupported.success, false);
  assert.equal(unsupported.error_code, "unsupported_tool");
  assert.match(unsupported.error, /Unsupported CBM tool/);

  const echo = await callCbmTool("list_projects", {}, fixtureOptions());
  assert.equal(echo.success, true);
  assert.deepEqual(echo.result.argv, ["cli", "--json", "list_projects"]);
  assert.deepEqual(echo.result.input_keys, []);
  assert.equal(echo.result.stdin_chars, 2);
  assert.equal(echo.result.ok, true);
  assert.equal(echo.stdout_truncated, false);
  assert.equal(echo.stderr_truncated, false);
  assert.equal(echo.result.allowed_root, path.resolve("C:\\Work"));
  assert.equal(echo.queue_wait_ms, 0);
  assert.ok(echo.execution_ms >= 0);
  assert.equal(echo.binary_version, "0.9.0");
  assert.equal(echo.compatibility_status, "compatible_binary_variant");
  assert.equal(echo.partial_success, false);
  assert.deepEqual(echo.warnings, []);

  const largeContent = "x".repeat(120000);
  const largePayload = await callCbmTool("manage_adr", {
    project: "demo",
    mode: "update",
    content: largeContent,
  }, fixtureOptions({ maxOutputChars: 200000 }));
  assert.equal(largePayload.success, true);
  assert.deepEqual(largePayload.result.argv, ["cli", "--json", "manage_adr"]);
  assert.deepEqual(largePayload.result.input_keys, ["content", "mode", "project"]);
  assert.equal(largePayload.result.input_content_length, largeContent.length);
  assert.ok(largePayload.result.stdin_chars > largeContent.length);
  assert.equal(largePayload.result.argv.some((arg) => arg.includes(largeContent.slice(0, 100))), false);

  const partial = await callCbmTool("index_repository", { repo_path: "C:\\Work\\demo" }, fixtureOptions({
    env: { FAKE_CBM_CALL_MODE: "partial" },
  }));
  assert.equal(partial.success, true);
  assert.equal(partial.partial_success, true);
  assert.equal(partial.warnings.length, 2);
  assert.match(partial.warnings.join(" "), /fixture warning/);
  assert.match(partial.warnings.join(" "), /broken.js/);

  const heavyOptions = fixtureOptions({
    env: { FAKE_CBM_SLEEP_MS: "140" },
    timeouts: { heavyRead: 1000 },
  });
  const heavyResults = await Promise.all([
    callCbmTool("search_graph", { project: "demo", query: "one" }, heavyOptions),
    callCbmTool("query_graph", { project: "demo", query: "MATCH (n) RETURN n" }, heavyOptions),
    callCbmTool("trace_path", { project: "demo", function_name: "run" }, heavyOptions),
  ]);
  assert.equal(heavyResults.every((item) => item.success), true);
  const queueWaits = heavyResults.map((item) => item.queue_wait_ms).sort((a, b) => a - b);
  assert.deepEqual(queueWaits.slice(0, 2), [0, 0]);
  assert.ok(queueWaits[2] >= 80, `expected queued heavy read, got ${queueWaits[2]}ms`);

  const boundedChanges = await callCbmTool("detect_changes", { project: "demo", depth: 2 }, fixtureOptions({
    env: { FAKE_CBM_CALL_MODE: "large_detect" },
    maxOutputChars: 8192,
  }));
  assert.equal(boundedChanges.success, true);
  assert.equal(boundedChanges.partial_success, true);
  assert.equal(boundedChanges.result.changed_files.length, 200);
  assert.equal(boundedChanges.result.impacted_symbols.length, 200);
  assert.equal(boundedChanges.result.changed_files_total, 350);
  assert.equal(boundedChanges.result.impacted_symbols_total, 350);
  assert.equal(boundedChanges.result.changed_files_truncated, true);
  assert.equal(boundedChanges.result.impacted_symbols_truncated, true);
  assert.match(boundedChanges.warnings.join(" "), /bounded/i);

  const tracePlaceholder = await callCbmTool("ingest_traces", { project: "demo", traces: [{ trace_id: "t", span_id: "s", name: "run", start_time_unix_nano: "1", end_time_unix_nano: "2" }] }, fixtureOptions({
    env: { FAKE_CBM_CALL_MODE: "trace_placeholder" },
  }));
  assert.equal(tracePlaceholder.success, true);
  assert.equal(tracePlaceholder.partial_success, true);
  assert.match(tracePlaceholder.warnings.join(" "), /not implemented/i);

  const unresolvedChanges = await callCbmTool("detect_changes", { project: "demo", depth: 2 }, fixtureOptions({ env: { FAKE_CBM_CALL_MODE: "changes_unresolved" } }));
  assert.equal(unresolvedChanges.success, true);
  assert.equal(unresolvedChanges.partial_success, true);
  assert.equal(unresolvedChanges.result.impact_resolution, "unknown_or_unresolved");
  assert.match(unresolvedChanges.warnings.join(" "), /impact.*unresolved/i);

  const scopedChanges = await callCbmTool("detect_changes", { project: "demo", scope: "src/cbm", depth: 2 }, fixtureOptions({ env: { FAKE_CBM_CALL_MODE: "changes_scoped" } }));
  assert.equal(scopedChanges.success, true);
  assert.deepEqual(scopedChanges.result.changed_files, ["src/cbm/a.js"]);
  assert.deepEqual(scopedChanges.result.impacted_symbols.map((item) => item.qualified_name), ["demo.a"]);
  assert.equal(scopedChanges.result.native_changed_files_total, 3);
  assert.equal(scopedChanges.result.native_impacted_symbols_total, 2);
  assert.equal(scopedChanges.result.changed_count, 1);
  assert.equal(scopedChanges.result.scope_applied_by_bridge, true);
  assert.equal(scopedChanges.result.scope, "src/cbm");

  const duplicateChanges = await callCbmTool("detect_changes", { project: "demo", depth: 2 }, fixtureOptions({ env: { FAKE_CBM_CALL_MODE: "duplicate_changes" } }));
  assert.equal(duplicateChanges.success, true);
  assert.deepEqual(duplicateChanges.result.changed_files, ["src/A.js", "src/B.js"]);
  assert.deepEqual(duplicateChanges.result.impacted_symbols.map((item) => item.qualified_name), ["demo.a"]);
  assert.equal(duplicateChanges.result.changed_files_total, 2);
  assert.equal(duplicateChanges.result.native_changed_files_total, 4);
  assert.equal(duplicateChanges.result.impacted_symbols_total, 1);
  assert.equal(duplicateChanges.result.native_impacted_symbols_total, 2);
  assert.equal(duplicateChanges.result.changed_count, 2);
  assert.match(duplicateChanges.warnings.join(" "), /duplicate/i);

  const suspectAggregate = await callCbmTool("query_graph", { project: "demo", query: "MATCH (n) RETURN labels(n), count(*)" }, fixtureOptions({ env: { FAKE_CBM_CALL_MODE: "aggregate_suspect" } }));
  assert.equal(suspectAggregate.success, true);
  assert.equal(suspectAggregate.partial_success, true);
  assert.match(suspectAggregate.warnings.join(" "), /labels.*aggregation/i);

  const missingProject = await callCbmTool("delete_project", { project: "missing" }, fixtureOptions({ env: { FAKE_CBM_CALL_MODE: "project_not_found" } }));
  assert.equal(missingProject.success, false);
  assert.equal(missingProject.error_code, "cbm_project_not_found");
  assert.match(missingProject.error, /not found/i);

  const toolError = await callCbmTool("get_architecture", { project: "demo" }, fixtureOptions({
    env: { FAKE_CBM_CALL_MODE: "tool_error" },
  }));
  assert.equal(toolError.success, false);
  assert.equal(toolError.error_code, "cbm_native_rejected");
  assert.equal(toolError.error, "fixture tool error");
  assert.equal(toolError.result.hint, "fixture hint");

  const nonzero = await callCbmTool("search_graph", { project: "demo" }, fixtureOptions({
    env: { FAKE_CBM_CALL_MODE: "nonzero" },
  }));
  assert.equal(nonzero.success, false);
  assert.equal(nonzero.error_code, "cbm_native_rejected");
  assert.equal(nonzero.exit_code, 7);
  assert.match(nonzero.diagnostic, /fixture nonzero failure/);

  const malformed = await callCbmTool("list_projects", {}, fixtureOptions({
    env: { FAKE_CBM_CALL_MODE: "malformed" },
  }));
  assert.equal(malformed.success, false);
  assert.equal(malformed.error_code, "cbm_invalid_output");
  assert.match(malformed.diagnostic, /not-json/);

  const empty = await callCbmTool("list_projects", {}, fixtureOptions({
    env: { FAKE_CBM_CALL_MODE: "empty" },
  }));
  assert.equal(empty.success, false);
  assert.equal(empty.error_code, "cbm_invalid_output");

  const timeout = await callCbmTool("list_projects", {}, fixtureOptions({
    env: { FAKE_CBM_SLEEP_MS: "500" },
    timeouts: { simpleRead: 80 },
  }));
  assert.equal(timeout.success, false);
  assert.equal(timeout.error_code, "cbm_timeout");
  assert.equal(timeout.timed_out, true);

  const truncated = await callCbmTool("list_projects", {}, fixtureOptions({
    env: { FAKE_CBM_CALL_MODE: "large" },
    maxOutputChars: 1024,
  }));
  assert.equal(truncated.success, false);
  assert.equal(truncated.error_code, "cbm_output_limit");
  assert.equal(truncated.stdout_truncated, true);
  assert.ok(truncated.diagnostic.length <= 2048);

  assert.throws(
    () => resolveCbmRepositoryPath("../", fixtureOptions()),
    /Access denied/
  );
  const repoPath = resolveCbmRepositoryPath("mcp-tests", fixtureOptions());
  assert.equal(repoPath.displayPath, "mcp-tests");
  assert.equal(repoPath.absolutePath, path.resolve("C:\\Work\\mcp-tests"));

  resetCbmBridgeForTests();
  getCbmAvailability(fixtureOptions());
  const firstIndex = callCbmTool("index_repository", { repo_path: repoPath.absolutePath }, fixtureOptions({
    env: { FAKE_CBM_SLEEP_MS: "250" },
    timeouts: { index: 1000 },
  }));
  await new Promise((resolve) => setTimeout(resolve, 30));

  const statusDuringIndex = getCbmRuntimeStatus(fixtureOptions());
  assert.equal(statusDuringIndex.index_busy, true);
  assert.equal(statusDuringIndex.mutation_busy, true);
  assert.equal(statusDuringIndex.active_mutation_tool, "index_repository");

  for (const mutation of ["index_repository", "delete_project", "manage_adr", "ingest_traces"]) {
    const blocked = await callCbmTool(mutation, { project: "demo" }, fixtureOptions());
    assert.equal(blocked.success, false, mutation);
    assert.equal(blocked.error_code, "mutation_busy", mutation);
  }

  const readDuringIndex = await callCbmTool("index_status", { project: "demo" }, fixtureOptions());
  assert.equal(readDuringIndex.success, true);

  const firstIndexResult = await firstIndex;
  assert.equal(firstIndexResult.success, true);
  const idleStatus = getCbmRuntimeStatus(fixtureOptions());
  assert.equal(idleStatus.index_busy, false);
  assert.equal(idleStatus.mutation_busy, false);
  assert.equal(idleStatus.active_mutation_tool, "");

  const afterIndex = await callCbmTool("index_repository", { repo_path: repoPath.absolutePath }, fixtureOptions());
  assert.equal(afterIndex.success, true);

  const status = getCbmRuntimeStatus(fixtureOptions());
  assert.equal(status.enabled, true);
  assert.equal(status.available, true);
  assert.equal(status.executable_path, process.execPath);
  assert.equal(status.watcher_mode, "not_managed_by_bridge");
  assert.equal(status.timeouts_ms.index, 1000);
  assert.equal(status.timeouts_ms.hard_index, 3000);

  console.log("smoke_cbm_cli_bridge ok");
})()
  .finally(() => fs.rmSync(tempRoot, { recursive: true, force: true }))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

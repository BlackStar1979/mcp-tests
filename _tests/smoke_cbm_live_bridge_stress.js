"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { createCbmTools } = require("../src/integrations/codebase_memory/cbm_tools");

const REPO_ROOT = path.resolve(__dirname, "..");
const TEMP_PARENT = path.join(REPO_ROOT, ".temp", "cbm-live-stress");
const RUN_ID = `${process.pid}-${Date.now()}`;
const FIXTURE_DIR_NAME = `fixture-zazolc-${RUN_ID}`;
const FIXTURE_ROOT = path.join(TEMP_PARENT, FIXTURE_DIR_NAME);
const PROJECT_NAME = `mcp-tests-cbm-live-stress-${RUN_ID}`;

function toolByName(name) {
  const tool = createCbmTools().find((candidate) => candidate.name === name);
  assert.ok(tool, `missing CBM tool ${name}`);
  return tool;
}

function assertBridgeSuccess(envelope, toolName) {
  assert.equal(envelope.success, true, `${toolName}: ${envelope.error || envelope.error_code}`);
  assert.equal(envelope.binary_version, "0.9.0", toolName);
  assert.equal(envelope.compatibility_status.startsWith("compatible"), true, toolName);
  assert.equal(envelope.timed_out, false, toolName);
  assert.equal(envelope.stdout_truncated, false, toolName);
  assert.equal(envelope.stderr_truncated, false, toolName);
  assert.ok(envelope.duration_ms >= 0, toolName);
  assert.ok(envelope.execution_ms >= 0, toolName);
  assert.ok(envelope.queue_wait_ms >= 0, toolName);
}

function writeFixture() {
  fs.mkdirSync(path.join(FIXTURE_ROOT, "src"), { recursive: true });
  fs.writeFileSync(path.join(FIXTURE_ROOT, "package.json"), JSON.stringify({
    name: "cbm-live-stress-fixture",
    version: "1.0.0",
    type: "commonjs",
  }, null, 2));
  fs.writeFileSync(
    path.join(FIXTURE_ROOT, "src", "unicode_service.js"),
    `"use strict";

function formatMessage(name) {
  return "Zażółć greeting: " + name;
}

function greetUnicode(name) {
  return formatMessage(name).toUpperCase();
}

module.exports = { formatMessage, greetUnicode };
`,
    "utf8"
  );
  fs.writeFileSync(
    path.join(FIXTURE_ROOT, "src", "index.js"),
    `"use strict";

const { greetUnicode } = require("./unicode_service");

function main() {
  return greetUnicode("operator");
}

module.exports = { main };
`,
    "utf8"
  );
}

(async () => {
  const statusTool = toolByName("cbm_status");
  const status = await statusTool.execute({});
  if (!status.available) {
    console.log(`smoke_cbm_live_bridge_stress skipped: ${status.error_code || "cbm_unavailable"}`);
    return;
  }
  assert.equal(status.version, "0.9.0");
  assert.equal(status.compatibility_accepted, true);
  assert.equal(status.native_tool_count, 14);
  assert.equal(path.resolve(status.allowed_root), path.resolve("C:\\Work"));

  writeFixture();
  const relativeFixturePath = path.relative(path.resolve("C:\\Work"), FIXTURE_ROOT).replaceAll("\\", "/");
  const indexTool = toolByName("cbm_index_repository");
  const listTool = toolByName("cbm_list_projects");
  const indexStatusTool = toolByName("cbm_index_status");
  const searchGraphTool = toolByName("cbm_search_graph");
  const searchCodeTool = toolByName("cbm_search_code");
  const queryGraphTool = toolByName("cbm_query_graph");
  const architectureTool = toolByName("cbm_get_architecture");
  const snippetTool = toolByName("cbm_get_code_snippet");
  const traceTool = toolByName("cbm_trace_path");
  const detectChangesTool = toolByName("cbm_detect_changes");
  const ingestTracesTool = toolByName("cbm_ingest_traces");
  const deleteTool = toolByName("cbm_delete_project");

  try {
    const indexed = await indexTool.execute({
      path: relativeFixturePath,
      name: PROJECT_NAME,
      mode: "full",
      persistence: false,
    });
    assertBridgeSuccess(indexed, "cbm_index_repository");
    assert.equal(indexed.cbm_tool, "index_repository");

    const listed = await listTool.execute({});
    assertBridgeSuccess(listed, "cbm_list_projects");
    const projects = Array.isArray(listed.result?.projects) ? listed.result.projects : [];
    assert.ok(projects.some((project) => project.name === PROJECT_NAME), "test index missing from list_projects");

    const projectStatus = await indexStatusTool.execute({ project_name: PROJECT_NAME });
    assertBridgeSuccess(projectStatus, "cbm_index_status");
    assert.equal(projectStatus.result.project, PROJECT_NAME);
    assert.equal(projectStatus.result.status, "ready");
    assert.ok(projectStatus.result.nodes > 0);
    assert.ok(projectStatus.result.edges > 0);

    const conflict = await searchGraphTool.execute({
      project: PROJECT_NAME,
      project_name: `${PROJECT_NAME}-other`,
      query: "greetUnicode",
    });
    assert.equal(conflict.success, false);
    assert.equal(conflict.error_code, "invalid_project_alias");

    const [graph, code, query, architecture] = await Promise.all([
      searchGraphTool.execute({ project_name: PROJECT_NAME, query: "greetUnicode", limit: 10 }),
      searchCodeTool.execute({ project_name: PROJECT_NAME, pattern: "greetUnicode", mode: "full", limit: 10 }),
      queryGraphTool.execute({ project_name: PROJECT_NAME, query: "MATCH (n) RETURN n LIMIT 5", max_rows: 5 }),
      architectureTool.execute({ project_name: PROJECT_NAME, aspects: ["overview", "languages", "entry_points"] }),
    ]);
    for (const [toolName, envelope] of [
      ["cbm_search_graph", graph],
      ["cbm_search_code", code],
      ["cbm_query_graph", query],
      ["cbm_get_architecture", architecture],
    ]) assertBridgeSuccess(envelope, toolName);

    const graphResults = Array.isArray(graph.result?.results) ? graph.result.results : [];
    const greetNode = graphResults.find((item) => item.name === "greetUnicode");
    assert.ok(greetNode?.qualified_name, "greetUnicode qualified_name missing");
    assert.match(greetNode.file_path.replaceAll("\\", "/"), /src\/unicode_service\.js$/);
    assert.match(JSON.stringify(code.result), /greetUnicode/);
    assert.ok(Array.isArray(query.result?.rows) || Array.isArray(query.result?.results) || query.result?.total !== undefined);

    const snippet = await snippetTool.execute({
      project_name: PROJECT_NAME,
      qualified_name: greetNode.qualified_name,
      include_neighbors: true,
    });
    assertBridgeSuccess(snippet, "cbm_get_code_snippet");
    assert.match(snippet.result.source || snippet.result.code || JSON.stringify(snippet.result), /formatMessage/);

    const trace = await traceTool.execute({
      project_name: PROJECT_NAME,
      function_name: greetNode.qualified_name,
      direction: "outbound",
      depth: 2,
      include_tests: false,
    });
    assertBridgeSuccess(trace, "cbm_trace_path");
    assert.equal(trace.partial_success, false);

    const changes = await detectChangesTool.execute({
      project_name: PROJECT_NAME,
      scope: "src",
      depth: 2,
    });
    assertBridgeSuccess(changes, "cbm_detect_changes");
    assert.equal(changes.result.connector_item_limit, 200);
    assert.equal(typeof changes.result.native_changed_files_total, "number");
    assert.equal(typeof changes.result.normalized_changed_files_total, "number");
    assert.equal(typeof changes.result.changed_files_returned, "number");
    assert.equal(typeof changes.result.changed_files_omitted, "number");
    assert.ok(["not_applicable", "resolved", "unknown_or_unresolved"].includes(changes.result.impact_resolution));
    assert.equal(typeof changes.result.impact_resolution_reason, "string");
    assert.equal(changes.result.bridge_analysis.item_limit, 200);
    assert.equal(changes.result.bridge_analysis.impact_resolution, changes.result.impact_resolution);
    assert.equal(changes.result.bridge_analysis.impact_resolution_reason, changes.result.impact_resolution_reason);

    const ingested = await ingestTracesTool.execute({
      project_name: PROJECT_NAME,
      traces: [{
        trace_id: `trace-${RUN_ID}`,
        span_id: `span-${RUN_ID}`,
        name: "cbm-live-stress-probe",
        start_time_unix_nano: "1",
        end_time_unix_nano: "2",
      }],
    });
    assertBridgeSuccess(ingested, "cbm_ingest_traces");
    assert.equal(ingested.partial_success, true);
    assert.equal(ingested.result.trace_ingestion_status, "accepted");
    assert.equal(ingested.result.traces_received, 1);
    assert.equal(ingested.result.runtime_edges_created, 0);
    assert.equal(ingested.result.runtime_edge_creation, "not_implemented");
    assert.equal(ingested.result.runtime_edge_creation_supported, false);
    assert.match(ingested.warnings.join(" "), /not implemented/i);

    const finalStatus = await statusTool.execute({});
    assert.equal(finalStatus.mutation_busy, false);
    assert.equal(finalStatus.heavy_read_active, 0);
    assert.equal(finalStatus.heavy_read_queued, 0);

    console.log("smoke_cbm_live_bridge_stress ok");
  } finally {
    try {
      await deleteTool.execute({ project: PROJECT_NAME });
    } catch {
      // Cleanup is best-effort; the fixture project name is unique and source files are removed below.
    }
    fs.rmSync(FIXTURE_ROOT, { recursive: true, force: true });
    try {
      if (fs.existsSync(TEMP_PARENT) && fs.readdirSync(TEMP_PARENT).length === 0) {
        fs.rmSync(TEMP_PARENT, { recursive: true, force: true });
      }
    } catch {
      // Ignore final scratch-directory cleanup races on Windows.
    }
  }
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});

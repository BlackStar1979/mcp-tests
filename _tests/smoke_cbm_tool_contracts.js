"use strict";

const assert = require("node:assert/strict");

const schemas = require("../src/schemas/codebase_memory_tools");
const { createCbmTools } = require("../src/integrations/codebase_memory/cbm_tools");

const EXPECTED_CBM_TOOLS = Object.freeze([
  "cbm_status",
  "cbm_list_projects",
  "cbm_index_repository",
  "cbm_get_architecture",
  "cbm_search_graph",
  "cbm_query_graph",
  "cbm_trace_path",
  "cbm_get_code_snippet",
  "cbm_get_graph_schema",
  "cbm_search_code",
  "cbm_delete_project",
  "cbm_index_status",
  "cbm_detect_changes",
  "cbm_manage_adr",
  "cbm_ingest_traces",
]);

const EXPECTED_SCHEMA_BY_TOOL = Object.freeze({
  cbm_status: "CBM_STATUS_INPUT_SCHEMA",
  cbm_list_projects: "CBM_LIST_PROJECTS_INPUT_SCHEMA",
  cbm_index_repository: "CBM_INDEX_REPOSITORY_INPUT_SCHEMA",
  cbm_get_architecture: "CBM_GET_ARCHITECTURE_INPUT_SCHEMA",
  cbm_search_graph: "CBM_SEARCH_GRAPH_INPUT_SCHEMA",
  cbm_query_graph: "CBM_QUERY_GRAPH_INPUT_SCHEMA",
  cbm_trace_path: "CBM_TRACE_PATH_INPUT_SCHEMA",
  cbm_get_code_snippet: "CBM_GET_CODE_SNIPPET_INPUT_SCHEMA",
  cbm_get_graph_schema: "CBM_GET_GRAPH_SCHEMA_INPUT_SCHEMA",
  cbm_search_code: "CBM_SEARCH_CODE_INPUT_SCHEMA",
  cbm_delete_project: "CBM_DELETE_PROJECT_INPUT_SCHEMA",
  cbm_index_status: "CBM_INDEX_STATUS_INPUT_SCHEMA",
  cbm_detect_changes: "CBM_DETECT_CHANGES_INPUT_SCHEMA",
  cbm_manage_adr: "CBM_MANAGE_ADR_INPUT_SCHEMA",
  cbm_ingest_traces: "CBM_INGEST_TRACES_INPUT_SCHEMA",
});

function bridgeResult(toolName, args) {
  return {
    success: true,
    error_code: "",
    error: "",
    cbm_tool: toolName,
    duration_ms: 1,
    queue_wait_ms: 0,
    execution_ms: 1,
    binary_version: "0.9.0",
    compatibility_status: "compatible",
    partial_success: false,
    warnings: [],
    timed_out: false,
    exit_code: 0,
    signal: null,
    stdout_truncated: false,
    stderr_truncated: false,
    diagnostic: "",
    result: { toolName, args },
  };
}

(async () => {
  const calls = [];
  const fakeBridge = {
    getCbmRuntimeStatus() {
      calls.push({ op: "status" });
      return {
        enabled: true,
        available: true,
        executable_path: "C:\\fake\\cbm.exe",
        executable_exists: true,
        executable_regular_file: true,
        executable_size: 273333760,
        executable_mtime_ms: 1783505060000,
        executable_sha256: "9a205fa5ae759fbc866bfe1554f0c05a303be9ae6e0a00f94d875dc0c25e0680",
        version_probe_ok: true,
        version: "0.9.0",
        manifest_version: "0.9.0",
        compatibility_status: "compatible",
        compatibility_accepted: true,
        native_tool_count: 14,
        native_tools: ["index_repository", "search_graph", "query_graph", "trace_path", "get_code_snippet", "get_graph_schema", "get_architecture", "search_code", "list_projects", "delete_project", "index_status", "detect_changes", "manage_adr", "ingest_traces"],
        binary_changed_since_probe: false,
        allowed_root: "C:\\Work",
        error_code: "",
        error: "",
        watcher_mode: "not_managed_by_bridge",
        freshness_note: "fixture",
        timeouts_ms: {
          probe: 5000,
          simple_read: 30000,
          heavy_read: 60000,
          index: 600000,
          hard_index: 1800000,
        },
        index_busy: false,
        mutation_busy: false,
        active_mutation_tool: "",
        heavy_read_capacity: 2,
        heavy_read_active: 0,
        heavy_read_queued: 0,
      };
    },
    resolveCbmRepositoryPath(logicalPath) {
      calls.push({ op: "resolve", logicalPath });
      if (logicalPath === "escape") throw new Error("Access denied");
      return { absolutePath: "C:\\Work\\mcp-tests", displayPath: logicalPath, rootAlias: "work" };
    },
    async callCbmTool(toolName, args) {
      calls.push({ op: "call", toolName, args });
      return bridgeResult(toolName, args);
    },
  };

  const tools = createCbmTools(fakeBridge);
  const names = tools.map((tool) => tool.name);
  assert.deepEqual(names, EXPECTED_CBM_TOOLS);

  const byName = new Map(tools.map((tool) => [tool.name, tool]));
  for (const name of EXPECTED_CBM_TOOLS) {
    const tool = byName.get(name);
    assert.ok(tool, `missing tool ${name}`);
    assert.equal(tool.descriptor.name, name);
    assert.equal(typeof tool.execute, "function");
    assert.equal(typeof tool.summarizeArgs, "function");
    assert.equal(typeof tool.resultStats, "function");
    assert.equal(tool.descriptor.inputSchema.additionalProperties, false);
    assert.equal(Object.hasOwn(tool.descriptor.inputSchema.properties, "executable_path"), false);
    assert.equal(Object.hasOwn(tool.descriptor.inputSchema.properties, "timeout_ms"), false);
    assert.deepEqual(tool.descriptor.inputSchema, schemas[EXPECTED_SCHEMA_BY_TOOL[name]]);
    assert.deepEqual(
      tool.descriptor.outputSchema,
      name === "cbm_status" ? schemas.CBM_STATUS_OUTPUT_SCHEMA : schemas.CBM_BRIDGE_OUTPUT_SCHEMA
    );
  }

  assert.match(byName.get("cbm_status").descriptor.description, /profile-managed exposure/i);
  assert.match(byName.get("cbm_status").descriptor.description, /v0\.9\.0 compatibility/i);
  assert.match(byName.get("cbm_index_repository").descriptor.description, /partial/i);
  assert.match(byName.get("cbm_delete_project").descriptor.description, /confirmation/i);
  assert.match(byName.get("cbm_delete_project").descriptor.description, /state_handle/i);
  assert.match(byName.get("cbm_index_repository").descriptor.description, /ADR.*restored/i);
  assert.match(byName.get("cbm_query_graph").descriptor.description, /labels\(\).*warning/i);
  assert.match(byName.get("cbm_detect_changes").descriptor.description, /caps returned files and symbols/i);
  assert.match(byName.get("cbm_ingest_traces").descriptor.description, /strictly validated/i);
  assert.deepEqual(byName.get("cbm_status").descriptor.annotations, schemas.READ_ONLY_CBM_ANNOTATIONS);

  const readOnlyNames = [
    "cbm_list_projects",
    "cbm_get_architecture",
    "cbm_search_graph",
    "cbm_query_graph",
    "cbm_trace_path",
    "cbm_get_code_snippet",
    "cbm_get_graph_schema",
    "cbm_search_code",
    "cbm_index_status",
    "cbm_detect_changes",
  ];
  for (const name of readOnlyNames) {
    assert.deepEqual(byName.get(name).descriptor.annotations, schemas.READ_ONLY_CBM_ANNOTATIONS);
  }
  assert.deepEqual(byName.get("cbm_index_repository").descriptor.annotations, schemas.INDEXING_CBM_ANNOTATIONS);
  assert.deepEqual(byName.get("cbm_manage_adr").descriptor.annotations, schemas.MUTATING_CBM_ANNOTATIONS);
  assert.deepEqual(byName.get("cbm_ingest_traces").descriptor.annotations, schemas.MUTATING_CBM_ANNOTATIONS);
  const traceItemSchema = schemas.CBM_INGEST_TRACES_INPUT_SCHEMA.properties.traces.items;
  assert.deepEqual(traceItemSchema.required, ["trace_id", "span_id", "name", "start_time_unix_nano", "end_time_unix_nano"]);
  assert.equal(traceItemSchema.additionalProperties, false);
  assert.equal(traceItemSchema.properties.attributes.additionalProperties, true);
  assert.deepEqual(byName.get("cbm_delete_project").descriptor.annotations, schemas.DESTRUCTIVE_CBM_ANNOTATIONS);
  await byName.get("cbm_delete_project").execute({
    project: "fixture-project",
    confirm: true,
    state_handle: "x".repeat(32),
  });
  const deleteCall = calls.filter((item) => item.op === "call" && item.toolName === "delete_project").at(-1);
  assert.deepEqual(deleteCall.args, { project: "fixture-project" });

  assert.notEqual(byName.get("cbm_status"), byName.get("cbm_index_status"));
  assert.deepEqual(byName.get("cbm_status").descriptor.inputSchema.required, []);
  assert.deepEqual(byName.get("cbm_index_status").descriptor.inputSchema.required, []);
  assert.deepEqual(byName.get("cbm_index_status").descriptor.inputSchema.anyOf, [
    { required: ["project"] },
    { required: ["project_name"] },
  ]);
  assert.equal(Object.hasOwn(byName.get("cbm_index_status").descriptor.inputSchema.properties, "project"), true);
  assert.equal(Object.hasOwn(byName.get("cbm_index_status").descriptor.inputSchema.properties, "project_name"), true);

  const status = await byName.get("cbm_status").execute({});
  assert.equal(status.available, true);
  assert.equal(status.mutation_busy, false);
  assert.equal(status.version, "0.9.0");
  assert.equal(status.compatibility_status, "compatible");
  assert.equal(status.native_tool_count, 14);
  assert.equal(status.allowed_root, "C:\\Work");
  assert.equal(status.heavy_read_capacity, 2);
  assert.equal(status.heavy_read_active, 0);
  assert.equal(status.heavy_read_queued, 0);
  for (const field of ["queue_wait_ms", "execution_ms", "binary_version", "compatibility_status", "partial_success", "warnings"]) {
    assert.equal(schemas.CBM_BRIDGE_OUTPUT_SCHEMA.required.includes(field), true, field);
  }
  for (const field of ["executable_sha256", "manifest_version", "compatibility_status", "native_tools", "allowed_root", "heavy_read_capacity", "heavy_read_active", "heavy_read_queued"]) {
    assert.equal(schemas.CBM_STATUS_OUTPUT_SCHEMA.required.includes(field), true, field);
  }

  const cases = [
    ["cbm_list_projects", {}, "list_projects", {}],
    [
      "cbm_get_architecture",
      { project: "demo", path: "src", aspects: ["languages", "clusters"] },
      "get_architecture",
      { project: "demo", path: "src", aspects: ["languages", "clusters"] },
    ],
    [
      "cbm_search_graph",
      {
        project: "demo",
        query: "invoice service",
        name_pattern: ".*Handler.*",
        qn_pattern: "demo.*",
        label: "Function",
        file_pattern: "src/.*",
        relationship: "CALLS",
        min_degree: 1,
        max_degree: 10,
        exclude_entry_points: true,
        include_connected: true,
        semantic_query: ["invoice", "tax"],
        limit: 25,
        offset: 5,
      },
      "search_graph",
      {
        project: "demo",
        query: "invoice service",
        name_pattern: ".*Handler.*",
        qn_pattern: "demo.*",
        label: "Function",
        file_pattern: "src/.*",
        relationship: "CALLS",
        min_degree: 1,
        max_degree: 10,
        exclude_entry_points: true,
        include_connected: true,
        semantic_query: ["invoice", "tax"],
        limit: 25,
        offset: 5,
      },
    ],
    [
      "cbm_query_graph",
      { project: "demo", query: "MATCH (n) RETURN n LIMIT 5", max_rows: 5 },
      "query_graph",
      { project: "demo", query: "MATCH (n) RETURN n LIMIT 5", max_rows: 5 },
    ],
    [
      "cbm_trace_path",
      {
        project: "demo",
        function_name: "buildInvoice",
        direction: "both",
        depth: 4,
        mode: "data_flow",
        parameter_name: "amount",
        edge_types: ["CALLS", "DATA_FLOWS"],
        risk_labels: true,
        include_tests: true,
      },
      "trace_path",
      {
        project: "demo",
        function_name: "buildInvoice",
        direction: "both",
        depth: 4,
        mode: "data_flow",
        parameter_name: "amount",
        edge_types: ["CALLS", "DATA_FLOWS"],
        risk_labels: true,
        include_tests: true,
      },
    ],
    [
      "cbm_get_code_snippet",
      { project: "demo", qualified_name: "demo.src.service.buildInvoice", include_neighbors: true },
      "get_code_snippet",
      { project: "demo", qualified_name: "demo.src.service.buildInvoice", include_neighbors: true },
    ],
    ["cbm_get_graph_schema", { project: "demo" }, "get_graph_schema", { project: "demo" }],
    [
      "cbm_search_code",
      {
        project: "demo",
        pattern: "buildInvoice",
        file_pattern: "*.js",
        path_filter: "^src/",
        mode: "compact",
        context: 3,
        regex: false,
        limit: 10,
      },
      "search_code",
      {
        project: "demo",
        pattern: "buildInvoice",
        file_pattern: "*.js",
        path_filter: "^src/",
        mode: "compact",
        context: 3,
        regex: false,
        limit: 10,
      },
    ],
    ["cbm_delete_project", { project: "demo" }, "delete_project", { project: "demo" }],
    ["cbm_index_status", { project: "demo" }, "index_status", { project: "demo" }],
    [
      "cbm_detect_changes",
      { project: "demo", scope: "src", depth: 3, base_branch: "main", since: "HEAD~2" },
      "detect_changes",
      { project: "demo", scope: "src", depth: 3, base_branch: "main", since: "HEAD~2" },
    ],
    [
      "cbm_manage_adr",
      { project: "demo", mode: "update", content: "ADR fixture", sections: ["Context", "Decision"] },
      "manage_adr",
      { project: "demo", mode: "update", content: "ADR fixture", sections: ["Context", "Decision"] },
    ],
    [
      "cbm_ingest_traces",
      { project: "demo", traces: [{ trace_id: "fixture", duration_ms: 4 }] },
      "ingest_traces",
      { project: "demo", traces: [{ trace_id: "fixture", duration_ms: 4 }] },
    ],
  ];

  for (const [connectorName, input, nativeName, expectedArgs] of cases) {
    const result = await byName.get(connectorName).execute(input);
    assert.equal(result.cbm_tool, nativeName);
    assert.deepEqual(result.result.args, expectedArgs);
  }

  const projectNameAlias = await byName.get("cbm_index_status").execute({ project_name: "demo-alias" });
  assert.equal(projectNameAlias.cbm_tool, "index_status");
  assert.deepEqual(projectNameAlias.result.args, { project: "demo-alias" });
  const matchingAlias = await byName.get("cbm_search_code").execute({
    project: "demo",
    project_name: "demo",
    pattern: "buildInvoice",
  });
  assert.equal(matchingAlias.cbm_tool, "search_code");
  assert.deepEqual(matchingAlias.result.args, { project: "demo", pattern: "buildInvoice" });
  const conflictingAlias = await byName.get("cbm_search_graph").execute({
    project: "demo-left",
    project_name: "demo-right",
  });
  assert.equal(conflictingAlias.success, false);
  assert.equal(conflictingAlias.error_code, "invalid_project_alias");
  assert.match(conflictingAlias.error, /project_name/);

  const readCallsBeforeIndex = calls
    .filter((entry) => entry.op === "call")
    .map((entry) => entry.toolName)
    .filter((name) => !["delete_project", "manage_adr", "ingest_traces"].includes(name));
  assert.equal(readCallsBeforeIndex.includes("index_repository"), false);

  const indexed = await byName.get("cbm_index_repository").execute({
    path: "mcp-tests",
    mode: "moderate",
    target_projects: ["shared"],
    name: "demo-index",
    persistence: true,
  });
  assert.equal(indexed.cbm_tool, "index_repository");
  assert.deepEqual(calls.slice(-3), [
    { op: "resolve", logicalPath: "mcp-tests" },
    { op: "call", toolName: "list_projects", args: {} },
    {
      op: "call",
      toolName: "index_repository",
      args: {
        repo_path: "C:\\Work\\mcp-tests",
        mode: "moderate",
        target_projects: ["shared"],
        name: "demo-index",
        persistence: true,
      },
    },
  ]);

  const adrCalls = [];
  let adrGetCount = 0;
  const adrBridge = {
    resolveCbmRepositoryPath(logicalPath) {
      adrCalls.push({ op: "resolve", logicalPath });
      return { absolutePath: "C:\\Work\\mcp-tests", displayPath: logicalPath, rootAlias: "work" };
    },
    async callCbmTool(toolName, args) {
      adrCalls.push({ op: "call", toolName, args });
      if (toolName === "list_projects") return { ...bridgeResult(toolName, args), result: { projects: [{ name: "demo-project", root_path: "C:/Work/mcp-tests" }] } };
      if (toolName === "manage_adr" && args.mode === "get") {
        adrGetCount += 1;
        return { ...bridgeResult(toolName, args), result: adrGetCount === 1 ? { content: "## PURPOSE\nPreserve me" } : { content: "", status: "no_adr" } };
      }
      if (toolName === "manage_adr" && args.mode === "update") return { ...bridgeResult(toolName, args), result: { status: "updated" } };
      if (toolName === "index_repository") return { ...bridgeResult(toolName, args), result: { project: "demo-project", status: "indexed", adr_present: false } };
      return bridgeResult(toolName, args);
    },
  };
  const adrIndexTool = createCbmTools(adrBridge).find((tool) => tool.name === "cbm_index_repository");
  const preservedIndex = await adrIndexTool.execute({ path: "mcp-tests" });
  assert.equal(preservedIndex.success, true);
  assert.equal(preservedIndex.result.adr_preservation_checked, true);
  assert.equal(preservedIndex.result.adr_restored_by_bridge, true);
  assert.deepEqual(adrCalls.map((entry) => entry.toolName || entry.op), [
    "resolve", "list_projects", "manage_adr", "index_repository", "manage_adr", "manage_adr",
  ]);
  assert.deepEqual(adrCalls.at(-1).args, { project: "demo-project", mode: "update", content: "## PURPOSE\nPreserve me" });

  const failedSnapshotCalls = [];
  const failedSnapshotBridge = {
    resolveCbmRepositoryPath(logicalPath) {
      failedSnapshotCalls.push({ op: "resolve", logicalPath });
      return { absolutePath: "C:\\Work\\mcp-tests", displayPath: logicalPath, rootAlias: "work" };
    },
    async callCbmTool(toolName, args) {
      failedSnapshotCalls.push({ op: "call", toolName, args });
      if (toolName === "list_projects") {
        return { ...bridgeResult(toolName, args), result: { projects: [{ name: "demo-project", root_path: "C:/Work/mcp-tests" }] } };
      }
      if (toolName === "manage_adr" && args.mode === "get") {
        return {
          ...bridgeResult(toolName, args),
          success: false,
          error_code: "cbm_native_rejected",
          error: "project not found or not indexed",
          result: null,
        };
      }
      if (toolName === "index_repository") {
        return { ...bridgeResult(toolName, args), result: { project: "demo-project", status: "indexed" } };
      }
      return bridgeResult(toolName, args);
    },
  };
  const failedSnapshotIndexTool = createCbmTools(failedSnapshotBridge).find((tool) => tool.name === "cbm_index_repository");
  const failedSnapshotIndex = await failedSnapshotIndexTool.execute({ path: "mcp-tests" });
  assert.equal(failedSnapshotIndex.success, false);
  assert.equal(failedSnapshotIndex.error_code, "cbm_adr_snapshot_unavailable");
  assert.match(failedSnapshotIndex.error, /ADR snapshot unavailable/i);
  assert.equal(failedSnapshotCalls.some((entry) => entry.toolName === "index_repository"), false);

  const emptySnapshotCalls = [];
  const emptySnapshotBridge = {
    resolveCbmRepositoryPath(logicalPath) {
      emptySnapshotCalls.push({ op: "resolve", logicalPath });
      return { absolutePath: "C:\\Work\\mcp-tests", displayPath: logicalPath, rootAlias: "work" };
    },
    async callCbmTool(toolName, args) {
      emptySnapshotCalls.push({ op: "call", toolName, args });
      if (toolName === "list_projects") {
        return { ...bridgeResult(toolName, args), result: { projects: [{ name: "demo-project", root_path: "C:/Work/mcp-tests" }] } };
      }
      if (toolName === "manage_adr" && args.mode === "get") {
        return { ...bridgeResult(toolName, args), result: { content: "", status: "no_adr" } };
      }
      if (toolName === "index_repository") {
        return { ...bridgeResult(toolName, args), result: { project: "demo-project", status: "indexed", adr_present: false } };
      }
      return bridgeResult(toolName, args);
    },
  };
  const emptySnapshotIndexTool = createCbmTools(emptySnapshotBridge).find((tool) => tool.name === "cbm_index_repository");
  const emptySnapshotIndex = await emptySnapshotIndexTool.execute({ path: "mcp-tests" });
  assert.equal(emptySnapshotIndex.success, true);
  assert.equal(emptySnapshotIndex.result.adr_preservation_checked, true);
  assert.equal(emptySnapshotIndex.result.adr_snapshot_available, true);
  assert.equal(emptySnapshotIndex.result.adr_snapshot_nonempty, false);
  assert.equal(emptySnapshotIndex.result.adr_restored_by_bridge, false);
  assert.equal(emptySnapshotCalls.filter((entry) => entry.toolName === "index_repository").length, 1);
  assert.equal(emptySnapshotCalls.filter((entry) => entry.toolName === "manage_adr").length, 1);

  const rejected = await byName.get("cbm_index_repository").execute({ path: "escape" });
  assert.equal(rejected.success, false);
  assert.equal(rejected.error_code, "invalid_repository_path");
  assert.match(rejected.error, /Access denied/);

  assert.equal(schemas.CBM_STATUS_INPUT_SCHEMA.additionalProperties, false);
  assert.deepEqual(schemas.CBM_STATUS_INPUT_SCHEMA.required, []);
  assert.equal(schemas.CBM_INDEX_REPOSITORY_INPUT_SCHEMA.required.includes("path"), true);
  assert.equal(schemas.CBM_QUERY_GRAPH_INPUT_SCHEMA.required.includes("query"), true);
  assert.equal(schemas.CBM_TRACE_PATH_INPUT_SCHEMA.properties.depth.maximum, 5);
  assert.equal(schemas.CBM_QUERY_GRAPH_INPUT_SCHEMA.properties.max_rows.maximum, 100000);
  assert.equal(schemas.CBM_INGEST_TRACES_INPUT_SCHEMA.properties.traces.maxItems <= 1000, true);

  console.log("smoke_cbm_tool_contracts ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

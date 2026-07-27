"use strict";

const schemas = require("../../schemas/codebase_memory_tools");
const bridge = require("./cbm_cli_bridge");
const { safeArgSummary } = require("../../util/path_policy");

function bridgeFailure(toolName, errorCode, error) {
  return {
    success: false,
    error_code: errorCode,
    error: error?.message || String(error),
    cbm_tool: toolName,
    duration_ms: 0,
    queue_wait_ms: 0,
    execution_ms: 0,
    binary_version: "",
    compatibility_status: "",
    partial_success: false,
    warnings: [],
    timed_out: false,
    exit_code: null,
    signal: null,
    stdout_truncated: false,
    stderr_truncated: false,
    diagnostic: "",
    result: null,
  };
}

function genericResultStats(payload = {}) {
  return {
    result_count: payload.success ? 1 : 0,
    result_chars: JSON.stringify(payload || {}).length,
  };
}

function copyDefined(source, keys) {
  const output = {};
  for (const key of keys) {
    if (source[key] !== undefined) output[key] = source[key];
  }
  return output;
}

function normalizeProjectAlias(args = {}) {
  const hasProject = args.project !== undefined;
  const hasProjectName = args.project_name !== undefined;
  if (hasProject && hasProjectName && String(args.project) !== String(args.project_name)) {
    return {
      ok: false,
      error: new Error("project and project_name must refer to the same codebase-memory project."),
    };
  }
  if (!hasProject && hasProjectName) return { ok: true, args: { ...args, project: args.project_name } };
  return { ok: true, args };
}

function projectSummary(operation, args = {}, extra = {}) {
  return safeArgSummary(args.project || args.project_name || "", { operation, ...extra });
}

function comparablePath(value) {
  const normalized = String(value || "").replaceAll("\\", "/").replace(/\/+$/, "");
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function findProjectForRepository(listEnvelope, absolutePath) {
  const projects = Array.isArray(listEnvelope?.result?.projects) ? listEnvelope.result.projects : [];
  const target = comparablePath(absolutePath);
  return projects.find((project) => comparablePath(project?.root_path) === target) || null;
}

function enrichIndexEnvelope(envelope, metadata, warning = "") {
  if (!envelope || envelope.success !== true || !envelope.result || typeof envelope.result !== "object") return envelope;
  const warnings = [...(Array.isArray(envelope.warnings) ? envelope.warnings : [])];
  if (warning) warnings.push(warning);
  return {
    ...envelope,
    partial_success: Boolean(envelope.partial_success || warning),
    warnings: warnings.slice(0, 40),
    result: { ...envelope.result, ...metadata },
  };
}

function createNativeTool({
  connectorName,
  nativeName,
  title,
  description,
  inputSchema,
  annotations = schemas.READ_ONLY_CBM_ANNOTATIONS,
  forwardedKeys = [],
  summarizeArgs,
}, cbmBridge) {
  return {
    name: connectorName,
    descriptor: {
      name: connectorName,
      title,
      description,
      inputSchema,
      outputSchema: schemas.CBM_BRIDGE_OUTPUT_SCHEMA,
      annotations,
    },
    execute(args = {}) {
      const normalized = forwardedKeys.includes("project") ? normalizeProjectAlias(args) : { ok: true, args };
      if (!normalized.ok) return bridgeFailure(nativeName, "invalid_project_alias", normalized.error);
      return cbmBridge.callCbmTool(nativeName, copyDefined(normalized.args, forwardedKeys));
    },
    summarizeArgs: summarizeArgs || ((args = {}) => projectSummary(connectorName, args)),
    resultStats: genericResultStats,
  };
}

function createCbmTools(cbmBridge = bridge) {
  const cbmStatusTool = {
    name: "cbm_status",
    descriptor: {
      name: "cbm_status",
      title: "Codebase-memory bridge status",
      description: "Report profile-managed exposure and codebase-memory v0.9.0 compatibility health, including executable identity, manifest match, native tools, containment root, queue state, mutation lock, timeouts, and watcher posture.",
      inputSchema: schemas.CBM_STATUS_INPUT_SCHEMA,
      outputSchema: schemas.CBM_STATUS_OUTPUT_SCHEMA,
      annotations: schemas.READ_ONLY_CBM_ANNOTATIONS,
    },
    execute() {
      return cbmBridge.getCbmRuntimeStatus();
    },
    summarizeArgs() {
      return { operation: "cbm_status" };
    },
    resultStats: genericResultStats,
  };

  const cbmListProjectsTool = createNativeTool({
    connectorName: "cbm_list_projects",
    nativeName: "list_projects",
    title: "List codebase-memory projects",
    description: "List persisted codebase-memory project indexes. Results reflect stored indexes and do not trigger repository indexing.",
    inputSchema: schemas.CBM_LIST_PROJECTS_INPUT_SCHEMA,
    forwardedKeys: [],
    summarizeArgs() {
      return { operation: "cbm_list_projects" };
    },
  }, cbmBridge);

  const cbmIndexRepositoryTool = {
    name: "cbm_index_repository",
    descriptor: {
      name: "cbm_index_repository",
      title: "Index repository with codebase-memory",
      description: "Explicitly index or synchronize one repository directory inside an authorized workspace root using the verified v0.9.0 contract. Partial indexes remain successful but expose bounded warnings and skipped-file details. Existing ADR content is snapshotted, verified, and restored when native reindexing loses it. Only one CBM mutation may run at a time.",
      inputSchema: schemas.CBM_INDEX_REPOSITORY_INPUT_SCHEMA,
      outputSchema: schemas.CBM_BRIDGE_OUTPUT_SCHEMA,
      annotations: schemas.INDEXING_CBM_ANNOTATIONS,
    },
    async execute(args = {}) {
      try {
        const repository = cbmBridge.resolveCbmRepositoryPath(args.path);
        let existingProject = null;
        let adrSnapshot = "";
        let adrSnapshotAvailable = false;
        const listed = await cbmBridge.callCbmTool("list_projects", {});
        if (listed?.success === true) {
          existingProject = findProjectForRepository(listed, repository.absolutePath);
          if (existingProject?.name) {
            const beforeAdr = await cbmBridge.callCbmTool("manage_adr", { project: existingProject.name, mode: "get" });
            if (beforeAdr?.success !== true || typeof beforeAdr.result?.content !== "string") {
              const detail = String(beforeAdr?.error || beforeAdr?.error_code || "invalid ADR response");
              return bridgeFailure(
                "index_repository",
                "cbm_adr_snapshot_unavailable",
                new Error(`ADR snapshot unavailable for existing project ${existingProject.name}: ${detail}`)
              );
            }
            adrSnapshot = beforeAdr.result.content;
            adrSnapshotAvailable = true;
          }
        }

        const indexed = await cbmBridge.callCbmTool("index_repository", {
          repo_path: repository.absolutePath,
          ...copyDefined(args, ["mode", "target_projects", "name", "persistence"]),
        });
        if (indexed?.success !== true) return indexed;

        const projectName = String(indexed.result?.project || existingProject?.name || "");
        const metadata = {
          adr_preservation_checked: Boolean(existingProject?.name),
          adr_snapshot_available: adrSnapshotAvailable,
          adr_snapshot_nonempty: Boolean(adrSnapshotAvailable && adrSnapshot.length > 0),
          adr_restored_by_bridge: false,
        };
        if (!adrSnapshotAvailable || !adrSnapshot || !projectName) return enrichIndexEnvelope(indexed, metadata);

        const afterAdr = await cbmBridge.callCbmTool("manage_adr", { project: projectName, mode: "get" });
        if (afterAdr?.success === true && afterAdr.result?.content === adrSnapshot) {
          return enrichIndexEnvelope(indexed, metadata);
        }

        const restored = await cbmBridge.callCbmTool("manage_adr", { project: projectName, mode: "update", content: adrSnapshot });
        if (restored?.success === true) {
          return enrichIndexEnvelope(indexed, { ...metadata, adr_restored_by_bridge: true });
        }
        return enrichIndexEnvelope(
          indexed,
          metadata,
          "ADR existed before indexing but could not be restored after the native CBM index operation."
        );
      } catch (error) {
        return bridgeFailure("index_repository", "invalid_repository_path", error);
      }
    },
    summarizeArgs(args = {}) {
      return safeArgSummary(args.path || "", {
        operation: "cbm_index_repository",
        mode: args.mode || "full",
        target_project_count: Array.isArray(args.target_projects) ? args.target_projects.length : 0,
        has_name_override: Boolean(args.name),
        persistence: Boolean(args.persistence),
      });
    },
    resultStats: genericResultStats,
  };

  const cbmGetArchitectureTool = createNativeTool({
    connectorName: "cbm_get_architecture",
    nativeName: "get_architecture",
    title: "Get codebase architecture",
    description: "Read architecture data from an existing codebase-memory project index. The tool never starts indexing and may reflect the latest completed index only.",
    inputSchema: schemas.CBM_GET_ARCHITECTURE_INPUT_SCHEMA,
    forwardedKeys: ["project", "path", "aspects"],
    summarizeArgs(args = {}) {
      return projectSummary("cbm_get_architecture", args, {
        scoped_path: Boolean(args.path),
        aspect_count: Array.isArray(args.aspects) ? args.aspects.length : 0,
      });
    },
  }, cbmBridge);

  const cbmSearchGraphTool = createNativeTool({
    connectorName: "cbm_search_graph",
    nativeName: "search_graph",
    title: "Search codebase graph",
    description: "Search an existing codebase-memory graph with bounded structural, full-text, semantic, and pagination filters. The tool never starts indexing.",
    inputSchema: schemas.CBM_SEARCH_GRAPH_INPUT_SCHEMA,
    forwardedKeys: [
      "project",
      "query",
      "label",
      "name_pattern",
      "qn_pattern",
      "file_pattern",
      "relationship",
      "min_degree",
      "max_degree",
      "exclude_entry_points",
      "include_connected",
      "semantic_query",
      "limit",
      "offset",
    ],
    summarizeArgs(args = {}) {
      return projectSummary("cbm_search_graph", args, {
        filter_count: [
          "query",
          "label",
          "name_pattern",
          "qn_pattern",
          "file_pattern",
          "relationship",
          "min_degree",
          "max_degree",
          "exclude_entry_points",
          "include_connected",
          "semantic_query",
        ].filter((key) => args[key] !== undefined).length,
        semantic_term_count: Array.isArray(args.semantic_query) ? args.semantic_query.length : 0,
        limit: Number(args.limit || 50),
        offset: Number(args.offset || 0),
      });
    },
  }, cbmBridge);

  const cbmQueryGraphTool = createNativeTool({
    connectorName: "cbm_query_graph",
    nativeName: "query_graph",
    title: "Query codebase graph",
    description: "Execute a bounded read-only Cypher query against an existing codebase-memory project. Native CBM rejects unsupported or write clauses; suspicious labels() aggregation is returned with an explicit verification warning.",
    inputSchema: schemas.CBM_QUERY_GRAPH_INPUT_SCHEMA,
    forwardedKeys: ["project", "query", "max_rows"],
    summarizeArgs(args = {}) {
      return projectSummary("cbm_query_graph", args, {
        query_chars: String(args.query || "").length,
        max_rows: Number(args.max_rows || 0),
      });
    },
  }, cbmBridge);

  const cbmTracePathTool = createNativeTool({
    connectorName: "cbm_trace_path",
    nativeName: "trace_path",
    title: "Trace code paths",
    description: "Trace calls, data flow, or cross-service paths in an existing codebase-memory graph. The tool never starts indexing.",
    inputSchema: schemas.CBM_TRACE_PATH_INPUT_SCHEMA,
    forwardedKeys: [
      "project",
      "function_name",
      "direction",
      "depth",
      "mode",
      "parameter_name",
      "edge_types",
      "risk_labels",
      "include_tests",
    ],
    summarizeArgs(args = {}) {
      return projectSummary("cbm_trace_path", args, {
        function_name_chars: String(args.function_name || "").length,
        direction: args.direction || "both",
        depth: Number(args.depth || 3),
        mode: args.mode || "calls",
        edge_type_count: Array.isArray(args.edge_types) ? args.edge_types.length : 0,
      });
    },
  }, cbmBridge);

  const cbmGetCodeSnippetTool = createNativeTool({
    connectorName: "cbm_get_code_snippet",
    nativeName: "get_code_snippet",
    title: "Get indexed code snippet",
    description: "Read source for an indexed qualified symbol. Discover the exact qualified name with cbm_search_graph first; this tool never indexes implicitly.",
    inputSchema: schemas.CBM_GET_CODE_SNIPPET_INPUT_SCHEMA,
    forwardedKeys: ["project", "qualified_name", "include_neighbors"],
    summarizeArgs(args = {}) {
      return projectSummary("cbm_get_code_snippet", args, {
        qualified_name_chars: String(args.qualified_name || "").length,
        include_neighbors: Boolean(args.include_neighbors),
      });
    },
  }, cbmBridge);

  const cbmGetGraphSchemaTool = createNativeTool({
    connectorName: "cbm_get_graph_schema",
    nativeName: "get_graph_schema",
    title: "Get codebase graph schema",
    description: "Read node labels, edge types, counts, and graph property definitions for an existing codebase-memory project.",
    inputSchema: schemas.CBM_GET_GRAPH_SCHEMA_INPUT_SCHEMA,
    forwardedKeys: ["project"],
  }, cbmBridge);

  const cbmSearchCodeTool = createNativeTool({
    connectorName: "cbm_search_code",
    nativeName: "search_code",
    title: "Search indexed source code",
    description: "Run bounded graph-augmented text search inside an existing indexed project. The tool reads indexed project files and never starts indexing.",
    inputSchema: schemas.CBM_SEARCH_CODE_INPUT_SCHEMA,
    forwardedKeys: ["project", "pattern", "file_pattern", "path_filter", "mode", "context", "regex", "limit"],
    summarizeArgs(args = {}) {
      return projectSummary("cbm_search_code", args, {
        pattern_chars: String(args.pattern || "").length,
        mode: args.mode || "compact",
        context: Number(args.context || 0),
        regex: Boolean(args.regex),
        limit: Number(args.limit || 10),
      });
    },
  }, cbmBridge);

  const cbmDeleteProjectTool = createNativeTool({
    connectorName: "cbm_delete_project",
    nativeName: "delete_project",
    title: "Delete codebase-memory project",
    description: "Destructively remove one named codebase-memory project index after short-lived, one-time authenticated confirmation. The second call uses a bounded state_handle; only project is forwarded to native CBM, and the repository source tree is never deleted.",
    inputSchema: schemas.CBM_DELETE_PROJECT_INPUT_SCHEMA,
    annotations: schemas.DESTRUCTIVE_CBM_ANNOTATIONS,
    forwardedKeys: ["project"],
  }, cbmBridge);

  const cbmIndexStatusTool = createNativeTool({
    connectorName: "cbm_index_status",
    nativeName: "index_status",
    title: "Get codebase-memory index status",
    description: "Read native indexing status for one persisted codebase-memory project. This is distinct from cbm_status, which reports bridge and executable health.",
    inputSchema: schemas.CBM_INDEX_STATUS_INPUT_SCHEMA,
    forwardedKeys: ["project"],
  }, cbmBridge);

  const cbmDetectChangesTool = createNativeTool({
    connectorName: "cbm_detect_changes",
    nativeName: "detect_changes",
    title: "Detect indexed code changes",
    description: "Map a bounded Git comparison to changed symbols and graph impact. The bridge enforces path scope, caps returned files and symbols at 200 each, preserves native totals, and marks unresolved impact explicitly.",
    inputSchema: schemas.CBM_DETECT_CHANGES_INPUT_SCHEMA,
    forwardedKeys: ["project", "scope", "depth", "base_branch", "since"],
    summarizeArgs(args = {}) {
      return projectSummary("cbm_detect_changes", args, {
        scoped: Boolean(args.scope),
        depth: Number(args.depth || 2),
        has_base_branch: Boolean(args.base_branch),
        has_since: Boolean(args.since),
      });
    },
  }, cbmBridge);

  const cbmManageAdrTool = createNativeTool({
    connectorName: "cbm_manage_adr",
    nativeName: "manage_adr",
    title: "Manage codebase architecture decisions",
    description: "Read or update Architecture Decision Records for one codebase-memory project. Conservatively classified as a mutation for every mode.",
    inputSchema: schemas.CBM_MANAGE_ADR_INPUT_SCHEMA,
    annotations: schemas.MUTATING_CBM_ANNOTATIONS,
    forwardedKeys: ["project", "mode", "content", "sections"],
    summarizeArgs(args = {}) {
      return projectSummary("cbm_manage_adr", args, {
        mode: args.mode || "get",
        content_chars: String(args.content || "").length,
        section_count: Array.isArray(args.sections) ? args.sections.length : 0,
      });
    },
  }, cbmBridge);

  const cbmIngestTracesTool = createNativeTool({
    connectorName: "cbm_ingest_traces",
    nativeName: "ingest_traces",
    title: "Ingest codebase runtime traces",
    description: "Ingest a strictly validated runtime-trace batch. When native v0.9.0 accepts traces without creating runtime edges, the result is explicitly marked partial with a warning.",
    inputSchema: schemas.CBM_INGEST_TRACES_INPUT_SCHEMA,
    annotations: schemas.MUTATING_CBM_ANNOTATIONS,
    forwardedKeys: ["project", "traces"],
    summarizeArgs(args = {}) {
      return projectSummary("cbm_ingest_traces", args, {
        trace_count: Array.isArray(args.traces) ? args.traces.length : 0,
      });
    },
  }, cbmBridge);

  return [
    cbmStatusTool,
    cbmListProjectsTool,
    cbmIndexRepositoryTool,
    cbmGetArchitectureTool,
    cbmSearchGraphTool,
    cbmQueryGraphTool,
    cbmTracePathTool,
    cbmGetCodeSnippetTool,
    cbmGetGraphSchemaTool,
    cbmSearchCodeTool,
    cbmDeleteProjectTool,
    cbmIndexStatusTool,
    cbmDetectChangesTool,
    cbmManageAdrTool,
    cbmIngestTracesTool,
  ];
}

const [
  cbmStatusTool,
  cbmListProjectsTool,
  cbmIndexRepositoryTool,
  cbmGetArchitectureTool,
  cbmSearchGraphTool,
  cbmQueryGraphTool,
  cbmTracePathTool,
  cbmGetCodeSnippetTool,
  cbmGetGraphSchemaTool,
  cbmSearchCodeTool,
  cbmDeleteProjectTool,
  cbmIndexStatusTool,
  cbmDetectChangesTool,
  cbmManageAdrTool,
  cbmIngestTracesTool,
] = createCbmTools();

module.exports = {
  cbmDeleteProjectTool,
  cbmDetectChangesTool,
  cbmGetArchitectureTool,
  cbmGetCodeSnippetTool,
  cbmGetGraphSchemaTool,
  cbmIndexRepositoryTool,
  cbmIndexStatusTool,
  cbmIngestTracesTool,
  cbmListProjectsTool,
  cbmManageAdrTool,
  cbmQueryGraphTool,
  cbmSearchCodeTool,
  cbmSearchGraphTool,
  cbmStatusTool,
  cbmTracePathTool,
  createCbmTools,
};

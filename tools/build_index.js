"use strict";

const {
  BUILD_INDEX_INPUT_SCHEMA,
  BUILD_INDEX_OUTPUT_SCHEMA,
  STATE_CHANGING_WORKSPACE_INDEX_ANNOTATIONS,
} = require("../src/schemas/workspace_index_tools");
const { buildWorkspaceIndex } = require("../src/util/workspace_index");

const TOOL_NAME = "build_index";

function emptyWorkflowSummary() {
  return {
    canonical_docs: [],
    server_specs: { count: 0, sample_paths: [] },
    workflow_markers: {
      current_working_course: "",
      next_primary: "",
      next_secondary: "",
      stage_labels: [],
    },
    runtime_identity: {
      server_name: "",
      server_version: "",
      connector_shape_version: "",
      output_mode: "",
      public_port: 0,
      authorized_port: 0,
      public_tool_count: 0,
      authorized_tool_count: 0,
      authenticated_total_tool_count: 0,
    },
    readiness: { status: "", updated: "", component_count: 0, components: [] },
    roadmap: { status: "", updated: "", item_count: 0, items: [] },
    documentation_gaps: [],
    health: {
      has_northstar: false,
      has_state: false,
      has_readiness: false,
      has_roadmap: false,
      has_workflow_canon: false,
      has_runtime_identity: false,
      source_of_truth_count: 0,
    },
  };
}

function emptyKnowledgeSummary(profile = "") {
  return {
    profile,
    by_kind: [],
    by_authority: [],
    by_format: [],
    top_level_areas: [],
    top_subareas: [],
    top_authority_docs: [],
    workflow_summary: emptyWorkflowSummary(),
  };
}

const buildIndexTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Build workspace index",
    description: "Rebuild the local workspace retrieval index across configured roots.",
    inputSchema: BUILD_INDEX_INPUT_SCHEMA,
    outputSchema: BUILD_INDEX_OUTPUT_SCHEMA,
    annotations: STATE_CHANGING_WORKSPACE_INDEX_ANNOTATIONS,
  },
  async execute(args = {}) {
    try {
      const index = await buildWorkspaceIndex({
        path: args.path,
        max_files: args.max_files,
        max_dirs: args.max_dirs,
        profile: args.profile,
      });
      return {
        success: true,
        error: "",
        status: "built",
        count: Array.isArray(index.docs) ? index.docs.length : 0,
        created_at: String(index.created_at || ""),
        roots: Array.isArray(index.roots) ? index.roots : [],
        scope: index.scope || { path: ".", root_alias: "", display_path: ".", mode: "all_roots" },
        profile: String(index.profile || index.stats?.profile || "knowledge"),
        visited_files: Number(index.stats?.visited_files || 0),
        visited_dirs: Number(index.stats?.visited_dirs || 0),
        truncated: Boolean(index.stats?.truncated),
        max_files: Number(index.stats?.max_files || 0),
        max_dirs: Number(index.stats?.max_dirs || 0),
        skipped: index.stats?.skipped || { oversized: 0, extension: 0, directories: 0 },
        knowledge_summary: index.stats?.knowledge_summary || emptyKnowledgeSummary(String(index.profile || "knowledge")),
      };
    } catch (error) {
      return {
        success: false,
        error: error?.message || String(error),
        status: "error",
        count: 0,
        created_at: "",
        roots: [],
        scope: { path: "", root_alias: "", display_path: "", mode: "" },
        profile: "",
        visited_files: 0,
        visited_dirs: 0,
        truncated: false,
        max_files: 0,
        max_dirs: 0,
        skipped: { oversized: 0, extension: 0, directories: 0 },
        knowledge_summary: emptyKnowledgeSummary(""),
      };
    }
  },
  summarizeArgs(args = {}) {
    return {
      operation: TOOL_NAME,
      path: String(args.path || "."),
      profile: String(args.profile || "knowledge"),
      max_files: Number(args.max_files || 20000),
      max_dirs: Number(args.max_dirs || 5000),
    };
  },
  resultStats(payload = {}) {
    return {
      result_count: Number(payload.count || 0),
      result_chars: JSON.stringify(payload || {}).length,
    };
  },
};

module.exports = { buildIndexTool };

"use strict";

const assert = require("node:assert/strict");

const { loadOptionalTools } = require("../src/tool_loader");

const FLAG = "MCP_TEST_ENABLE_CBM_TOOLS";
const previousFlag = process.env[FLAG];
const CBM_NAMES = [
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
];

function names(options = {}) {
  return loadOptionalTools({
    profile: "internal",
    authPolicy: { mode: "oauth21", requiresAuth: true },
    serverProfileConfig: {
      name: "tests",
      surfaceName: "authenticated",
      surface: {
        optional_tool_groups: ["public", "authorized", "internal"],
        include_memory_tools: true,
      },
    },
    ...options,
  }).map((tool) => tool.name);
}

try {
  delete process.env[FLAG];
  assert.deepEqual(names().filter((name) => name.startsWith("cbm_")), CBM_NAMES);

  process.env[FLAG] = "0";
  assert.deepEqual(names().filter((name) => name.startsWith("cbm_")), CBM_NAMES);

  let providerCalls = 0;
  const unavailable = names({
    cbmAvailabilityProvider: () => {
      providerCalls += 1;
      return { available: false, error_code: "executable_missing" };
    },
  });
  assert.deepEqual(unavailable.filter((name) => name.startsWith("cbm_")), CBM_NAMES);
  assert.equal(providerCalls, 0);

  const publicNames = loadOptionalTools({
    profile: "public",
    authPolicy: { mode: "none", requiresAuth: false },
    serverProfileConfig: {
      name: "tests",
      surfaceName: "public",
      surface: {
        optional_tool_groups: ["public"],
        include_memory_tools: false,
      },
    },
  }).map((tool) => tool.name);
  assert.deepEqual(publicNames.filter((name) => name.startsWith("cbm_")), []);

  const unauthenticatedInternal = names({
    authPolicy: { mode: "none", requiresAuth: false },
  });
  assert.deepEqual(unauthenticatedInternal.filter((name) => name.startsWith("cbm_")), []);

  const authorizedGroupAbsent = names({
    serverProfileConfig: {
      name: "tests",
      surfaceName: "authenticated",
      surface: {
        optional_tool_groups: ["public", "internal"],
        include_memory_tools: true,
      },
    },
  });
  assert.deepEqual(authorizedGroupAbsent.filter((name) => name.startsWith("cbm_")), []);

  console.log("smoke_cbm_loader_gate ok");
} finally {
  if (previousFlag === undefined) delete process.env[FLAG];
  else process.env[FLAG] = previousFlag;
}

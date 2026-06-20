"use strict";

const descriptorAudit = require("../descriptor_audit");
const { assertToolDescriptors } = descriptorAudit;
const { assertToolSchemas } = require("../schema_compat");
const { assertProfilePolicy } = require("../tool_policy");
const { normalizeRelativePath } = require("../util/path_policy");
const { fetchDoc, searchDocs } = require("./search_fetch_docs");
const { toolResult } = require("./tool_result");
const { parseSingleTextJsonToolResult } = require("./tool_result_assertion");
const { assertPublicSearchResults } = require("./search_result_assertion");
const { assertTextExcludesMarkers } = require("./text_marker_assertion");
const { assertFetchMetadataRuntimeFields } = require("./fetch_metadata_assertion");
const { assertPublicFetchPayloadFields } = require("./fetch_payload_assertion");
const { assertReadOnlyAnnotations } = require("./read_only_annotation_assertion");
const { assertSearchOutputSchemaStrict } = require("./search_output_schema_assertion");
const { assertFetchOutputSchemaStrict } = require("./fetch_output_schema_assertion");
const { assertPublicFsPolicySelfTest } = require("./fs_policy_selftest");
const { assertPublicNetworkPolicySelfTest } = require("./network_policy_selftest");
const { assertCodeSampleJsSelfTest } = require("./code_sample_selftest");
const { assertRiskCanarySelfTest } = require("./risk_canary_selftest");
const { assertAuthPolicySelfTest } = require("./auth_policy_selftest");

async function assertConnectorShapeSelfTest({
  toolsList,
  optionalTools,
  getOptionalTool,
  authPolicy,
  runtimeProfile,
  outputMode,
  maxFetchTextChars,
  connectorShapeVersion,
  documentRuntimeContext,
}) {
  const tools = toolsList();
  const toolNames = tools.map((tool) => tool.name).sort();

  const expectedToolNames = ["fetch", "search"]
    .concat(optionalTools.map((tool) => tool.name))
    .sort();

  const expectedDescriptorNames = runtimeProfile === "public" ? descriptorAudit.PUBLIC_TOOL_NAMES : descriptorAudit.EXPECTED_TOOL_NAMES;
  assertToolDescriptors(tools, { expectedToolNames: expectedDescriptorNames });
  assertToolSchemas(tools);
  assertProfilePolicy(tools, { profile: runtimeProfile, authMode: authPolicy.mode });

  if (JSON.stringify(toolNames) !== JSON.stringify(expectedToolNames)) {
    throw new Error(
      `tool surface mismatch: got ${toolNames.join(",")} expected ${expectedToolNames.join(",")}`
    );
  }

  for (const tool of tools) {
    if (!tool.title) {
      throw new Error(`${tool.name} missing title`);
    }

    if (!tool.description) {
      throw new Error(`${tool.name} missing description`);
    }

    if (!tool.inputSchema) {
      throw new Error(`${tool.name} missing inputSchema`);
    }

    if (!tool.annotations) {
      throw new Error(`${tool.name} missing annotations`);
    }

    assertReadOnlyAnnotations(tool);

    if (outputMode === "structured" && !tool.outputSchema) {
      throw new Error(`${tool.name} missing outputSchema in structured mode`);
    }

    if (outputMode === "content-only" && tool.outputSchema) {
      throw new Error(`${tool.name} must not expose outputSchema in content-only mode`);
    }

    if (outputMode === "structured" && tool.name === "search") {
      assertSearchOutputSchemaStrict(tool.outputSchema);
    }

    if (outputMode === "structured" && tool.name === "fetch") {
      assertFetchOutputSchemaStrict(tool.outputSchema);
    }
  }

  if (typeof documentRuntimeContext !== "function") {
    throw new Error("documentRuntimeContext provider missing");
  }

  const searchResult = toolResult(outputMode, {
    results: searchDocs(documentRuntimeContext(), "test-mcp-health-canary"),
  });

  const parsedSearch = parseSingleTextJsonToolResult(searchResult, "search", outputMode);

  assertPublicSearchResults(parsedSearch, {
    label: "search",
    resultLabel: "search result",
    requiredFirstId: "test-mcp-health-canary",
    emptyMessage: "search must return at least one result for test-mcp-health-canary",
    missingFirstMessage: "test-mcp-health-canary must be first result for test-mcp-health-canary query",
  });

  const fetchPayload = fetchDoc(documentRuntimeContext(), "test-mcp-health-canary");

  if (!fetchPayload) {
    throw new Error("test-mcp-health-canary fetch payload missing");
  }

  const fetchResult = toolResult(outputMode, fetchPayload);

  const parsedFetch = parseSingleTextJsonToolResult(fetchResult, "fetch", outputMode);

  assertPublicFetchPayloadFields(parsedFetch, {
    label: "fetch",
    objectKeyLabel: "fetch payload",
    checkRequiredKeys: true,
    missingKeyPrefix: "fetch",
    maxTextChars: maxFetchTextChars,
    textCapMessage: "fetch text exceeds cap",
  });

  assertTextExcludesMarkers(
    parsedFetch.text,
    ["run_process", "write_file", "delete_path", "registry_execute", "C:\\", "file://", "127.0.0.1", "localhost"],
    "canary fetch text"
  );

  assertFetchMetadataRuntimeFields(parsedFetch.metadata, {
    label: "fetch",
    connectorShapeVersion,
    requireTextCapFields: true,
    connectorShapeVersionMessage: "fetch metadata connectorShapeVersion mismatch",
  });

  const neutralTaskSearch = toolResult(outputMode, {
    results: searchDocs(documentRuntimeContext(), "rahh"),
  });

  const parsedNeutralTaskSearch = JSON.parse(neutralTaskSearch.content[0].text);

  assertPublicSearchResults(parsedNeutralTaskSearch, {
    label: "neutral task search",
    resultLabel: "neutral task search result",
    requiredAnyId: "task-rahh-001",
    missingAnyMessage: "neutral task search did not return task-rahh-001",
  });

  const neutralTaskPayload = fetchDoc(documentRuntimeContext(), "task-rahh-001");

  if (!neutralTaskPayload) {
    throw new Error("task-rahh-001 fetch payload missing");
  }

  const neutralTaskResult = toolResult(outputMode, neutralTaskPayload);
  const parsedNeutralTaskFetch = JSON.parse(neutralTaskResult.content[0].text);

  assertPublicFetchPayloadFields(parsedNeutralTaskFetch, {
    label: "neutral task fetch",
    objectKeyLabel: "neutral task fetch payload",
    expectedId: "task-rahh-001",
    expectedIdMessage: "neutral task fetch id mismatch",
    maxTextChars: maxFetchTextChars,
    textCapMessage: "neutral task fetch text exceeds cap",
  });

  assertFetchMetadataRuntimeFields(parsedNeutralTaskFetch.metadata, {
    label: "neutral task",
    connectorShapeVersion,
    expectedKind: "neutral-task-context",
    connectorShapeVersionMessage: "neutral task connectorShapeVersion mismatch",
  });

  if (outputMode === "structured") {
    if (!neutralTaskResult.structuredContent) {
      throw new Error("neutral task structuredContent missing in structured mode");
    }

    if (
      JSON.stringify(parsedNeutralTaskFetch) !==
      JSON.stringify(neutralTaskResult.structuredContent)
    ) {
      throw new Error("neutral task structuredContent does not match content JSON");
    }
  }

  assertRiskCanarySelfTest(fetchDoc(documentRuntimeContext(), "risk-canary-cyber-markers"));

  assertAuthPolicySelfTest(authPolicy);

  const fsTools = optionalTools.filter((tool) => String(tool.name).startsWith("fs_"));

  assertPublicFsPolicySelfTest(fsTools, normalizeRelativePath);

  const netTools = optionalTools.filter((tool) => String(tool.name).startsWith("net_"));

  await assertPublicNetworkPolicySelfTest(netTools);

  assertCodeSampleJsSelfTest(getOptionalTool("code_sample_js"));
}

module.exports = {
  assertConnectorShapeSelfTest,
};

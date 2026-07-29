"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");

const { buildIndexTool } = require("../tools/build_index");
const { collectContextTool } = require("../tools/collect_context");
const { collectRomionsimContextTool } = require("../tools/collect_romionsim_context");
const { indexStatusTool } = require("../tools/index_status");
const { searchIndexContextTool } = require("../tools/search_index_context");
const { searchIndexTool } = require("../tools/search_index");
const { buildWorkspaceIndex, searchIndex } = require("../src/util/workspace_index");

const ROOT = path.resolve(__dirname, "..");
const INDEX_FILE = path.join(ROOT, "_control", "smoke-build-index.json");

(async () => {
  const previous = process.env.MCP_TEST_WORKSPACE_INDEX_FILE;
  process.env.MCP_TEST_WORKSPACE_INDEX_FILE = INDEX_FILE;
  await fs.rm(INDEX_FILE, { force: true });

  try {
    const missing = await indexStatusTool.execute();
    assert.equal(missing.status, "missing");
    assert.equal(missing.success, true);
    assert.equal(missing.truncated, false);
    assert.equal(missing.visited_files, 0);
    assert.equal(missing.max_files, 0);

    const build = await buildIndexTool.execute({ max_files: 200, max_dirs: 200 });
    assert.equal(build.status, "built");
    assert.equal(build.success, true);
    assert.ok(build.count > 0);
    assert.equal(build.scope.path, ".");
    assert.equal(build.scope.mode, "all_roots");
    assert.equal(build.profile, "knowledge");
    assert.ok(build.knowledge_summary.by_kind.length > 0);
    assert.ok(build.knowledge_summary.by_authority.length > 0);
    assert.equal(build.max_files, 200);
    assert.equal(build.max_dirs, 200);

    const status = await indexStatusTool.execute();
    assert.equal(status.status, "ok");
    assert.equal(status.success, true);
    assert.ok(status.count > 0);
    assert.equal(status.visited_files, build.visited_files);
    assert.equal(status.visited_dirs, build.visited_dirs);
    assert.equal(status.truncated, build.truncated);
    assert.equal(status.max_files, 200);
    assert.equal(status.max_dirs, 200);
    assert.deepEqual(status.scope, build.scope);
    assert.deepEqual(status.skipped, build.skipped);
    assert.equal(status.profile, "knowledge");
    assert.deepEqual(status.knowledge_summary.by_kind, build.knowledge_summary.by_kind);

    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "workspace-index-archive-skip-"));
    const isolatedIndexFile = path.join(tempRoot, "workspace-index.json");
    try {
      await fs.mkdir(path.join(tempRoot, "docs"), { recursive: true });
      await fs.mkdir(path.join(tempRoot, ".archive", "docs"), { recursive: true });
      await fs.writeFile(path.join(tempRoot, "docs", "live.md"), "# Live doc\nfollowup_traffic_without_fresh_entry\n", "utf8");
      await fs.writeFile(path.join(tempRoot, ".archive", "docs", "archived.md"), "# Archived doc\nfollowup_traffic_without_fresh_entry\n", "utf8");
      await fs.mkdir(path.join(tempRoot, "other"), { recursive: true });
      await fs.writeFile(path.join(tempRoot, "other", "outside.md"), "# Outside\nscoped-only-token\n", "utf8");
      await fs.mkdir(path.join(tempRoot, "romionsim", "docs"), { recursive: true });
      await fs.mkdir(path.join(tempRoot, "romionsim", "workflow"), { recursive: true });
      await fs.writeFile(path.join(tempRoot, "romionsim", "docs", "README.md"), "# Romionsim docs\nromionsim_graph_context_token\n", "utf8");
      await fs.writeFile(path.join(tempRoot, "romionsim", "workflow", "NEXT_SESSION_START.md"), "# Romionsim workflow\nromionsim_graph_context_token\n", "utf8");
      await fs.mkdir(path.join(tempRoot, "_repos_with_code_samples", "sample"), { recursive: true });
      await fs.writeFile(path.join(tempRoot, "_repos_with_code_samples", "sample", "fixture.md"), "# Fixture\nsample-fixture-token\n", "utf8");
      await fs.mkdir(path.join(tempRoot, "_workflow", "control_plane", "snapshots", "old", "_workflow"), { recursive: true });
      await fs.writeFile(path.join(tempRoot, "_workflow", "NORTHSTAR.md"), "# NorthStar\nTarget contract.\n", "utf8");
      await fs.writeFile(path.join(tempRoot, "_workflow", "STATE.md"), "# State\nAs-is contract.\n", "utf8");
      await fs.writeFile(
        path.join(tempRoot, "_workflow", "READINESS.md"),
        [
          "# Readiness",
          "",
          "Status: active technical component readiness report",
          "Updated: 2026-07-28",
          "",
          "| ID | Component | Maturity | NorthStar role | Depends on | Current evidence | Main blocker | Default next bounded package | Done signal |",
          "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
          "| DOC-1 | Documentation contract | 3/4 | Keep workflow legible | none | Canonical docs exist | Needs direct workflow extraction | Add workflow summary | Agent can choose next package |",
          "| RETR-1 | Retrieval ergonomics | 3/4 | Reduce execution friction | DOC-1 | Knowledge profile exists | Summary is too shallow | Parse docs into workflow facts | Orientation query returns queue facts |",
          "",
        ].join("\n"),
        "utf8"
      );
      await fs.writeFile(
        path.join(tempRoot, "_workflow", "ROADMAP.md"),
        [
          "# Roadmap",
          "",
          "Status: active dependency-aware roadmap",
          "Updated: 2026-07-28",
          "",
          "| Priority | Item | Depends on | Why it matters now | Current action |",
          "| --- | --- | --- | --- | --- |",
          "| P0 | Refresh COMP-1A only on newer external client traffic | fresh evidence | Highest protocol gate remains event-gated | Wait for newer traffic |",
          "| P1 | Execute bounded DOC-2A fallback | P0 externally blocked | Keeps handoff cost low | Close one real orientation gap |",
          "",
        ].join("\n"),
        "utf8"
      );
      await fs.writeFile(path.join(tempRoot, "_workflow", "WORKFLOW_CANON.md"), "# Workflow Canon\nRules.\n", "utf8");
      await fs.writeFile(
        path.join(tempRoot, "_workflow", "ACTIVE_WORKFLOW_INDEX.md"),
        [
          "# Active Workflow Index",
          "",
          "Current queue.",
          "Default next package: COMP-1A is event-gated until newer external client traffic.",
          "Fallback: DOC-2A only when a real high-churn orientation gap appears.",
          "",
        ].join("\n"),
        "utf8"
      );
      await fs.writeFile(
        path.join(tempRoot, "_workflow", "state.json"),
        JSON.stringify({
          live_package_marker: "live-state-token",
          server_identity: {
            name: "mcp-tests-response-shape",
            version: "0.40.0",
            connector_shape_version: "2025-05-strict-v1",
            output_mode: "structured",
          },
          runtime_topology: {
            public: { port: 3009, expected_tool_count: 13 },
            authorized: { port: 3008, expected_tool_count: 84 },
          },
          tool_surfaces: {
            public_mcp_tools: { count: 13 },
            authorized_mcp_tools: { count: 71 },
            authenticated_total: { count: 84 },
          },
          workflow_progress_markers: {
            current_working_course: "initialize-retirement-evidence-wait",
            next_primary: "comp-1a-on-fresh-external-client-traffic",
            next_secondary: "bounded-doc-orientation-maintenance",
            stage_labels: ["Stage test"],
          },
          large_notes: Array.from({ length: 4000 }, (_, index) => `filler-${index}`),
        }, null, 2),
        "utf8"
      );
      await fs.mkdir(path.join(tempRoot, "_workflow", "operator_decisions"), { recursive: true });
      await fs.writeFile(
        path.join(tempRoot, "_workflow", "operator_decisions", "old_comp1a_blocked_decision.md"),
        [
          "# Old COMP-1A Blocked Decision",
          "",
          "Historical operator decision: current next recommended action and why COMP-1A is blocked.",
          "This old decision repeats current next recommended action blocked blocker workflow roadmap readiness terms many times.",
          "current next recommended action blocked blocker workflow roadmap readiness current next recommended action blocked blocker workflow roadmap readiness",
          "",
        ].join("\n"),
        "utf8"
      );
      await fs.writeFile(path.join(tempRoot, "SERVER_TOOLS_SPEC.json"), "{\"schema_version\":\"server-tools-spec\"}\n", "utf8");
      await fs.writeFile(path.join(tempRoot, "_workflow", "control_plane", "snapshots", "old", "_workflow", "state.json"), "{\"live_package_marker\":\"snapshot-state-token\"}\n", "utf8");
      await fs.mkdir(path.join(tempRoot, "_workflow", "control_plane", "records"), { recursive: true });
      await fs.writeFile(path.join(tempRoot, "_workflow", "control_plane", "records", "record.json"), "{\"control_plane_noise_token\":\"hidden-by-knowledge-profile\"}\n", "utf8");
      await fs.mkdir(path.join(tempRoot, "src"), { recursive: true });
      await fs.writeFile(
        path.join(tempRoot, "src", "client_entry_path_diagnostics.js"),
        "\"use strict\";\nmodule.exports = { value: 'followup_traffic_without_fresh_entry' };\n",
        "utf8"
      );

      const isolatedRoots = new Map([["work", tempRoot]]);
      const isolated = await buildWorkspaceIndex({
        roots: isolatedRoots,
        indexFile: isolatedIndexFile,
        max_files: 100,
        max_dirs: 100,
      });

      assert.equal(isolated.stats.skipped.directories >= 1, true);
      assert.equal(isolated.profile, "knowledge");
      assert.equal(isolated.docs.some((doc) => doc.path.endsWith(".js")), false);
      assert.equal(isolated.docs.some((doc) => doc.path.includes(".archive")), false);
      assert.equal(isolated.docs.some((doc) => doc.path.includes("_repos_with_code_samples")), false);
      assert.equal(isolated.docs.some((doc) => doc.path.includes("_workflow/control_plane/records")), false);
      assert.equal(isolated.docs.some((doc) => doc.path.includes("_workflow/control_plane/snapshots")), false);
      assert.ok(isolated.stats.knowledge_summary.by_kind.some((item) => item.name === "state"));
      assert.ok(isolated.stats.knowledge_summary.by_authority.some((item) => item.name === "source_of_truth"));
      assert.equal(isolated.stats.knowledge_summary.workflow_summary.health.has_northstar, true);
      assert.equal(isolated.stats.knowledge_summary.workflow_summary.health.has_state, true);
      assert.equal(isolated.stats.knowledge_summary.workflow_summary.health.has_readiness, true);
      assert.equal(isolated.stats.knowledge_summary.workflow_summary.health.has_roadmap, true);
      assert.equal(isolated.stats.knowledge_summary.workflow_summary.health.has_workflow_canon, true);
      assert.equal(isolated.stats.knowledge_summary.workflow_summary.runtime_identity.server_name, "mcp-tests-response-shape");
      assert.equal(isolated.stats.knowledge_summary.workflow_summary.runtime_identity.authenticated_total_tool_count, 84);
      assert.equal(isolated.stats.knowledge_summary.workflow_summary.workflow_markers.next_primary, "comp-1a-on-fresh-external-client-traffic");
      assert.equal(isolated.stats.knowledge_summary.workflow_summary.readiness.component_count, 2);
      assert.equal(isolated.stats.knowledge_summary.workflow_summary.readiness.components[1].id, "RETR-1");
      assert.equal(isolated.stats.knowledge_summary.workflow_summary.roadmap.item_count, 2);
      assert.equal(isolated.stats.knowledge_summary.workflow_summary.roadmap.items[0].priority, "P0");
      assert.equal(isolated.stats.knowledge_summary.workflow_summary.documentation_gaps.length, 0);

      const planningQuery = "what is the current next recommended action and why COMP-1A is blocked";
      const planningSearch = await searchIndex(planningQuery, {
        limit: 5,
        indexFile: isolatedIndexFile,
      });
      assert.equal(planningSearch.success, true);
      assert.deepEqual(planningSearch.results.slice(0, 3).map((item) => item.path), [
        "_workflow/ACTIVE_WORKFLOW_INDEX.md",
        "_workflow/READINESS.md",
        "_workflow/ROADMAP.md",
      ]);
      assert.notEqual(planningSearch.results[0].kind, "operator_decision");

      const stateSearch = await searchIndex("live_package_marker live-state-token", {
        limit: 10,
        indexFile: isolatedIndexFile,
        path: "_workflow",
      });
      assert.equal(stateSearch.success, true);
      assert.equal(stateSearch.results[0].path, "_workflow/state.json");
      assert.equal(stateSearch.results.some((item) => item.path.includes("_workflow/control_plane/snapshots")), false);

      const previousIndexFileForFilterTools = process.env.MCP_TEST_WORKSPACE_INDEX_FILE;
      process.env.MCP_TEST_WORKSPACE_INDEX_FILE = isolatedIndexFile;
      try {
        const filteredSearch = await searchIndexTool.execute({ query: "followup_traffic_without_fresh_entry", path: "docs", limit: 10 });
        assert.equal(filteredSearch.success, true);
        assert.equal(filteredSearch.index_scope.mode, "all_roots");
        assert.equal(filteredSearch.path_filter, "docs");
        assert.equal(filteredSearch.index_profile, "knowledge");
        assert.equal(filteredSearch.index_truncated, false);
        assert.equal(filteredSearch.index_count, isolated.docs.length);
        assert.equal(filteredSearch.results[0].kind, "document");
        assert.equal(filteredSearch.results[0].authority, "supporting");
        assert.equal(filteredSearch.results.every((item) => item.path.startsWith("docs/")), true);
        assert.equal(filteredSearch.results.some((item) => item.path === "docs/live.md"), true);

        const filteredContext = await searchIndexContextTool.execute({ query: "followup_traffic_without_fresh_entry", path: "docs", limit: 10 });
        assert.equal(filteredContext.success, true);
        assert.equal(filteredContext.index_scope.mode, "all_roots");
        assert.equal(filteredContext.path_filter, "docs");
        assert.equal(filteredContext.index_profile, "knowledge");
        assert.equal(filteredContext.index_truncated, false);
        assert.equal(filteredContext.index_count, isolated.docs.length);
        assert.equal(filteredContext.results[0].kind, "document");
        assert.equal(filteredContext.results.every((item) => item.path.startsWith("docs/")), true);

        const filteredCollect = await collectContextTool.execute({ query: "followup_traffic_without_fresh_entry", path: "docs", limit: 10 });
        assert.equal(filteredCollect.success, true);
        assert.equal(filteredCollect.index_scope.mode, "all_roots");
        assert.equal(filteredCollect.path_filter, "docs");
        assert.equal(filteredCollect.index_profile, "knowledge");
        assert.equal(filteredCollect.index_truncated, false);
        assert.equal(filteredCollect.index_count, isolated.docs.length);
        assert.equal(filteredCollect.files[0].kind, "document");
        assert.equal(filteredCollect.files.every((item) => item.path.startsWith("docs/")), true);

        const planningContext = await searchIndexContextTool.execute({
          query: planningQuery,
          limit: 5,
        });
        assert.equal(planningContext.success, true);
        assert.deepEqual(planningContext.results.slice(0, 3).map((item) => item.path), [
          "_workflow/ACTIVE_WORKFLOW_INDEX.md",
          "_workflow/READINESS.md",
          "_workflow/ROADMAP.md",
        ]);

        const planningCollect = await collectContextTool.execute({
          query: planningQuery,
          limit: 5,
          max_chars_per_file: 800,
        });
        assert.equal(planningCollect.success, true);
        assert.deepEqual(planningCollect.files.slice(0, 3).map((item) => item.path), [
          "_workflow/ACTIVE_WORKFLOW_INDEX.md",
          "_workflow/READINESS.md",
          "_workflow/ROADMAP.md",
        ]);

        const romionsimCollect = await collectRomionsimContextTool.execute({
          query: "romionsim_graph_context_token",
          path: "romionsim/docs",
          limit: 10,
        });
        assert.equal(romionsimCollect.success, true);
        assert.equal(romionsimCollect.index_scope.mode, "all_roots");
        assert.equal(romionsimCollect.path_filter, "romionsim/docs");
        assert.equal(romionsimCollect.index_profile, "knowledge");
        assert.equal(romionsimCollect.index_truncated, false);
        assert.equal(romionsimCollect.index_count, isolated.docs.length);
        assert.equal(romionsimCollect.files.length >= 1, true);
        assert.equal(romionsimCollect.files.every((item) => item.path.startsWith("romionsim/docs/")), true);
      } finally {
        if (previousIndexFileForFilterTools === undefined) delete process.env.MCP_TEST_WORKSPACE_INDEX_FILE;
        else process.env.MCP_TEST_WORKSPACE_INDEX_FILE = previousIndexFileForFilterTools;
      }

      const scoped = await buildWorkspaceIndex({
        roots: isolatedRoots,
        indexFile: isolatedIndexFile,
        path: "docs",
        max_files: 100,
        max_dirs: 100,
      });
      assert.equal(scoped.scope.path, "docs");
      assert.equal(scoped.scope.display_path, "docs");
      assert.equal(scoped.scope.mode, "directory");
      assert.equal(scoped.docs.some((doc) => doc.path === "docs/live.md"), true);
      assert.equal(scoped.docs.some((doc) => doc.path === "other/outside.md"), false);

      const previousIndexFileForScopedRomionsim = process.env.MCP_TEST_WORKSPACE_INDEX_FILE;
      process.env.MCP_TEST_WORKSPACE_INDEX_FILE = isolatedIndexFile;
      try {
        const scopedRomionsimCollect = await collectRomionsimContextTool.execute({
          query: "romionsim_graph_context_token",
          limit: 10,
        });
        assert.equal(scopedRomionsimCollect.success, true);
        assert.equal(scopedRomionsimCollect.index_scope.path, "docs");
        assert.equal(scopedRomionsimCollect.path_filter, "romionsim");
        assert.equal(scopedRomionsimCollect.index_profile, "knowledge");
        assert.equal(scopedRomionsimCollect.index_truncated, false);
        assert.equal(scopedRomionsimCollect.index_count, scoped.docs.length);
        assert.equal(scopedRomionsimCollect.count, 0);
      } finally {
        if (previousIndexFileForScopedRomionsim === undefined) delete process.env.MCP_TEST_WORKSPACE_INDEX_FILE;
        else process.env.MCP_TEST_WORKSPACE_INDEX_FILE = previousIndexFileForScopedRomionsim;
      }

      const liveSearch = await searchIndex("followup_traffic_without_fresh_entry", {
        limit: 10,
        indexFile: isolatedIndexFile,
      });
      assert.equal(liveSearch.success, true);
      assert.equal(liveSearch.results.length >= 1, true);
      assert.equal(liveSearch.results.some((item) => item.path.includes(".archive")), false);
      assert.equal(liveSearch.results[0].path, "docs/live.md");

      const outsideSearch = await searchIndex("scoped-only-token", {
        limit: 10,
        indexFile: isolatedIndexFile,
      });
      assert.equal(outsideSearch.success, true);
      assert.equal(outsideSearch.results.length, 0);

      const fixtureSearch = await searchIndex("sample-fixture-token", {
        limit: 10,
        indexFile: isolatedIndexFile,
      });
      assert.equal(fixtureSearch.success, true);
      assert.equal(fixtureSearch.results.length, 0);

      await fs.writeFile(
        path.join(tempRoot, "src", "initialize_response.js"),
        "\"use strict\";\n// client entry path diagnostics initialize response correlation followup_traffic_without_fresh_entry\n",
        "utf8"
      );

      await buildWorkspaceIndex({
        roots: isolatedRoots,
        indexFile: isolatedIndexFile,
        profile: "all",
        max_files: 100,
        max_dirs: 100,
      });

      const filenamePrioritySearch = await searchIndex("client_entry_path_diagnostics followup_traffic_without_fresh_entry initialize response correlation", {
        limit: 10,
        indexFile: isolatedIndexFile,
      });
      assert.equal(filenamePrioritySearch.success, true);
      assert.equal(filenamePrioritySearch.results[0].path, "src/client_entry_path_diagnostics.js");

      const largeFile = path.join(tempRoot, "docs", "large.md");
      const largeText = Array.from({ length: 4000 }, (_, index) => `line-${String(index + 1).padStart(4, "0")} ${"x".repeat(80)}`).join("\n");
      await fs.writeFile(largeFile, largeText, "utf8");

      const originalReadFile = fs.readFile;
      let blockedReads = 0;
      fs.readFile = async function blocked(filePath, ...rest) {
        if (path.resolve(String(filePath)) === path.resolve(largeFile)) {
          blockedReads += 1;
          throw new Error(`full read blocked for ${filePath}`);
        }
        return originalReadFile.call(this, filePath, ...rest);
      };

      try {
        const streamedIndex = await buildWorkspaceIndex({
          roots: isolatedRoots,
          indexFile: isolatedIndexFile,
          max_files: 100,
          max_dirs: 100,
        });
        const largeDoc = streamedIndex.docs.find((doc) => doc.path === "docs/large.md");
        assert.ok(largeDoc, "large doc should be indexed");
        assert.equal(largeDoc.sample.length, 12000);
        assert.equal(largeDoc.sample, largeText.slice(0, 12000));
        assert.equal(blockedReads, 0);
      } finally {
        fs.readFile = originalReadFile;
      }
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }

    await fs.writeFile(INDEX_FILE, "{not-json", "utf8");
    const corrupt = await indexStatusTool.execute();
    assert.equal(corrupt.status, "error");
    assert.equal(corrupt.success, false);
    assert.equal(corrupt.truncated, false);
    assert.equal(corrupt.visited_files, 0);
    assert.match(corrupt.error, /json|unexpected token|expected property name/i);
    console.log("smoke_build_index_tool ok");
  } finally {
    if (previous === undefined) delete process.env.MCP_TEST_WORKSPACE_INDEX_FILE;
    else process.env.MCP_TEST_WORKSPACE_INDEX_FILE = previous;
    await fs.rm(INDEX_FILE, { force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

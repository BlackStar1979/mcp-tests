const assert = require("node:assert/strict");
const { buildDependencyGraph, impactGraph } = require("../src/util/code_workspace");

(async () => {
  const graph = await buildDependencyGraph("src", true, 200);
  assert.equal(graph.truncated, false);
  assert.ok(graph.nodes.some((node) => node.path === "src/observability_status.js"));

  const scopedRelative = impactGraph(graph, "observability_status.js", "both", 5);
  assert.equal(scopedRelative.found, true);
  assert.equal(scopedRelative.target, "src/observability_status.js");
  assert.equal(scopedRelative.requested_target, "observability_status.js");
  assert.equal(scopedRelative.resolution, "relative_to_scan_scope");
  assert.ok(scopedRelative.attempted_targets.some((item) => item.target === "observability_status.js" && item.found === false));
  assert.ok(scopedRelative.attempted_targets.some((item) => item.target === "src/observability_status.js" && item.found === true));

  const workspaceRelative = impactGraph(graph, "src/observability_status.js", "both", 5);
  assert.equal(workspaceRelative.found, true);
  assert.equal(workspaceRelative.target, "src/observability_status.js");
  assert.equal(workspaceRelative.resolution, "as_provided_workspace_relative");

  const missing = impactGraph(graph, "not_real_file.js", "both", 5);
  assert.equal(missing.found, false);
  assert.equal(missing.requested_target, "not_real_file.js");
  assert.equal(missing.scope_path, "src");
  assert.equal(missing.maybe_truncated_graph, false);
  assert.equal(missing.target_not_found_reason, "target_not_in_scanned_graph");
  assert.ok(Array.isArray(missing.attempted_targets));
  assert.ok(missing.attempted_targets.some((item) => item.target === "not_real_file.js"));
  assert.ok(missing.attempted_targets.some((item) => item.target === "src/not_real_file.js"));
  assert.deepEqual(missing.suggested_targets, []);

  console.log("smoke_dev_code_impact_normalization ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});

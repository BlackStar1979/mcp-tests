const assert = require("node:assert/strict");
const { buildDependencyGraph, impactGraph } = require("../src/util/code_workspace");

(async () => {
  const graph = await buildDependencyGraph("src", { recursive: true, maxFiles: 200 });
  const target = "src/observability_status.js";

  const first = impactGraph(graph, target, "both", 5);
  const second = impactGraph(graph, target, "both", 5);

  assert.deepEqual(second, first);
  assert.equal(Object.keys(graph).includes("impactGraphCache"), false);
  assert.equal(JSON.stringify(graph).includes("impactGraphCache"), false);

  console.log("smoke_dev_code_impact_cache ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});

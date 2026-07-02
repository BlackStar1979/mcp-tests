const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ROOT = path.resolve(__dirname, "..");
const oldKeys = [
  "current_" + "work_" + "package",
  "completed_" + "work_" + "packages",
  "previous_" + "work_" + "package",
  "SERVER_" + "STAGE12.json",
];
const activeFiles = [];
for (const name of fs.readdirSync(ROOT)) {
  if (/^SERVER.*\.json$/.test(name)) activeFiles.push(path.join(ROOT, name));
}
for (const rel of ["_workflow/state.json", "_workflow/sessionless_inventory.json", "_workflow/README.md"]) {
  activeFiles.push(path.join(ROOT, rel));
}
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    const rel = path.relative(ROOT, p).replace(/\\/g, "/");
    if (rel.startsWith("_workflow/historical/")) continue;
    if (entry.isDirectory()) walk(p);
    else if (/\.(js|py|json|md)$/.test(entry.name)) activeFiles.push(p);
  }
}
walk(path.join(ROOT, "_tests"));
walk(path.join(ROOT, "_workflow", "scripts"));
for (const file of activeFiles) {
  const rel = path.relative(ROOT, file).replace(/\\/g, "/");
  const text = fs.readFileSync(file, "utf8");
  for (const key of oldKeys) {
    assert.equal(text.includes(key), false, `${rel} contains retired active token ${key}`);
  }
}
for (const [rel, forbidden] of [
  ["_workflow/operator_decisions/sessionless_sep2575_request_contract.md", "Proceed to an isolated S8 sessionless activation/regression run on a higher local port using the stricter SEP-2575 request contract."],
  ["_workflow/operator_decisions/isolated_sessionless_activation_regression.md", "Proceed to S9 OAuth21 3008 sessionless activation trial only if the operator wants live-load of the hidden route on the workbench server."],
  ["_workflow/operator_decisions/explicit_state_handle_design_rules.md", "Proceed to S4 parallel draft/sessionless runtime prototype behind a non-default route or mode, while keeping the current OAuth21 3008 stable-compatible connector route unchanged."],
  ["_workflow/operator_decisions/legacy_auth_cleanup_sessionless_ready_review.md", "Proceed to CRLF Batch Normalization if still desired. Current assessment: connector refresh is not required, OAuth21 3008 restart is not required, and public 3009 start is not required."],
  ["_workflow/operator_decisions/sessionless_runtime_prototype.md", "Proceed to Legacy Retired Auth Test Archive/Cleanup unless the operator explicitly requests S4 route activation testing with the prototype env flag."],
  ["_workflow/operator_decisions/sessionless_target_selection_preparation.md", "Operator should approve or reject the prepared target selection."],
  ["_workflow/operator_decisions/sessionless_inventory_truth_consolidation.md", "Proceed to S3 explicit state handle design rules unless the operator explicitly approves S4 parallel draft/sessionless runtime prototype."],
  ["_workflow/operator_decisions/oauth21_sessionless_activation_trial.md", "Historical next step at that time: proceed to S10 live authenticated SEP-2575 probes on OAuth21 3008, still without connector migration and without removing stable /mcp."],
  ["_workflow/operator_decisions/subscriptions_listen_isolated_validation.md", "Treat the current SSE-based implementation as transitional migration debt. The next bounded workflow step is to define the single-route, no-SSE, streamable-HTTP target contract and migration plan."]
]) {
  const text = fs.readFileSync(path.join(ROOT, rel), "utf8");
  assert.equal(text.includes(forbidden), false, `${rel} still contains an unqualified historical next-step imperative`);
}
console.log("smoke_no_progress_state_active_artifacts ok");

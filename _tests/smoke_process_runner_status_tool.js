const assert = require("node:assert/strict");

const { processRunnerStatusTool } = require("../tools/process_runner_status");

async function main() {
  const payload = await processRunnerStatusTool.execute({});

  assert.equal(processRunnerStatusTool.name, "process_runner_status");
  assert.equal(processRunnerStatusTool.descriptor.annotations.readOnlyHint, true);
  assert.equal(processRunnerStatusTool.descriptor.annotations.destructiveHint, false);
  assert.equal(payload.status, "ok");
  assert.ok(Array.isArray(payload.allowed_commands));
  assert.ok(payload.allowed_commands.includes("node"));
  assert.ok(payload.allowed_commands.includes("git"));
  assert.equal(typeof payload.defaults.timeout_ms, "number");
  assert.equal(typeof payload.defaults.max_timeout_ms, "number");
  assert.equal(payload.defaults.max_timeout_ms >= payload.defaults.timeout_ms, true);
  assert.equal(payload.env_policy.inherits_full_parent_env, false);
  assert.equal(payload.env_policy.caller_env_is_sanitized, true);
  assert.ok(Array.isArray(payload.env_policy.inherited_keys));
  assert.ok(payload.env_policy.inherited_keys.includes("PATH"));
  assert.ok(Array.isArray(payload.workspace_roots));
  assert.ok(payload.workspace_roots.length >= 1);
  assert.ok(payload.workspace_roots.some((entry) => entry.primary === true));

  console.log("smoke_process_runner_status_tool ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

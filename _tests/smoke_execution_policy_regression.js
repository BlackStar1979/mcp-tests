const assert = require("node:assert/strict");
const { assessExecution } = require("../src/plugin_execution");

function baseTool(overrides = {}) {
  return {
    name: "synthetic_plugin_tool",
    risk: "readonly-local",
    public_safe: true,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
    permissions: {
      network: false,
      fs: false,
      process: false,
      write: false,
      destructive: false,
    },
    execution: {
      handler_type: "builtin.echo.readonly.v1",
      dynamic_import: false,
      allowlisted: true,
      readonly_wrapper: true,
    },
    ...overrides,
  };
}

function basePlugin(overrides = {}) {
  return {
    plugin_id: "synthetic.policy",
    plugin_version: "0.0.0-test",
    status: "candidate",
    validation: { ok: true },
    ...overrides,
  };
}

function baseRegistry(overrides = {}) {
  return {
    ok: true,
    errors: [],
    ...overrides,
  };
}

function assess({ registry = baseRegistry(), plugin = basePlugin(), tool = baseTool() } = {}) {
  return assessExecution({ registry, plugin, tool });
}

function assertDenied(name, patch, expectedSubstring) {
  const result = assess({ tool: baseTool(patch.tool || {}), plugin: basePlugin(patch.plugin || {}), registry: baseRegistry(patch.registry || {}) });
  assert.equal(result.ok, false, `${name} must be denied`);
  assert.ok(result.errors.some((error) => error.includes(expectedSubstring)), `${name} missing expected error: ${expectedSubstring}; got ${result.errors.join(" | ")}`);
}

(function validControl() {
  const result = assess();
  assert.equal(result.ok, true);
  assert.equal(result.handler_type, "builtin.echo.readonly.v1");
  assert.deepEqual(result.errors, []);
})();

assertDenied("registry invalid", { registry: { ok: false, errors: ["bad registry"] } }, "registry is not valid");
assertDenied("plugin validation invalid", { plugin: { validation: { ok: false } } }, "plugin manifest validation failed");
assertDenied("plugin status disabled", { plugin: { status: "disabled" } }, "plugin status is not executable");
assertDenied("not public safe", { tool: { public_safe: false } }, "not public_safe");
assertDenied("network permission", { tool: { permissions: { network: true, fs: false, process: false, write: false, destructive: false } } }, "permission forbidden");
assertDenied("fs permission", { tool: { permissions: { network: false, fs: true, process: false, write: false, destructive: false } } }, "permission forbidden");
assertDenied("process permission", { tool: { permissions: { network: false, fs: false, process: true, write: false, destructive: false } } }, "permission forbidden");
assertDenied("write permission", { tool: { permissions: { network: false, fs: false, process: false, write: true, destructive: false } } }, "permission forbidden");
assertDenied("destructive permission", { tool: { permissions: { network: false, fs: false, process: false, write: false, destructive: true } } }, "permission forbidden");
assertDenied("dynamic import", { tool: { execution: { handler_type: "builtin.echo.readonly.v1", dynamic_import: true, allowlisted: true, readonly_wrapper: true } } }, "dynamic_import must be false");
assertDenied("unknown handler", { tool: { execution: { handler_type: "unknown.handler", dynamic_import: false, allowlisted: true, readonly_wrapper: true } } }, "handler type is not allowlisted");
assertDenied("not allowlisted", { tool: { execution: { handler_type: "builtin.echo.readonly.v1", dynamic_import: false, allowlisted: false, readonly_wrapper: true } } }, "allowlisted must be true");
assertDenied("not readonly wrapper", { tool: { execution: { handler_type: "builtin.echo.readonly.v1", dynamic_import: false, allowlisted: true, readonly_wrapper: false } } }, "readonly_wrapper must be true");
assertDenied("network risk", { tool: { risk: "network" } }, "risk is not readonly-local");
assertDenied("readOnly false", { tool: { annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false } } }, "not annotated read-only");
assertDenied("destructive hint true", { tool: { annotations: { readOnlyHint: true, destructiveHint: true, openWorldHint: false } } }, "destructiveHint must be false");
assertDenied("open world true", { tool: { annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true } } }, "openWorldHint must be false");

console.log("smoke_execution_policy_regression ok");

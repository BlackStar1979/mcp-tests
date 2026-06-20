const assert = require("node:assert/strict");
const {
  BUILTIN_READONLY_HANDLERS_VERSION,
  executeReadonlyHandler,
  getReadonlyHandlerMetadata,
  hasReadonlyHandler,
  listReadonlyHandlerTypes,
} = require("../src/plugin_readonly_handlers");
const {
  ALLOWED_READONLY_HANDLER_TYPES,
  executeReadonlyPlugin,
  getPluginExecutionGovernance,
  preflightPluginExecution,
} = require("../src/plugin_execution");

(async () => {
  assert.equal(BUILTIN_READONLY_HANDLERS_VERSION, "test-mcp-builtin-readonly-handlers-v1");

  const handlerTypes = listReadonlyHandlerTypes();
  assert.deepEqual(handlerTypes, ["builtin.echo.readonly.v1"]);
  assert.deepEqual([...ALLOWED_READONLY_HANDLER_TYPES].sort(), handlerTypes);
  assert.equal(hasReadonlyHandler("builtin.echo.readonly.v1"), true);
  assert.equal(hasReadonlyHandler("unknown.handler"), false);

  const meta = getReadonlyHandlerMetadata("builtin.echo.readonly.v1");
  assert.equal(meta.handler_type, "builtin.echo.readonly.v1");
  assert.equal(meta.risk, "readonly-local");
  assert.equal(meta.public_safe, true);
  assert.equal(meta.dynamic_import, false);
  assert.equal(meta.executes_plugin_file, false);
  assert.deepEqual(meta.permissions, { network: false, fs: false, process: false, write: false, destructive: false });

  const direct = executeReadonlyHandler("builtin.echo.readonly.v1", { text: "handler registry direct" });
  assert.equal(direct.success, true);
  assert.equal(direct.echo, "handler registry direct");

  const unknown = executeReadonlyHandler("unknown.handler", { text: "x" });
  assert.equal(unknown.success, false);
  assert.ok(unknown.error.includes("unsupported readonly handler"));

  const governance = getPluginExecutionGovernance();
  assert.equal(governance.success, true);
  assert.equal(governance.handler_registry_version, BUILTIN_READONLY_HANDLERS_VERSION);
  assert.deepEqual(governance.allowed_handler_types, handlerTypes);
  assert.equal(governance.handler_registry.length, 1);
  assert.equal(governance.handler_registry[0].handler_type, "builtin.echo.readonly.v1");
  assert.equal(governance.handler_registry[0].dynamic_import, false);
  assert.equal(governance.handler_registry[0].executes_plugin_file, false);

  const preflight = await preflightPluginExecution({ tool_name: "plugin_sample_echo_preview" });
  assert.equal(preflight.success, true);
  assert.equal(preflight.handler_type, "builtin.echo.readonly.v1");

  const executed = await executeReadonlyPlugin({ tool_name: "plugin_sample_echo_preview", text: "handler registry wrapper" });
  assert.equal(executed.success, true);
  assert.equal(executed.result.echo, "handler registry wrapper");
  assert.equal(executed.handler_type, "builtin.echo.readonly.v1");
  assert.equal(executed.dynamic_import_enabled, false);
  assert.equal(executed.plugin_execution_allowed, false);
  assert.equal(executed.real_tools_list_mutation_enabled, false);
  assert.equal(executed.list_changed_enabled, false);

  console.log("smoke_stage8_6_readonly_handler_registry ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});

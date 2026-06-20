const BUILTIN_READONLY_HANDLERS_VERSION = "test-mcp-builtin-readonly-handlers-v1";

const READONLY_HANDLER_REGISTRY = Object.freeze({
  "builtin.echo.readonly.v1": Object.freeze({
    handler_type: "builtin.echo.readonly.v1",
    title: "Built-in read-only echo handler",
    risk: "readonly-local",
    public_safe: true,
    dynamic_import: false,
    executes_plugin_file: false,
    permissions: Object.freeze({
      network: false,
      fs: false,
      process: false,
      write: false,
      destructive: false,
    }),
    execute(input = {}) {
      return { success: true, echo: String(input.text || ""), error: "" };
    },
  }),
});

function listReadonlyHandlerTypes() {
  return Object.keys(READONLY_HANDLER_REGISTRY).sort();
}

function hasReadonlyHandler(handlerType) {
  return Object.prototype.hasOwnProperty.call(READONLY_HANDLER_REGISTRY, String(handlerType || ""));
}

function getReadonlyHandlerMetadata(handlerType) {
  const handler = READONLY_HANDLER_REGISTRY[String(handlerType || "")];
  if (!handler) return null;
  return {
    handler_type: handler.handler_type,
    title: handler.title,
    risk: handler.risk,
    public_safe: handler.public_safe,
    dynamic_import: handler.dynamic_import,
    executes_plugin_file: handler.executes_plugin_file,
    permissions: { ...handler.permissions },
  };
}

function executeReadonlyHandler(handlerType, input = {}) {
  const handler = READONLY_HANDLER_REGISTRY[String(handlerType || "")];
  if (!handler) return { success: false, error: `unsupported readonly handler: ${handlerType}` };
  return handler.execute(input);
}

module.exports = {
  BUILTIN_READONLY_HANDLERS_VERSION,
  READONLY_HANDLER_REGISTRY,
  executeReadonlyHandler,
  getReadonlyHandlerMetadata,
  hasReadonlyHandler,
  listReadonlyHandlerTypes,
};

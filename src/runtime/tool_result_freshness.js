"use strict";

const toolsSpec = require("../../SERVER_TOOLS_SPEC.json");

const CACHE_DIRECTIVE = Object.freeze({
  ttlMs: 0,
  cacheScope: "private",
});

const FRESH_OPERATION_CLASSES = new Set([
  "read",
  "list",
  "search",
  "metadata",
  "stat",
  "head",
  "task_list",
]);

function resolveToolResultFreshness(toolName, spec = toolsSpec) {
  if (typeof toolName !== "string" || !toolName) {
    return null;
  }

  const entry = spec && spec.tool_catalog && spec.tool_catalog[toolName];
  if (!entry || !FRESH_OPERATION_CLASSES.has(entry.operation_class)) {
    return null;
  }

  return CACHE_DIRECTIVE;
}

module.exports = {
  resolveToolResultFreshness,
};

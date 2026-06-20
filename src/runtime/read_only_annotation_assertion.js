"use strict";

function assertReadOnlyAnnotations(tool) {
  const annotations = tool?.annotations || {};

  if (annotations.readOnlyHint !== true) {
    throw new Error(`${tool.name} readOnlyHint must be true`);
  }

  if (annotations.destructiveHint !== false) {
    throw new Error(`${tool.name} destructiveHint must be false`);
  }

  if (annotations.idempotentHint !== true) {
    throw new Error(`${tool.name} idempotentHint must be true`);
  }

  const expectedOpenWorld = String(tool?.name || "").startsWith("net_");

  if (annotations.openWorldHint !== expectedOpenWorld) {
    throw new Error(`${tool.name} openWorldHint must be ${expectedOpenWorld}`);
  }
}

module.exports = {
  assertReadOnlyAnnotations,
};

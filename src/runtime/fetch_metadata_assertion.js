"use strict";

function assertFetchMetadataRuntimeFields(metadata, options) {
  const {
    connectorShapeVersion,
    label,
    expectedKind = "",
    requireTextCapFields = false,
    connectorShapeVersionMessage = "",
  } = options || {};

  if (!metadata || typeof metadata !== "object") {
    throw new Error(`${label} metadata must be an object`);
  }

  if (expectedKind && metadata.kind !== expectedKind) {
    throw new Error(`${label} metadata.kind mismatch`);
  }

  if (metadata.connectorShapeVersion !== connectorShapeVersion) {
    throw new Error(connectorShapeVersionMessage || `${label} metadata connectorShapeVersion mismatch`);
  }

  if (!requireTextCapFields) {
    return;
  }

  if (typeof metadata.truncated !== "boolean") {
    throw new Error(`${label} metadata.truncated must be boolean`);
  }

  if (typeof metadata.original_chars !== "number") {
    throw new Error(`${label} metadata.original_chars must be number`);
  }

  if (typeof metadata.cap_chars !== "number") {
    throw new Error(`${label} metadata.cap_chars must be number`);
  }
}

module.exports = {
  assertFetchMetadataRuntimeFields,
};

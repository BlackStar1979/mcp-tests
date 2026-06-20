"use strict";

function assertFetchOutputSchemaStrict(schema) {
  const required = [...(schema?.required || [])].sort();
  const expected = ["id", "metadata", "text", "title", "url"];

  if (JSON.stringify(required) !== JSON.stringify(expected)) {
    throw new Error(`fetch output required keys mismatch: ${required.join(",")}`);
  }

  const metadataRequired = [...(schema?.properties?.metadata?.required || [])].sort();
  const expectedMetadata = [
    "cap_chars",
    "connectorShapeVersion",
    "kind",
    "original_chars",
    "source",
    "truncated",
  ];

  if (JSON.stringify(metadataRequired) !== JSON.stringify(expectedMetadata)) {
    throw new Error(`fetch metadata required keys mismatch: ${metadataRequired.join(",")}`);
  }
}

module.exports = {
  assertFetchOutputSchemaStrict,
};

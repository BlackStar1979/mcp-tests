"use strict";

function assertSearchOutputSchemaStrict(schema) {
  const itemSchema = schema?.properties?.results?.items;

  if (!itemSchema) {
    throw new Error("search outputSchema missing results.items");
  }

  if (itemSchema.additionalProperties !== false) {
    throw new Error("search result schema must reject additional properties");
  }

  const required = [...(itemSchema.required || [])].sort();
  const expected = ["id", "title", "url"];

  if (JSON.stringify(required) !== JSON.stringify(expected)) {
    throw new Error(`search result required keys mismatch: ${required.join(",")}`);
  }

  const properties = itemSchema.properties || {};

  for (const key of expected) {
    if (!properties[key]) {
      throw new Error(`search result schema missing property: ${key}`);
    }
  }

  if (Object.prototype.hasOwnProperty.call(properties, "text")) {
    throw new Error("search result schema must not expose text/snippet");
  }

  if (Object.prototype.hasOwnProperty.call(properties, "snippet")) {
    throw new Error("search result schema must not expose snippet");
  }
}

module.exports = {
  assertSearchOutputSchemaStrict,
};

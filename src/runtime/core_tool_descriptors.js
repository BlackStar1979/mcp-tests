"use strict";

const { maybeOutputSchema } = require("./output_schema_helpers");

const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

const SEARCH_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["results"],
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "title", "url"],
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          url: { type: "string" },
        },
      },
    },
  },
};

const FETCH_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["id", "title", "text", "url", "metadata"],
  properties: {
    id: { type: "string" },
    title: { type: "string" },
    text: { type: "string" },
    url: { type: "string" },
    metadata: {
      type: "object",
      additionalProperties: true,
      required: [
        "source",
        "kind",
        "connectorShapeVersion",
        "truncated",
        "original_chars",
        "cap_chars",
      ],
      properties: {
        source: { type: "string" },
        kind: { type: "string" },
        connectorShapeVersion: { type: "string" },
        truncated: { type: "boolean" },
        original_chars: { type: "integer", minimum: 0 },
        cap_chars: { type: "integer", minimum: 0 },
      },
    },
  },
};

function buildCoreToolDescriptors({ connectorShapeVersion, outputMode, maxFetchTextChars }) {
  return [
    {
      name: "search",
      title: "Search MCP test documents",
      description:
        `Search test documents. Connector shape ${connectorShapeVersion}. ` +
        `Output mode: ${outputMode}. Returns top-level results[] with id/title/url only.`,
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query.",
          },
        },
        required: ["query"],
        additionalProperties: false,
      },
      ...maybeOutputSchema(outputMode, SEARCH_OUTPUT_SCHEMA),
      annotations: READ_ONLY_ANNOTATIONS,
    },
    {
      name: "fetch",
      title: "Fetch MCP test document",
      description:
        `Fetch one test document by id. Connector shape ${connectorShapeVersion}. ` +
        `Output mode: ${outputMode}. Text is capped at ${maxFetchTextChars} characters.`,
      inputSchema: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Document id returned by search.",
          },
        },
        required: ["id"],
        additionalProperties: false,
      },
      ...maybeOutputSchema(outputMode, FETCH_OUTPUT_SCHEMA),
      annotations: READ_ONLY_ANNOTATIONS,
    },
  ];
}

module.exports = {
  buildCoreToolDescriptors,
  FETCH_OUTPUT_SCHEMA,
  READ_ONLY_ANNOTATIONS,
  SEARCH_OUTPUT_SCHEMA,
};

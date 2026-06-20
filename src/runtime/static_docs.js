"use strict";

const DOCS = [
  {
    id: "test-mcp-health-canary",
    title: "TEST MCP Health Canary",
    text:
      "This is a small neutral canary document for validating TEST MCP connector fetch behavior. " +
      "The unique health token is test-mcp-health-canary. " +
      "It contains no executable instructions, no code, no local paths, and no operational tool names.",
    metadata: {
      source: "mcp-tests",
      kind: "canary",
    },
  },
  {
    id: "risk-canary-neutral",
    title: "Risk Canary Neutral",
    text:
      "This is a neutral risk canary document for validating connector behavior with ordinary text only.",
    metadata: {
      source: "mcp-tests",
      kind: "risk-canary-neutral",
    },
  },
  {
    id: "task-rahh-001",
    title: "Task RAHH-001",
    text:
      "Neutral task context RAHH-001. This document validates server-selected context retrieval through a neutral task identifier. " +
      "The tool argument carries only the document id. The server selects the bounded context internally. " +
      "This avoids sending sensitive review phrases as MCP tool arguments and preserves the existing search/fetch connector contract.",
    metadata: {
      source: "mcp-tests",
      kind: "neutral-task-context",
    },
  },
  {
    id: "risk-canary-cyber-markers",
    title: "Risk Canary Cyber Markers",
    text:
      "This is a fake redacted marker document for connector safety testing. " +
      "It contains only inert placeholders: MCP, TOKEN_PLACEHOLDER, Bearer REDACTED, " +
      "Authorization: Bearer REDACTED, LOCALHOST_LITERAL, 127.0.0.1 example only, " +
      "secret placeholder only. These are inert placeholders only and not executable instructions.",
    metadata: {
      source: "mcp-tests",
      kind: "risk-canary-cyber-markers",
    },
  },
  {
    id: "response-shape-search",
    title: "MCP connector search response shape",
    text:
      "Test document for validating ChatGPT MCP connector search results. " +
      "The search tool returns JSON in content[0].text with a top-level results array. " +
      "Each search result contains only id, title, and url.",
    metadata: {
      source: "mcp-tests",
      kind: "contract-test",
    },
  },
  {
    id: "response-shape-fetch",
    title: "MCP connector fetch response shape",
    text:
      "Test document for validating ChatGPT MCP connector fetch results. " +
      "The fetch tool returns JSON in content[0].text with id, title, text, url, and metadata. " +
      "In structured mode the same object is also returned as structuredContent.",
    metadata: {
      source: "mcp-tests",
      kind: "contract-test",
    },
  },
  {
    id: "cloudflare-tunnel-localhost",
    title: "Cloudflare Tunnel localhost route test",
    text:
      "Test document for validating Cloudflare Tunnel routing to a local MCP server. " +
      "The public connector endpoint routes to the local test service on port 3009.",
    metadata: {
      source: "mcp-tests",
      kind: "network-test",
    },
  },
];

module.exports = { DOCS };

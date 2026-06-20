"use strict";

const {
  MEMORY_READ_ANNOTATIONS,
  MEMORY_SEARCH_INPUT_SCHEMA,
  MEMORY_SEARCH_OUTPUT_SCHEMA,
} = require("../src/schemas/memory_tools");
const { searchMemory } = require("../src/memory/memory_store");

const TOOL_NAME = "memory_search";

async function execute(args = {}) {
  try {
    const query      = String(args.query || "").trim();
    const agent_name = args.agent_name ? String(args.agent_name).trim() : undefined;
    const top_k      = Number.isInteger(args.top_k)    ? args.top_k    : 5;
    const min_score  = typeof args.min_score === "number" ? args.min_score : 0.1;

    if (query.length < 2) return { success: false, results: [], total_searched: 0, error: "query must be at least 2 characters" };

    const { results, total_searched } = await searchMemory({ query, agent_name, top_k, min_score });

    // Normalise output shape to match MEMORY_ENTRY_SCHEMA (drop is_archived)
    const clean = results.map(({ id, agent_name: an, type, content, category, score, created_at }) => ({
      id, agent_name: an, type, content, category: category || "", score, created_at,
    }));

    return { success: true, results: clean, total_searched, error: "" };
  } catch (error) {
    return { success: false, results: [], total_searched: 0, error: error?.message || String(error) };
  }
}

const memorySearchTool = {
  name: TOOL_NAME,
  descriptor: {
    name:        TOOL_NAME,
    title:       "Search agent memory",
    description: "Keyword search over the shared agent memory store. " +
                 "Results are ranked by term-overlap score (0–1). " +
                 "Use this at the start of a session to retrieve context from a previous agent's work.",
    inputSchema:  MEMORY_SEARCH_INPUT_SCHEMA,
    outputSchema: MEMORY_SEARCH_OUTPUT_SCHEMA,
    annotations:  MEMORY_READ_ANNOTATIONS,
  },
  execute,
  summarizeArgs(args = {}) {
    const agent = args.agent_name ? `[${args.agent_name}] ` : "";
    return `${agent}${String(args.query || "").slice(0, 80)}`;
  },
  resultStats(payload = {}) {
    return {
      result_count: payload.results?.length ?? 0,
      result_chars: (payload.results || []).reduce((n, r) => n + r.content.length, 0),
    };
  },
};

module.exports = { memorySearchTool };

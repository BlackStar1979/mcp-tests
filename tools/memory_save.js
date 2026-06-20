"use strict";

const {
  MEMORY_WRITE_ANNOTATIONS,
  MEMORY_SAVE_INPUT_SCHEMA,
  MEMORY_SAVE_OUTPUT_SCHEMA,
} = require("../src/schemas/memory_tools");
const { saveMemory } = require("../src/memory/memory_store");

const TOOL_NAME = "memory_save";

async function execute(args = {}) {
  try {
    const agent_name = String(args.agent_name || "").trim();
    const content    = String(args.content    || "").trim();
    const type       = String(args.type       || "fact").trim();
    const category   = String(args.category   || "").trim();

    if (!agent_name) return { success: false, id: "", error: "agent_name is required" };
    if (content.length < 10) return { success: false, id: "", error: "content must be at least 10 characters" };

    const VALID_TYPES = new Set(["fact", "experience", "conclusion", "error"]);
    if (!VALID_TYPES.has(type)) return { success: false, id: "", error: `Invalid type: ${type}` };

    const entry = await saveMemory({ agent_name, content, type, category });
    return { success: true, id: entry.id, error: "" };
  } catch (error) {
    return { success: false, id: "", error: error?.message || String(error) };
  }
}

const memorySaveTool = {
  name: TOOL_NAME,
  descriptor: {
    name:        TOOL_NAME,
    title:       "Save agent memory",
    description: "Append a typed memory entry to the shared agent memory store. " +
                 "Use at the end of a session to persist facts, experiences, conclusions, or errors " +
                 "so other agents can retrieve them later via memory_search.",
    inputSchema:  MEMORY_SAVE_INPUT_SCHEMA,
    outputSchema: MEMORY_SAVE_OUTPUT_SCHEMA,
    annotations:  MEMORY_WRITE_ANNOTATIONS,
  },
  execute,
  summarizeArgs(args = {}) {
    return `${args.agent_name || "?"}/${args.type || "fact"}: ${String(args.content || "").slice(0, 72)}`;
  },
  resultStats(payload = {}) {
    return { result_count: payload.success ? 1 : 0, result_chars: 0 };
  },
};

module.exports = { memorySaveTool };

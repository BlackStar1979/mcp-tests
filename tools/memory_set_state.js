"use strict";

const {
  MEMORY_WRITE_ANNOTATIONS,
  MEMORY_SET_STATE_INPUT_SCHEMA,
  MEMORY_SET_STATE_OUTPUT_SCHEMA,
} = require("../src/schemas/memory_tools");
const { setAgentState } = require("../src/memory/memory_store");

const TOOL_NAME = "memory_set_state";

async function execute(args = {}) {
  try {
    const agent_name = String(args.agent_name || "").trim();
    if (!agent_name) return { success: false, agent_name: "", error: "agent_name is required" };

    const fields = {
      session_id:   args.session_id   != null ? String(args.session_id).trim()   : undefined,
      current_task: args.current_task != null ? String(args.current_task).trim()  : undefined,
      context:      args.context      != null && typeof args.context === "object"
                      ? args.context
                      : undefined,
    };

    await setAgentState(agent_name, fields);
    return { success: true, agent_name, error: "" };
  } catch (error) {
    return { success: false, agent_name: String(args.agent_name || ""), error: error?.message || String(error) };
  }
}

const memorySetStateTool = {
  name: TOOL_NAME,
  descriptor: {
    name:        TOOL_NAME,
    title:       "Set agent state",
    description: "Upsert the current state for a given agent. " +
                 "Call this at session start (with the active task) and at /end_session (to record final context). " +
                 "Omitted fields are preserved from the previous state.",
    inputSchema:  MEMORY_SET_STATE_INPUT_SCHEMA,
    outputSchema: MEMORY_SET_STATE_OUTPUT_SCHEMA,
    annotations:  MEMORY_WRITE_ANNOTATIONS,
  },
  execute,
  summarizeArgs(args = {}) {
    return `${args.agent_name || "?"} → ${String(args.current_task || "(no task)").slice(0, 60)}`;
  },
  resultStats(payload = {}) {
    return { result_count: payload.success ? 1 : 0, result_chars: 0 };
  },
};

module.exports = { memorySetStateTool };

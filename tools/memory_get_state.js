"use strict";

const {
  MEMORY_READ_ANNOTATIONS,
  MEMORY_GET_STATE_INPUT_SCHEMA,
  MEMORY_STATE_OUTPUT_SCHEMA,
} = require("../src/schemas/memory_tools");
const { getAgentState } = require("../src/memory/memory_store");

const TOOL_NAME = "memory_get_state";

const EMPTY_STATE = {
  success: true, found: false, agent_name: "", session_id: "",
  current_task: "", context: {}, updated_at: "", error: "",
};

async function execute(args = {}) {
  try {
    const agent_name = String(args.agent_name || "").trim();
    if (!agent_name) return { ...EMPTY_STATE, success: false, error: "agent_name is required" };

    const state = await getAgentState(agent_name);
    if (!state) return { ...EMPTY_STATE, found: false, agent_name };

    return {
      success:      true,
      found:        true,
      agent_name:   state.agent_name,
      session_id:   state.session_id   || "",
      current_task: state.current_task || "",
      context:      state.context      || {},
      updated_at:   state.updated_at   || "",
      error:        "",
    };
  } catch (error) {
    return { ...EMPTY_STATE, success: false, error: error?.message || String(error) };
  }
}

const memoryGetStateTool = {
  name: TOOL_NAME,
  descriptor: {
    name:        TOOL_NAME,
    title:       "Get agent state",
    description: "Read the last saved state for a given agent — current task, session ID, and context metadata. " +
                 "Use this when switching agents to pick up where the previous agent left off.",
    inputSchema:  MEMORY_GET_STATE_INPUT_SCHEMA,
    outputSchema: MEMORY_STATE_OUTPUT_SCHEMA,
    annotations:  MEMORY_READ_ANNOTATIONS,
  },
  execute,
  summarizeArgs(args = {}) {
    return String(args.agent_name || "?");
  },
  resultStats(payload = {}) {
    return { result_count: payload.found ? 1 : 0, result_chars: 0 };
  },
};

module.exports = { memoryGetStateTool };

"use strict";

const {
  MEMORY_WRITE_ANNOTATIONS,
  MEMORY_UPDATE_TASK_INPUT_SCHEMA,
  MEMORY_UPDATE_TASK_OUTPUT_SCHEMA,
} = require("../src/schemas/memory_tools");
const { updateTask } = require("../src/memory/memory_store");

const TOOL_NAME = "memory_update_task";
const VALID_STATUSES = new Set(["pending", "in_progress", "done", "cancelled"]);

async function execute(args = {}) {
  try {
    const taskId = String(args.task_id || "").trim();
    const updatedBy = String(args.updated_by || "").trim();
    const status = String(args.status || "").trim();

    if (!taskId) return { success: false, id: "", status: "", previous_status: "", error: "task_id is required" };
    if (!updatedBy) return { success: false, id: taskId, status: "", previous_status: "", error: "updated_by is required" };
    if (!VALID_STATUSES.has(status)) {
      return { success: false, id: taskId, status: "", previous_status: "", error: `Invalid status: ${status}` };
    }

    const result = await updateTask({ task_id: taskId, updated_by: updatedBy, status });
    if (!result) {
      return { success: false, id: taskId, status: "", previous_status: "", error: "task_not_found" };
    }
    return {
      success: true,
      id: result.task.id,
      status: result.task.status,
      previous_status: result.previous_status,
      error: "",
    };
  } catch (error) {
    return { success: false, id: "", status: "", previous_status: "", error: error?.message || String(error) };
  }
}

const memoryUpdateTaskTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Update agent task",
    description: "Update the lifecycle status of an existing shared task. " +
                 "The store appends a provenance-bearing snapshot and memory_get_tasks resolves the latest snapshot by task id.",
    inputSchema: MEMORY_UPDATE_TASK_INPUT_SCHEMA,
    outputSchema: MEMORY_UPDATE_TASK_OUTPUT_SCHEMA,
    annotations: MEMORY_WRITE_ANNOTATIONS,
  },
  execute,
  summarizeArgs(args = {}) {
    return `${String(args.task_id || "?").slice(0, 12)} → ${args.status || "?"} by ${args.updated_by || "?"}`;
  },
  resultStats(payload = {}) {
    return { result_count: payload.success ? 1 : 0, result_chars: 0 };
  },
};

module.exports = { memoryUpdateTaskTool };

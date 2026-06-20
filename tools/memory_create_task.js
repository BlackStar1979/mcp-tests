"use strict";

const {
  MEMORY_WRITE_ANNOTATIONS,
  MEMORY_CREATE_TASK_INPUT_SCHEMA,
  MEMORY_CREATE_TASK_OUTPUT_SCHEMA,
} = require("../src/schemas/memory_tools");
const { createTask } = require("../src/memory/memory_store");

const TOOL_NAME = "memory_create_task";

async function execute(args = {}) {
  try {
    const created_by  = String(args.created_by  || "").trim();
    const title       = String(args.title        || "").trim();
    const assigned_to = String(args.assigned_to  || "").trim();
    const description = String(args.description  || "").trim();
    const priority    = Number.isInteger(args.priority) ? args.priority : 5;

    if (!created_by) return { success: false, id: "", error: "created_by is required" };
    if (title.length < 3) return { success: false, id: "", error: "title must be at least 3 characters" };
    if (priority < 1 || priority > 10) return { success: false, id: "", error: "priority must be 1–10" };

    const task = await createTask({ created_by, assigned_to, title, description, priority });
    return { success: true, id: task.id, error: "" };
  } catch (error) {
    return { success: false, id: "", error: error?.message || String(error) };
  }
}

const memoryCreateTaskTool = {
  name: TOOL_NAME,
  descriptor: {
    name:        TOOL_NAME,
    title:       "Create agent task",
    description: "Add a task to the shared task queue for another agent (or any agent) to pick up. " +
                 "Use this at /end_session to hand off unfinished work. " +
                 "The receiving agent reads tasks with memory_get_tasks.",
    inputSchema:  MEMORY_CREATE_TASK_INPUT_SCHEMA,
    outputSchema: MEMORY_CREATE_TASK_OUTPUT_SCHEMA,
    annotations:  MEMORY_WRITE_ANNOTATIONS,
  },
  execute,
  summarizeArgs(args = {}) {
    const to = args.assigned_to ? `→${args.assigned_to}` : "→any";
    return `${args.created_by || "?"}${to}: ${String(args.title || "").slice(0, 60)}`;
  },
  resultStats(payload = {}) {
    return { result_count: payload.success ? 1 : 0, result_chars: 0 };
  },
};

module.exports = { memoryCreateTaskTool };

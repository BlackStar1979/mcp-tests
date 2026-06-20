"use strict";

const {
  MEMORY_READ_ANNOTATIONS,
  MEMORY_GET_TASKS_INPUT_SCHEMA,
  MEMORY_GET_TASKS_OUTPUT_SCHEMA,
} = require("../src/schemas/memory_tools");
const { getTasks } = require("../src/memory/memory_store");

const TOOL_NAME = "memory_get_tasks";

async function execute(args = {}) {
  try {
    const assigned_to = args.assigned_to ? String(args.assigned_to).trim() : undefined;
    const status      = String(args.status || "pending").trim();
    const limit       = Number.isInteger(args.limit) ? args.limit : 20;

    const VALID_STATUSES = new Set(["pending", "in_progress", "done", "cancelled"]);
    if (!VALID_STATUSES.has(status)) return { success: false, tasks: [], total: 0, error: `Invalid status: ${status}` };

    const tasks = await getTasks({ assigned_to, status, limit });

    // Normalise: ensure all required fields present
    const clean = tasks.map((t) => ({
      id:          t.id          || "",
      created_by:  t.created_by  || "",
      assigned_to: t.assigned_to || "",
      title:       t.title       || "",
      description: t.description || "",
      priority:    t.priority    || 5,
      status:      t.status      || "pending",
      created_at:  t.created_at  || "",
    }));

    return { success: true, tasks: clean, total: clean.length, error: "" };
  } catch (error) {
    return { success: false, tasks: [], total: 0, error: error?.message || String(error) };
  }
}

const memoryGetTasksTool = {
  name: TOOL_NAME,
  descriptor: {
    name:        TOOL_NAME,
    title:       "Get agent tasks",
    description: "Read pending (or other status) tasks from the shared task queue. " +
                 "Results include tasks assigned to the requesting agent plus unassigned tasks. " +
                 "Sorted by priority (high first), then by creation time (newest first).",
    inputSchema:  MEMORY_GET_TASKS_INPUT_SCHEMA,
    outputSchema: MEMORY_GET_TASKS_OUTPUT_SCHEMA,
    annotations:  MEMORY_READ_ANNOTATIONS,
  },
  execute,
  summarizeArgs(args = {}) {
    const who = args.assigned_to || "all";
    return `assigned_to=${who} status=${args.status || "pending"}`;
  },
  resultStats(payload = {}) {
    return { result_count: payload.total ?? 0, result_chars: 0 };
  },
};

module.exports = { memoryGetTasksTool };

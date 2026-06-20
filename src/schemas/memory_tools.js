"use strict";

// ── Annotations ──────────────────────────────────────────────────────────────

const MEMORY_READ_ANNOTATIONS = {
  readOnlyHint:    true,
  destructiveHint: false,
  idempotentHint:  true,
  openWorldHint:   false,
};

const MEMORY_WRITE_ANNOTATIONS = {
  readOnlyHint:    false,
  destructiveHint: false,
  idempotentHint:  false,
  openWorldHint:   false,
};

// ── Shared property definitions ───────────────────────────────────────────────

const AGENT_NAME_PROP = {
  type: "string",
  minLength: 1,
  maxLength: 64,
  pattern: "^[a-z0-9_-]+$",
  description: "Agent identifier, e.g. 'claude_code', 'hermes', 'codex'.",
};

const MEMORY_TYPE_ENUM = ["fact", "experience", "conclusion", "error"];

// ── Input schemas ─────────────────────────────────────────────────────────────

const MEMORY_SAVE_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["agent_name", "content"],
  properties: {
    agent_name: AGENT_NAME_PROP,
    content: {
      type: "string",
      minLength: 10,
      maxLength: 4096,
      description: "The memory text to store.",
    },
    type: {
      type: "string",
      enum: MEMORY_TYPE_ENUM,
      default: "fact",
      description: "Memory classification: fact, experience, conclusion, or error.",
    },
    category: {
      type: "string",
      maxLength: 64,
      description: "Optional topic label, e.g. 'leads', 'infra', 'client'.",
    },
  },
};

const MEMORY_SEARCH_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["query"],
  properties: {
    query: {
      type: "string",
      minLength: 2,
      maxLength: 512,
      description: "Natural-language query. Scored by term overlap against stored content.",
    },
    agent_name: {
      ...AGENT_NAME_PROP,
      description: "Restrict results to one agent. Omit to search all agents.",
    },
    top_k: {
      type: "integer",
      minimum: 1,
      maximum: 20,
      default: 5,
      description: "Maximum number of results to return.",
    },
    min_score: {
      type: "number",
      minimum: 0,
      maximum: 1,
      default: 0.1,
      description: "Minimum relevance score (0–1) for a result to be included.",
    },
  },
};

const MEMORY_GET_STATE_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["agent_name"],
  properties: {
    agent_name: AGENT_NAME_PROP,
  },
};

const MEMORY_SET_STATE_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["agent_name"],
  properties: {
    agent_name:   AGENT_NAME_PROP,
    session_id:   { type: "string", maxLength: 128, description: "Current session identifier." },
    current_task: { type: "string", maxLength: 512,  description: "Short description of the active task." },
    context:      { type: "object", additionalProperties: true, description: "Arbitrary session metadata (JSON object)." },
  },
};

const MEMORY_CREATE_TASK_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["created_by", "title"],
  properties: {
    created_by:  AGENT_NAME_PROP,
    assigned_to: { ...AGENT_NAME_PROP, description: "Target agent. Omit to leave unassigned." },
    title:       { type: "string", minLength: 3, maxLength: 256, description: "Short task title." },
    description: { type: "string", maxLength: 2048, description: "Full task description." },
    priority:    { type: "integer", minimum: 1, maximum: 10, default: 5, description: "Priority 1 (low) – 10 (critical)." },
  },
};

const MEMORY_GET_TASKS_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [],
  properties: {
    assigned_to: { ...AGENT_NAME_PROP, description: "Filter by assignee. Omit for all matching tasks." },
    status: {
      type: "string",
      enum: ["pending", "in_progress", "done", "cancelled"],
      default: "pending",
    },
    limit: { type: "integer", minimum: 1, maximum: 50, default: 20 },
  },
};

// ── Output schemas ────────────────────────────────────────────────────────────

const MEMORY_SAVE_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["success", "id", "error"],
  properties: {
    success: { type: "boolean" },
    id:      { type: "string" },
    error:   { type: "string" },
  },
};

const MEMORY_ENTRY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["id", "agent_name", "type", "content", "category", "score", "created_at"],
  properties: {
    id:         { type: "string" },
    agent_name: { type: "string" },
    type:       { type: "string" },
    content:    { type: "string" },
    category:   { type: "string" },
    score:      { type: "number" },
    created_at: { type: "string" },
  },
};

const MEMORY_SEARCH_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["success", "results", "total_searched", "error"],
  properties: {
    success:        { type: "boolean" },
    results:        { type: "array", items: MEMORY_ENTRY_SCHEMA },
    total_searched: { type: "integer" },
    error:          { type: "string" },
  },
};

const MEMORY_STATE_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["success", "found", "agent_name", "session_id", "current_task", "context", "updated_at", "error"],
  properties: {
    success:      { type: "boolean" },
    found:        { type: "boolean" },
    agent_name:   { type: "string" },
    session_id:   { type: "string" },
    current_task: { type: "string" },
    context:      { type: "object", additionalProperties: true },
    updated_at:   { type: "string" },
    error:        { type: "string" },
  },
};

const MEMORY_SET_STATE_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["success", "agent_name", "error"],
  properties: {
    success:    { type: "boolean" },
    agent_name: { type: "string" },
    error:      { type: "string" },
  },
};

const TASK_ITEM_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["id", "created_by", "assigned_to", "title", "description", "priority", "status", "created_at"],
  properties: {
    id:          { type: "string" },
    created_by:  { type: "string" },
    assigned_to: { type: "string" },
    title:       { type: "string" },
    description: { type: "string" },
    priority:    { type: "integer" },
    status:      { type: "string" },
    created_at:  { type: "string" },
  },
};

const MEMORY_CREATE_TASK_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["success", "id", "error"],
  properties: {
    success: { type: "boolean" },
    id:      { type: "string" },
    error:   { type: "string" },
  },
};

const MEMORY_GET_TASKS_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["success", "tasks", "total", "error"],
  properties: {
    success: { type: "boolean" },
    tasks:   { type: "array", items: TASK_ITEM_SCHEMA },
    total:   { type: "integer" },
    error:   { type: "string" },
  },
};

module.exports = {
  MEMORY_READ_ANNOTATIONS,
  MEMORY_WRITE_ANNOTATIONS,
  MEMORY_SAVE_INPUT_SCHEMA,
  MEMORY_SAVE_OUTPUT_SCHEMA,
  MEMORY_SEARCH_INPUT_SCHEMA,
  MEMORY_SEARCH_OUTPUT_SCHEMA,
  MEMORY_GET_STATE_INPUT_SCHEMA,
  MEMORY_STATE_OUTPUT_SCHEMA,
  MEMORY_SET_STATE_INPUT_SCHEMA,
  MEMORY_SET_STATE_OUTPUT_SCHEMA,
  MEMORY_CREATE_TASK_INPUT_SCHEMA,
  MEMORY_CREATE_TASK_OUTPUT_SCHEMA,
  MEMORY_GET_TASKS_INPUT_SCHEMA,
  MEMORY_GET_TASKS_OUTPUT_SCHEMA,
};

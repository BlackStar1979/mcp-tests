"use strict";

const fs = require("node:fs");
const path = require("node:path");

const TOOL_SURFACE_STATE_VERSION = "test-mcp-tool-surface-state-v1";

function defaultToolSurfaceStateFile(rootDir = process.cwd()) {
  return path.join(rootDir, "_control", "tool-surface-state.json");
}

function normalizeSurface(surface = {}) {
  return {
    tool_count: Number.isInteger(surface.tool_count) ? surface.tool_count : 0,
    tool_names_hash: String(surface.tool_names_hash || ""),
    input_schema_fingerprint: String(surface.input_schema_fingerprint || ""),
    output_schema_fingerprint: String(surface.output_schema_fingerprint || ""),
    descriptor_fingerprint: String(surface.descriptor_fingerprint || ""),
    combined_fingerprint: String(surface.combined_fingerprint || ""),
  };
}

function readPreviousState(stateFile) {
  if (!stateFile || !fs.existsSync(stateFile)) return { exists: false, state: null, error: "" };
  try {
    return { exists: true, state: JSON.parse(fs.readFileSync(stateFile, "utf8")), error: "" };
  } catch (error) {
    return { exists: true, state: null, error: error?.message || String(error) };
  }
}

function writeCurrentState(stateFile, state) {
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  const tmp = `${stateFile}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  fs.renameSync(tmp, stateFile);
}

function evaluateToolSurfaceState({ stateFile, currentSurface, serverStartId = "", auditLog, now = () => new Date().toISOString() } = {}) {
  const current = normalizeSurface(currentSurface);
  const read = readPreviousState(stateFile);
  const previousSurface = read.state && typeof read.state === "object" ? normalizeSurface(read.state.current_surface || read.state.surface || {}) : null;
  const hadPrevious = Boolean(read.exists && previousSurface && previousSurface.combined_fingerprint);
  const changed = Boolean(hadPrevious && previousSurface.combined_fingerprint !== current.combined_fingerprint);
  const result = {
    state_version: TOOL_SURFACE_STATE_VERSION,
    state_file: stateFile || "",
    state_file_existed: read.exists,
    state_load_error: read.error,
    had_previous: hadPrevious,
    surface_changed_since_last_start: changed,
    previous_surface: previousSurface,
    current_surface: current,
    server_start_id: String(serverStartId || ""),
    evaluated_at: now(),
  };

  if (typeof auditLog === "function") {
    if (!read.exists) auditLog("tool_surface_state_missing", { state_file: stateFile || "", server_start_id: result.server_start_id });
    else if (read.error) auditLog("tool_surface_state_load_failed", { state_file: stateFile || "", error_message: read.error, server_start_id: result.server_start_id });
    else auditLog("tool_surface_state_loaded", { state_file: stateFile || "", previous_fingerprint: previousSurface?.combined_fingerprint || "", server_start_id: result.server_start_id });
    if (changed) auditLog("tool_surface_changed", { state_file: stateFile || "", previous_fingerprint: previousSurface.combined_fingerprint, current_fingerprint: current.combined_fingerprint, previous_tool_names_hash: previousSurface.tool_names_hash, current_tool_names_hash: current.tool_names_hash, server_start_id: result.server_start_id });
  }

  const nextState = {
    state_version: TOOL_SURFACE_STATE_VERSION,
    updated_at: result.evaluated_at,
    server_start_id: result.server_start_id,
    current_surface: current,
    previous_surface: previousSurface,
  };

  try {
    writeCurrentState(stateFile, nextState);
    if (typeof auditLog === "function") auditLog("tool_surface_state_saved", { state_file: stateFile || "", current_fingerprint: current.combined_fingerprint, server_start_id: result.server_start_id });
  } catch (error) {
    result.state_save_error = error && error.message ? error.message : String(error);
    if (typeof auditLog === "function") auditLog("tool_surface_state_save_failed", { state_file: stateFile || "", error_message: result.state_save_error, server_start_id: result.server_start_id });
  }

  return result;
}

module.exports = { TOOL_SURFACE_STATE_VERSION, defaultToolSurfaceStateFile, evaluateToolSurfaceState, normalizeSurface, readPreviousState };

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { normalizeRestartExitCode } = require("./restart_exit_codes");

function flag(v) { return ["1","true","yes","on"].includes(String(v || "").trim().toLowerCase()); }
function delay(v) { const n = Number(v || 250); return Number.isInteger(n) && n >= 50 && n <= 5000 ? n : 250; }
function defaultTriggerFile(rootDir) { return path.join(rootDir, "_control", "restart-request.json"); }
function createRestartController(opts = {}) {
  const env = opts.env || process.env;
  const rootDir = opts.rootDir || path.resolve(__dirname, "../..");
  const auditLog = typeof opts.auditLog === "function" ? opts.auditLog : () => {};
  const endProcess = typeof opts.exit === "function" ? opts.exit : process.exit;
  const logger = typeof opts.logger === "function" ? opts.logger : console.log;
  const enabled = flag(env.MCP_TEST_ENABLE_RESTART_TRIGGER);
  const triggerFile = String(env.MCP_TEST_RESTART_TRIGGER_FILE || defaultTriggerFile(rootDir));
  const delayMs = delay(env.MCP_TEST_RESTART_EXIT_DELAY_MS);
  let scheduled = false;
  let handle = null;
  function audit(name, data) { try { auditLog(name, data); } catch (_) {} }
  function requestRestart(input = {}) {
    const n = normalizeRestartExitCode(input.code, 42);
    const requestId = input.requestId || null;
    const source = input.source || "runtime";
    const reason = input.reason || "unspecified";
    if (!n.ok) { audit("runtime_restart_rejected", { request_id: requestId, source, reason: n.reason, requested_code: n.code, allowed: n.allowed }); return { ok: false, scheduled: false, ...n }; }
    if (scheduled) { audit("runtime_restart_rejected", { request_id: requestId, source, reason: "restart_already_scheduled", requested_code: n.code }); return { ok: false, scheduled: true, reason: "restart_already_scheduled", code: n.code }; }
    scheduled = true;
    audit("runtime_restart_requested", { request_id: requestId, source, reason, exit_code: n.code, delay_ms: delayMs });
    setTimeout(() => { audit("runtime_restart_exit_scheduled", { request_id: requestId, source, reason, exit_code: n.code }); endProcess(n.code); }, delayMs).unref?.();
    return { ok: true, scheduled: true, code: n.code, delay_ms: delayMs, reason, source };
  }
  function poll() {
    if (!enabled || !fs.existsSync(triggerFile)) return;
    let data;
    try { data = JSON.parse(fs.readFileSync(triggerFile, "utf8")); }
    catch (error) { audit("runtime_restart_trigger_file_ignored", { reason: "malformed_json", trigger_file: triggerFile, error_message: error?.message || String(error) }); return; }
    try { fs.unlinkSync(triggerFile); } catch (_) {}
    requestRestart({ code: data.code, reason: data.reason || "file_trigger", source: "file_trigger", requestId: data.request_id || null });
  }
  function start() {
    if (!enabled || handle) return { ok: true, enabled, trigger_file: triggerFile, started: false };
    fs.mkdirSync(path.dirname(triggerFile), { recursive: true });
    handle = setInterval(poll, 500);
    handle.unref?.();
    logger(`Restart trigger file enabled: ${triggerFile}`);
    return { ok: true, enabled: true, trigger_file: triggerFile, started: true };
  }
  function stop() { if (handle) clearInterval(handle); handle = null; }
  function status() { return { enabled, trigger_file: triggerFile, scheduled, delay_ms: delayMs, allowed_exit_codes: [42, 43, 44] }; }
  return { requestRestart, start, stop, status };
}

module.exports = { createRestartController, defaultTriggerFile };

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { normalizeRestartExitCode } = require("./restart_exit_codes");

function flag(v) { return ["1","true","yes","on"].includes(String(v || "").trim().toLowerCase()); }
function delay(v) { const n = Number(v || 250); return Number.isInteger(n) && n >= 50 && n <= 5000 ? n : 250; }
function shutdownGrace(v) { const n = Number(v || 5000); return Number.isInteger(n) && n >= 50 && n <= 30000 ? n : 5000; }
function defaultTriggerFile(rootDir) { return path.join(rootDir, "_control", "restart-request.json"); }
function createRestartController(opts = {}) {
  const env = opts.env || process.env;
  const rootDir = opts.rootDir || path.resolve(__dirname, "../..");
  const auditLog = typeof opts.auditLog === "function" ? opts.auditLog : () => {};
  const endProcess = typeof opts.exit === "function" ? opts.exit : process.exit;
  const logger = typeof opts.logger === "function" ? opts.logger : console.log;
  const warnLogger = typeof opts.warnLogger === "function" ? opts.warnLogger : console.warn;
  const rateLimiter = opts.rateLimiter || null;
  const beforeExit = typeof opts.beforeExit === "function" ? opts.beforeExit : null;
  const enabled = flag(env.MCP_TEST_ENABLE_RESTART_TRIGGER);
  const triggerFile = String(env.MCP_TEST_RESTART_TRIGGER_FILE || defaultTriggerFile(rootDir));
  const delayMs = delay(env.MCP_TEST_RESTART_EXIT_DELAY_MS);
  const shutdownGraceMs = shutdownGrace(env.MCP_TEST_RESTART_SHUTDOWN_GRACE_MS);
  let scheduled = false;
  let handle = null;
  function audit(name, data) {
    try {
      auditLog(name, data);
    } catch (error) {
      warnLogger("RESTART_AUDIT_LOG_FAILED:", error?.message || String(error));
    }
  }
  async function exitAfterShutdown({ code, requestId, source, reason }) {
    audit("runtime_restart_exit_scheduled", { request_id: requestId, source, reason, exit_code: code });
    if (beforeExit) {
      let timeoutHandle;
      const timeoutResult = Symbol("shutdown_timeout");
      const outcome = await Promise.race([
        Promise.resolve()
          .then(() => beforeExit({ code, requestId, source, reason }))
          .then(() => "completed", (error) => ({ error })),
        new Promise((resolve) => {
          timeoutHandle = setTimeout(() => resolve(timeoutResult), shutdownGraceMs);
          timeoutHandle.unref?.();
        }),
      ]);
      if (timeoutHandle) clearTimeout(timeoutHandle);
      if (outcome === timeoutResult) {
        audit("runtime_restart_shutdown_timeout", {
          request_id: requestId,
          source,
          reason,
          exit_code: code,
          shutdown_grace_ms: shutdownGraceMs,
        });
      } else if (outcome && outcome.error) {
        audit("runtime_restart_shutdown_failed", {
          request_id: requestId,
          source,
          reason,
          exit_code: code,
          error_message: outcome.error?.message || String(outcome.error),
        });
      } else {
        audit("runtime_restart_shutdown_completed", {
          request_id: requestId,
          source,
          reason,
          exit_code: code,
        });
      }
    }
    endProcess(code);
  }
  function requestRestart(input = {}) {
    const n = normalizeRestartExitCode(input.code, 42);
    const requestId = input.requestId || null;
    const source = input.source || "runtime";
    const reason = input.reason || "unspecified";
    if (!n.ok) { audit("runtime_restart_rejected", { request_id: requestId, source, reason: n.reason, requested_code: n.code, allowed: n.allowed }); return { ok: false, scheduled: false, ...n }; }
    if (scheduled) { audit("runtime_restart_rejected", { request_id: requestId, source, reason: "restart_already_scheduled", requested_code: n.code }); return { ok: false, scheduled: true, reason: "restart_already_scheduled", code: n.code }; }
    if (rateLimiter && typeof rateLimiter.evaluateRestart === "function") {
      const rateDecision = rateLimiter.evaluateRestart({ code: n.code, source });
      if (rateDecision.allow !== true) {
        audit("runtime_restart_rate_limited", { request_id: requestId, source, reason, exit_code: n.code, rate_limit: rateDecision });
        return { ok: false, scheduled: false, reason: "rate_limit_exceeded", code: n.code, rate_limit: rateDecision };
      }
    }
    scheduled = true;
    audit("runtime_restart_requested", { request_id: requestId, source, reason, exit_code: n.code, delay_ms: delayMs });
    setTimeout(() => {
      void exitAfterShutdown({ code: n.code, requestId, source, reason });
    }, delayMs).unref?.();
    return { ok: true, scheduled: true, code: n.code, delay_ms: delayMs, reason, source };
  }
  function poll() {
    if (!enabled || !fs.existsSync(triggerFile)) return;
    let data;
    try { data = JSON.parse(fs.readFileSync(triggerFile, "utf8")); }
    catch (error) { audit("runtime_restart_trigger_file_ignored", { reason: "malformed_json", trigger_file: triggerFile, error_message: error?.message || String(error) }); return; }
    try { fs.unlinkSync(triggerFile); }
    catch (error) {
      audit("runtime_restart_trigger_file_delete_failed", {
        trigger_file: triggerFile,
        error_message: error?.message || String(error),
      });
    }
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
  function status() { return { enabled, trigger_file: triggerFile, scheduled, delay_ms: delayMs, shutdown_grace_ms: shutdownGraceMs, allowed_exit_codes: [42, 43, 44] }; }
  return { requestRestart, start, stop, status };
}

module.exports = { createRestartController, defaultTriggerFile };

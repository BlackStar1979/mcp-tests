"use strict";

const childProcess = require("node:child_process");
const path = require("node:path");
const { StringDecoder } = require("node:string_decoder");

const {
  PROCESS_RUNNER_CONFIG,
  prepareProcessInvocation,
} = require("./process_runner_config");

function readExecutionLimit(value, fallback, min, max, name) {
  if (value === undefined || value === null) return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  }
  return number;
}

function forceTerminateProcessTree(child, dependencies = {}) {
  if (!child || !Number.isInteger(child.pid)) {
    try {
      return Promise.resolve(child?.kill?.("SIGKILL") !== false);
    } catch {
      return Promise.resolve(false);
    }
  }

  if (process.platform !== "win32") {
    try {
      process.kill(-child.pid, "SIGKILL");
      return Promise.resolve(true);
    } catch {
      try {
        return Promise.resolve(child.kill("SIGKILL") !== false);
      } catch {
        return Promise.resolve(false);
      }
    }
  }

  const systemRoot = String((dependencies.parentEnv || process.env).SYSTEMROOT || "C:\\Windows");
  const taskkill = path.join(systemRoot, "System32", "taskkill.exe");
  const spawn = dependencies.spawnTreeKiller || childProcess.spawn;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const fallback = () => {
      try {
        finish(child.kill("SIGKILL") !== false);
      } catch {
        finish(false);
      }
    };
    const timer = setTimeout(() => {
      try { killer?.kill?.("SIGKILL"); } catch {}
      fallback();
    }, 5000);
    timer.unref?.();
    let killer;
    try {
      killer = spawn(taskkill, ["/PID", String(child.pid), "/T", "/F"], {
        windowsHide: true,
        shell: false,
        stdio: "ignore",
      });
      killer.once("error", fallback);
      killer.once("close", (code) => {
        if (code === 0) finish(true);
        else fallback();
      });
    } catch {
      fallback();
    }
  });
}

function prepareProcessExecution(options = {}, dependencies = {}) {
  const config = dependencies.config || PROCESS_RUNNER_CONFIG;
  const invocation = prepareProcessInvocation(options, config, dependencies);
  const timeoutMs = readExecutionLimit(
    options.timeout_ms,
    config.defaultTimeoutMs,
    100,
    config.maxTimeoutMs,
    "timeout_ms"
  );
  const outputLimit = readExecutionLimit(
    options.max_output_chars,
    config.defaultOutputChars,
    1000,
    config.hardOutputChars,
    "max_output_chars"
  );
  return {
    config,
    invocation,
    outputLimit,
    timeoutMs,
  };
}

function startProcessExecution(options = {}, dependencies = {}) {
  const prepared = dependencies.prepared || prepareProcessExecution(options, dependencies);
  const {
    config,
    invocation,
    outputLimit,
    timeoutMs,
  } = prepared;
  const spawn = dependencies.spawn || childProcess.spawn;
  const now = dependencies.now || Date.now;
  const startedAt = now();

  let child = null;
  let status = "running";
  let terminal = false;
  let timedOut = false;
  let cancelReason = null;
  let terminationError = null;
  let exitCode = null;
  let signal = null;
  let stdout = "";
  let stderr = "";
  let stdoutTruncated = false;
  let stderrTruncated = false;
  let outputChars = 0;
  let timeoutTimer = null;
  let treeTermination = Promise.resolve(true);
  let resolveCompletion;

  const stdoutDecoder = new StringDecoder("utf8");
  const stderrDecoder = new StringDecoder("utf8");

  function appendOutput(stream, chunk) {
    const text = String(chunk || "");
    if (!text) return;
    const remaining = Math.max(0, outputLimit - outputChars);
    const accepted = text.slice(0, remaining);
    outputChars += accepted.length;
    if (stream === "stdout") {
      stdout += accepted;
      stdoutTruncated = stdoutTruncated || accepted.length < text.length;
    } else {
      stderr += accepted;
      stderrTruncated = stderrTruncated || accepted.length < text.length;
    }
    if (typeof dependencies.onOutput === "function") {
      try {
        dependencies.onOutput({
          stream,
          text: accepted,
          truncated: stream === "stdout" ? stdoutTruncated : stderrTruncated,
        });
      } catch (error) {
        if (!terminationError) {
          terminationError = `process output persistence failed: ${error?.message || String(error)}`;
        }
        try { dependencies.onPersistenceError?.(error); } catch {}
        requestTermination("persistence_failure");
      }
    }
  }

  function resultPayload(error = null) {
    return {
      status,
      command: invocation.logicalCommand,
      args: [...invocation.originalArgs],
      cwd: invocation.cwdInfo.displayPath,
      workspace: invocation.cwdInfo.rootAlias,
      exit_code: exitCode,
      signal,
      timed_out: timedOut,
      duration_ms: Math.max(0, now() - startedAt),
      stdout,
      stderr,
      stdout_truncated: stdoutTruncated,
      stderr_truncated: stderrTruncated,
      output_limit_chars: outputLimit,
      trace_id: options.trace_id ?? null,
      error,
    };
  }

  function finish(nextStatus, code, nextSignal, error = null) {
    if (terminal) return;
    terminal = true;
    status = nextStatus;
    exitCode = Number.isInteger(code) ? code : null;
    signal = nextSignal || null;
    if (timeoutTimer) clearTimeout(timeoutTimer);
    appendOutput("stdout", stdoutDecoder.end());
    appendOutput("stderr", stderrDecoder.end());
    Promise.resolve(treeTermination).finally(() => {
      resolveCompletion(resultPayload(error || terminationError));
    });
  }

  function requestTermination(reason) {
    if (terminal || !child) return;
    treeTermination = Promise.resolve(forceTerminateProcessTree(child, dependencies)).then(
      (killed) => {
        if (killed === false && !terminationError) {
          terminationError = "process-tree termination returned false";
        }
        return killed;
      },
      (error) => {
        if (!terminationError) {
          terminationError = `process-tree termination failed: ${error?.message || String(error)}`;
        }
        return false;
      }
    );
    return reason;
  }

  const completion = new Promise((resolve) => {
    resolveCompletion = resolve;
  });

  try {
    child = spawn(invocation.executable, invocation.args, {
      cwd: invocation.cwdInfo.absolutePath,
      detached: process.platform !== "win32",
      env: invocation.env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    child.stdout?.on("data", (buffer) => appendOutput("stdout", stdoutDecoder.write(buffer)));
    child.stderr?.on("data", (buffer) => appendOutput("stderr", stderrDecoder.write(buffer)));
    child.once("error", (error) => {
      finish("spawn_error", null, null, error?.message || String(error));
    });
    child.once("close", (code, closeSignal) => {
      const terminalStatus = timedOut
        ? "timeout"
        : cancelReason
          ? "cancelled"
          : code === 0
            ? "ok"
            : "nonzero_exit";
      finish(terminalStatus, code, closeSignal, null);
    });

    timeoutTimer = setTimeout(() => {
      if (terminal) return;
      timedOut = true;
      requestTermination("timeout");
    }, timeoutMs);
    timeoutTimer.unref?.();
  } catch (error) {
    finish("spawn_error", null, null, error?.message || String(error));
  }

  function snapshot() {
    return {
      status,
      terminal,
      command: invocation.logicalCommand,
      family: invocation.family,
      resolution_class: invocation.resolutionClass,
      cwd: invocation.cwdInfo.displayPath,
      workspace: invocation.cwdInfo.rootAlias,
      timeout_ms: timeoutMs,
      output_limit_chars: outputLimit,
      stdout_chars: stdout.length,
      stderr_chars: stderr.length,
      stdout_truncated: stdoutTruncated,
      stderr_truncated: stderrTruncated,
      started_at_ms: startedAt,
      duration_ms: Math.max(0, now() - startedAt),
    };
  }

  function readOutput(cursor = {}) {
    const stdoutOffset = readExecutionLimit(
      cursor.stdout_offset,
      0,
      0,
      outputLimit,
      "stdout_offset"
    );
    const stderrOffset = readExecutionLimit(
      cursor.stderr_offset,
      0,
      0,
      outputLimit,
      "stderr_offset"
    );
    const maxChars = readExecutionLimit(
      cursor.max_chars,
      config.outputReadChars,
      1,
      config.outputReadChars,
      "max_chars"
    );
    let remaining = maxChars;
    const stdoutChunk = stdout.slice(stdoutOffset, stdoutOffset + remaining);
    remaining -= stdoutChunk.length;
    const stderrChunk = stderr.slice(stderrOffset, stderrOffset + remaining);
    const stdoutNextOffset = stdoutOffset + stdoutChunk.length;
    const stderrNextOffset = stderrOffset + stderrChunk.length;
    return {
      stdout: stdoutChunk,
      stderr: stderrChunk,
      stdout_offset: stdoutOffset,
      stderr_offset: stderrOffset,
      stdout_next_offset: stdoutNextOffset,
      stderr_next_offset: stderrNextOffset,
      stdout_eof: terminal && stdoutNextOffset >= stdout.length,
      stderr_eof: terminal && stderrNextOffset >= stderr.length,
      terminal,
      status,
    };
  }

  async function cancel(reason = "cancelled") {
    if (!terminal) {
      cancelReason = String(reason || "cancelled").slice(0, 200);
      requestTermination(cancelReason);
    }
    return completion;
  }

  return {
    get child() {
      return child;
    },
    completion,
    snapshot,
    readOutput,
    cancel,
  };
}

module.exports = {
  forceTerminateProcessTree,
  prepareProcessExecution,
  startProcessExecution,
};

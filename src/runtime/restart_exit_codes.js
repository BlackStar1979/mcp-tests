"use strict";

const CONTROLLED_RESTART_EXIT_CODES = Object.freeze({
  restart: 42,
  reload_runtime: 43,
  reload_config: 44,
});

const CONTROLLED_RESTART_CODE_SET = new Set(Object.values(CONTROLLED_RESTART_EXIT_CODES));

function normalizeRestartExitCode(value, fallback = CONTROLLED_RESTART_EXIT_CODES.restart) {
  const code = value === undefined || value === null || value === "" ? fallback : Number(value);
  if (!Number.isInteger(code) || !CONTROLLED_RESTART_CODE_SET.has(code)) {
    return { ok: false, code, reason: "unsupported_restart_exit_code", allowed: Array.from(CONTROLLED_RESTART_CODE_SET).sort((a, b) => a - b) };
  }
  return { ok: true, code };
}

module.exports = {
  CONTROLLED_RESTART_EXIT_CODES,
  CONTROLLED_RESTART_CODE_SET,
  normalizeRestartExitCode,
};

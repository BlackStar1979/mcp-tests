"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { CliArgumentError, parseCliArgs } = require("../src/util/cli_args");

const RUN_TMP_PREFIX = "mcp-tests-run-all-";
const DEFAULT_MIN_AGE_MINUTES = 15;

function parseArgs(argv) {
  const parsed = parseCliArgs(argv, {
    valueOptions: ["min-age-minutes"],
    flagOptions: ["apply"],
  });
  const minAgeMinutes = Number(parsed.value("min-age-minutes", String(DEFAULT_MIN_AGE_MINUTES)));
  if (!Number.isSafeInteger(minAgeMinutes) || minAgeMinutes < 0) {
    throw new CliArgumentError("cli_argument_value_invalid", "min-age-minutes");
  }
  return { apply: parsed.flag("apply"), minAgeMinutes };
}

function processIsAlive(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code !== "ESRCH";
  }
}

function directorySize(directory) {
  let bytes = 0;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      bytes += directorySize(entryPath);
    } else if (entry.isFile()) {
      bytes += fs.statSync(entryPath).size;
    }
  }
  return bytes;
}

function cleanupRunAllTemp({
  tempRoot = os.tmpdir(),
  apply = false,
  minAgeMinutes = DEFAULT_MIN_AGE_MINUTES,
  nowMs = Date.now(),
} = {}) {
  if (!Number.isSafeInteger(minAgeMinutes) || minAgeMinutes < 0) {
    throw new CliArgumentError("cli_argument_value_invalid", "min-age-minutes");
  }
  if (!Number.isFinite(nowMs) || nowMs < 0) {
    throw new TypeError("nowMs must be a non-negative finite number");
  }
  const root = path.resolve(tempRoot);
  const minAgeMs = minAgeMinutes * 60 * 1000;
  const candidates = [];
  const skippedActive = [];
  const skippedRecent = [];

  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith(RUN_TMP_PREFIX)) continue;
    const target = path.resolve(root, entry.name);
    if (path.dirname(target) !== root || !path.basename(target).startsWith(RUN_TMP_PREFIX)) {
      throw new Error(`unsafe run_all temp target: ${target}`);
    }
    const pidMatch = entry.name.match(/^mcp-tests-run-all-(\d+)-/);
    const pid = pidMatch ? Number(pidMatch[1]) : 0;
    if (processIsAlive(pid)) {
      skippedActive.push(entry.name);
      continue;
    }
    const ageMs = Math.max(0, nowMs - fs.statSync(target).mtimeMs);
    if (ageMs < minAgeMs) {
      skippedRecent.push(entry.name);
      continue;
    }
    candidates.push({ name: entry.name, target, bytes: directorySize(target) });
  }

  let removed = 0;
  let removedBytes = 0;
  if (apply) {
    for (const candidate of candidates) {
      fs.rmSync(candidate.target, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
      removed += 1;
      removedBytes += candidate.bytes;
    }
  }

  return {
    ok: true,
    mode: apply ? "apply" : "plan",
    prefix: RUN_TMP_PREFIX,
    min_age_minutes: minAgeMinutes,
    candidate_count: candidates.length,
    candidate_bytes: candidates.reduce((sum, candidate) => sum + candidate.bytes, 0),
    removed_count: removed,
    removed_bytes: removedBytes,
    skipped_active_count: skippedActive.length,
    skipped_recent_count: skippedRecent.length,
    skipped_active: skippedActive,
    skipped_recent: skippedRecent,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log(JSON.stringify(cleanupRunAllTemp(args), null, 2));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    if (error instanceof CliArgumentError) {
      console.error(JSON.stringify({ success: false, error_code: error.code, argument: error.argument, message: error.message }));
      process.exitCode = 2;
    } else {
      console.error(error?.stack || error?.message || String(error));
      process.exitCode = 1;
    }
  }
}

module.exports = { cleanupRunAllTemp, parseArgs };

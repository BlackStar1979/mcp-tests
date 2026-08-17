"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { CliArgumentError, parseCliArgs } = require("../src/util/cli_args");

const ROOT = path.resolve(__dirname, "..");

const DEFAULT_SINCE = "30 days ago";
const DEFAULT_LIMIT = 30;
const DEFAULT_MIN_CHURN = 1;

const EXCLUDED_PREFIXES = [
  ".git/",
  ".codebase-memory/",
  ".temp/",
  "node_modules/",
  "_logs/",
  "_repos_with_code_samples/",
  "_workflow/control_plane/retired_root_backups/",
  "_workflow/control_plane/snapshots/",
];

function parseArgs(argv) {
  const parsed = parseCliArgs(argv, {
    valueOptions: ["since", "limit", "min-churn"],
    flagOptions: ["json", "fail-on-missing"],
  });
  const limit = Number(parsed.value("limit", String(DEFAULT_LIMIT)));
  const minChurn = Number(parsed.value("min-churn", String(DEFAULT_MIN_CHURN)));
  if (!Number.isSafeInteger(limit) || limit <= 0) throw new CliArgumentError("cli_argument_value_invalid", "limit");
  if (!Number.isSafeInteger(minChurn) || minChurn <= 0) throw new CliArgumentError("cli_argument_value_invalid", "min-churn");
  return {
    since: parsed.value("since", DEFAULT_SINCE),
    limit,
    minChurn,
    json: parsed.flag("json"),
    failOnMissing: parsed.flag("fail-on-missing"),
  };
}

function runGit(args) {
  const result = spawnSync("git", args, {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  }
  return result.stdout;
}

function normalizePath(value) {
  return value.replaceAll("\\", "/").replace(/^\.\/+/, "");
}

function isExcluded(relPath) {
  const normalized = normalizePath(relPath);
  return EXCLUDED_PREFIXES.some((prefix) => normalized === prefix.slice(0, -1) || normalized.startsWith(prefix));
}

function parentDir(filePath) {
  const normalized = normalizePath(filePath);
  const idx = normalized.lastIndexOf("/");
  if (idx <= 0) return "";
  return normalized.slice(0, idx);
}

function directoryExists(relDir) {
  return fs.existsSync(path.join(ROOT, relDir)) && fs.statSync(path.join(ROOT, relDir)).isDirectory();
}

function hasDirectoryDoc(relDir) {
  return fs.existsSync(path.join(ROOT, relDir, "DIRECTORY.md"));
}

function collectRows(opts) {
  const output = runGit(["log", `--since=${opts.since}`, "--name-only", "--pretty=format:", "--", "."]);
  const counts = new Map();
  for (const rawLine of output.split(/\r?\n/)) {
    const filePath = normalizePath(rawLine.trim());
    if (!filePath || isExcluded(filePath)) continue;
    const dir = parentDir(filePath);
    if (!dir || isExcluded(`${dir}/`) || !directoryExists(dir)) continue;
    counts.set(dir, (counts.get(dir) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([dir, churn]) => ({
      dir,
      churn,
      has_directory: hasDirectoryDoc(dir),
      directory_path: `${dir}/DIRECTORY.md`,
    }))
    .filter((row) => row.churn >= opts.minChurn)
    .sort((a, b) => b.churn - a.churn || a.dir.localeCompare(b.dir))
    .slice(0, opts.limit);
}

function renderText(report) {
  const lines = [
    `Directory documentation audit`,
    `since: ${report.since}`,
    `min_churn: ${report.min_churn}`,
    `missing: ${report.missing_count}`,
    "",
  ];
  for (const row of report.rows) {
    const mark = row.has_directory ? "ok" : "missing";
    lines.push(`${String(row.churn).padStart(4, " ")}  ${mark.padEnd(7, " ")}  ${row.dir}`);
  }
  return `${lines.join("\n")}\n`;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const rows = collectRows(opts);
  const report = {
    ok: rows.every((row) => row.has_directory),
    since: opts.since,
    limit: opts.limit,
    min_churn: opts.minChurn,
    missing_count: rows.filter((row) => !row.has_directory).length,
    rows,
  };
  process.stdout.write(opts.json ? `${JSON.stringify(report, null, 2)}\n` : renderText(report));
  if (opts.failOnMissing && !report.ok) {
    process.exitCode = 2;
  }
}
if (require.main === module) {
  try {
    main();
  } catch (error) {
    if (error instanceof CliArgumentError) {
      console.error(JSON.stringify({ success: false, error_code: error.code, argument: error.argument, message: error.message }));
      process.exitCode = 2;
      return;
    }
    console.error(error && error.stack ? error.stack : String(error));
    process.exitCode = 1;
  }
}

module.exports = { parseArgs };

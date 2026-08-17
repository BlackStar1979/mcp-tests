#!/usr/bin/env node
"use strict";

const path = require("node:path");
const { backfillMemoryEmbeddings } = require("../src/memory/embedding_backfill");
const { CliArgumentError, parseCliArgs } = require("../src/util/cli_args");

function parseArgs(argv) {
  const parsed = parseCliArgs(argv, {
    valueOptions: ["limit", "log-dir"],
    flagOptions: ["dry-run"],
  });
  const limit = Number(parsed.value("limit", "100"));
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000) {
    throw new CliArgumentError("cli_argument_value_invalid", "limit");
  }
  return {
    dryRun: parsed.flag("dry-run"),
    limit,
    logDir: parsed.value("log-dir", path.join(__dirname, "../_logs")),
  };
}

async function main() {
  const report = await backfillMemoryEmbeddings(parseArgs(process.argv.slice(2)));
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  if (!report.ok) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => {
    if (error instanceof CliArgumentError) {
      process.stderr.write(`${JSON.stringify({ success: false, error_code: error.code, argument: error.argument, message: error.message })}\n`);
      process.exitCode = 2;
      return;
    }
    process.stderr.write(JSON.stringify({ ok: false, error: error.message }) + "\n");
    process.exitCode = 1;
  });
}

module.exports = { parseArgs };

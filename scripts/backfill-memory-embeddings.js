#!/usr/bin/env node
"use strict";

const path = require("node:path");
const { backfillMemoryEmbeddings } = require("../src/memory/embedding_backfill");

function parseArgs(argv) {
  const options = { dryRun: false, limit: 100, logDir: path.join(__dirname, "../_logs") };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--limit") options.limit = argv[++index];
    else if (arg === "--log-dir") options.logDir = argv[++index];
    else throw new Error(`unsupported_argument:${arg}`);
  }
  return options;
}

async function main() {
  const report = await backfillMemoryEmbeddings(parseArgs(process.argv.slice(2)));
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  if (!report.ok) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(JSON.stringify({ ok: false, error: error.message }) + "\n");
    process.exitCode = 1;
  });
}

module.exports = { parseArgs };

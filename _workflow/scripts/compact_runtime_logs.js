"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { CliArgumentError, parseCliArgs } = require("./cli_args");

const ROOT = process.cwd();
const DEFAULT_LOG = path.join(ROOT, "_logs", ".mcp-tests-audit.jsonl");
const DEFAULT_OUT_DIR = path.join(ROOT, "_logs", "compact");

function parseArgs(argv) {
  const parsed = parseCliArgs(argv, {
    valueOptions: ["log", "out-dir", "tail"],
    flagOptions: ["replace"],
  });
  const tail = Number(parsed.value("tail", "200"));
  if (!Number.isSafeInteger(tail) || tail < 0) {
    throw new CliArgumentError("cli_argument_value_invalid", "tail");
  }
  return {
    log: path.resolve(ROOT, parsed.value("log", DEFAULT_LOG)),
    outDir: path.resolve(ROOT, parsed.value("out-dir", DEFAULT_OUT_DIR)),
    tail,
    replace: parsed.flag("replace"),
  };
}

function compactRuntimeLog({ log, outDir, tail, replace }) {
  const result = {
    ok: true,
    log: path.relative(ROOT, log).replace(/\\/g, "/"),
    existed: fs.existsSync(log),
    input_bytes: 0,
    lines: 0,
    parsed: 0,
    malformed: 0,
    event_counts: {},
    tail_lines: 0,
    output_dir: path.relative(ROOT, outDir).replace(/\\/g, "/"),
    replaced_raw_log: false,
  };
  fs.mkdirSync(outDir, { recursive: true });
  if (!result.existed) {
    fs.writeFileSync(path.join(outDir, "runtime_audit_summary.json"), `${JSON.stringify(result, null, 2)}\n`);
    return result;
  }
  const content = fs.readFileSync(log, "utf8");
  result.input_bytes = Buffer.byteLength(content);
  const lines = content.split(/\r?\n/).filter(Boolean);
  result.lines = lines.length;
  const tailLines = lines.slice(Math.max(0, lines.length - tail));
  result.tail_lines = tailLines.length;
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      result.parsed += 1;
      const event = obj.event || obj.type || obj.name || "unknown";
      result.event_counts[event] = (result.event_counts[event] || 0) + 1;
    } catch {
      result.malformed += 1;
    }
  }
  fs.writeFileSync(path.join(outDir, "runtime_audit_summary.json"), `${JSON.stringify(result, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, "runtime_audit_tail.jsonl"), `${tailLines.join("\n")}${tailLines.length ? "\n" : ""}`);
  if (replace) {
    const archive = path.join(outDir, `runtime_audit_raw_${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`);
    fs.renameSync(log, archive);
    fs.writeFileSync(log, "");
    result.replaced_raw_log = true;
    result.raw_archive = path.relative(ROOT, archive).replace(/\\/g, "/");
    fs.writeFileSync(path.join(outDir, "runtime_audit_summary.json"), `${JSON.stringify(result, null, 2)}\n`);
  }
  return result;
}

if (require.main === module) {
  try {
    console.log(JSON.stringify(compactRuntimeLog(parseArgs(process.argv.slice(2))), null, 2));
  } catch (error) {
    if (error instanceof CliArgumentError) {
      console.error(JSON.stringify({
        success: false,
        error_code: error.code,
        argument: error.argument,
        message: error.message,
      }));
      process.exit(2);
    }
    console.error(error?.stack || error?.message || String(error));
    process.exit(1);
  }
}

module.exports = { compactRuntimeLog, parseArgs };

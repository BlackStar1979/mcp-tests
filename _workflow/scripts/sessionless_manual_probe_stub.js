#!/usr/bin/env node
"use strict";
const { CliArgumentError, parseCliArgs } = require("./cli_args");
const MARKER = "sessionless_manual_probe_stub";
try {
  const args = parseCliArgs(process.argv.slice(2), { flagOptions: ["self-test"] });
  if (args.flag("self-test")) {
    console.log(JSON.stringify({ ok: true, marker: MARKER, network: false }, null, 2));
    process.exit(0);
  }
} catch (error) {
  if (error instanceof CliArgumentError) {
    console.error(JSON.stringify({ success: false, error_code: error.code, argument: error.argument, message: error.message }));
    process.exit(2);
  }
  throw error;
}
console.error(JSON.stringify({
  ok: false,
  marker: MARKER,
  error: "manual_execution_required",
  note: "Run the live authenticated sessionless probe outside the ChatGPT tool layer. See _workflow/operator_decisions/sessionless_manual_live_probe_contract.md."
}, null, 2));
process.exit(2);

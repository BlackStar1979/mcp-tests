#!/usr/bin/env node
"use strict";
const MARKER = "s10a_manual_sessionless_probe_stub";
if (process.argv.includes("--self-test")) {
  console.log(JSON.stringify({ ok: true, marker: MARKER, network: false }, null, 2));
  process.exit(0);
}
console.error(JSON.stringify({
  ok: false,
  marker: MARKER,
  error: "manual_execution_required",
  note: "Run the live authenticated sessionless probe outside the ChatGPT tool layer. See _workflow/operator_decisions/s10a_manual_live_probe_contract.md."
}, null, 2));
process.exit(2);

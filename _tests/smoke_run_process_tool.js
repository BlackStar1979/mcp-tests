"use strict";

const assert = require("node:assert/strict");

const { runProcessTool } = require("../tools/run_process");

(async () => {
  const result = await runProcessTool.execute({
    command: "node",
    args: ["-e", "console.log('run-process-ok')"],
    cwd: ".",
    timeout_ms: 5000,
  });

  assert.equal(runProcessTool.name, "run_process");
  assert.equal(result.status, "ok");
  assert.equal(result.command, "node");
  assert.equal(result.timed_out, false);
  assert.deepEqual(result.args, [], "run_process must not echo raw argv into the tool result");
  assert.match(result.stdout, /run-process-ok/);
  console.log("smoke_run_process_tool ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

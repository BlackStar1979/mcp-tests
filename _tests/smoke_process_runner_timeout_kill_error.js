"use strict";

const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");

const { runProcessWithSpawn } = require("../src/util/process_runner");

function createFakeStream() {
  const stream = new EventEmitter();
  stream.on = stream.on.bind(stream);
  return stream;
}

(async () => {
  const fakeChild = new EventEmitter();
  fakeChild.stdout = createFakeStream();
  fakeChild.stderr = createFakeStream();
  fakeChild.kill = (signal) => {
    if (signal === "SIGKILL") throw new Error("tree kill blocked");
    return false;
  };

  const fakeSpawn = () => {
    setTimeout(() => fakeChild.emit("close", null, "SIGKILL"), 180);
    return fakeChild;
  };

  const result = await runProcessWithSpawn({
    command: "node",
    args: ["-e", "setTimeout(() => {}, 1000)"],
    cwd: ".",
    timeout_ms: 100,
  }, fakeSpawn);

  assert.equal(result.status, "timeout");
  assert.equal(result.timed_out, true);
  assert.equal(result.signal, "SIGKILL");
  assert.match(result.error || "", /process-tree termination returned false/);
  console.log("smoke_process_runner_timeout_kill_error ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

"use strict";

const assert = require("node:assert/strict");

const { startProcessExecution } = require("../src/util/process_execution");

async function delay(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate, timeoutMs = 5000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (predicate()) return;
    await delay(25);
  }
  throw new Error(`waitFor timed out after ${timeoutMs}ms`);
}

function processExists(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

let spawnedNestedPid = null;

(async () => {
  const outputHandle = startProcessExecution({
    command: "node",
    args: [
      "-e",
      "process.stdout.write('o'.repeat(800000));process.stderr.write('e'.repeat(800000));",
    ],
    cwd: "mcp-tests",
    timeout_ms: 5000,
    max_output_chars: 1000000,
  });
  const outputResult = await outputHandle.completion;
  assert.equal(outputResult.status, "ok");
  assert.equal(outputResult.output_limit_chars, 1000000);
  assert.equal(outputResult.stdout.length + outputResult.stderr.length, 1000000);
  assert.equal(outputResult.stdout_truncated || outputResult.stderr_truncated, true);

  const firstChunk = outputHandle.readOutput({
    stdout_offset: 0,
    stderr_offset: 0,
    max_chars: 1024,
  });
  assert.equal(firstChunk.stdout.length + firstChunk.stderr.length, 1024);
  assert.equal(firstChunk.stdout_next_offset, firstChunk.stdout.length);
  assert.equal(firstChunk.stderr_next_offset, firstChunk.stderr.length);

  const timeoutHandle = startProcessExecution({
    command: "node",
    args: ["-e", "setTimeout(() => {}, 5000)"],
    cwd: "mcp-tests",
    timeout_ms: 100,
  });
  const timeoutResult = await timeoutHandle.completion;
  assert.equal(timeoutResult.status, "timeout");
  assert.equal(timeoutResult.timed_out, true);
  assert.equal(timeoutHandle.snapshot().terminal, true);

  const cancelHandle = startProcessExecution({
    command: "node",
    args: ["-e", "setTimeout(() => {}, 5000)"],
    cwd: "mcp-tests",
    timeout_ms: 5000,
  });
  await delay(100);
  const cancelResult = await cancelHandle.cancel("test_cancel");
  assert.equal(cancelResult.status, "cancelled");
  assert.equal(cancelResult.timed_out, false);
  assert.equal(cancelHandle.snapshot().terminal, true);

  const treeHandle = startProcessExecution({
    command: "node",
    args: [
      "-e",
      "const {spawn}=require('node:child_process');const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{detached:process.platform==='win32',stdio:'ignore'});child.unref();process.stdout.write(String(child.pid));setInterval(()=>{},1000);",
    ],
    cwd: "mcp-tests",
    timeout_ms: 10000,
  });
  await waitFor(() => /^\d+$/.test(treeHandle.readOutput({ max_chars: 64 }).stdout));
  const nestedPid = Number(treeHandle.readOutput({ max_chars: 64 }).stdout);
  spawnedNestedPid = nestedPid;
  assert.equal(processExists(nestedPid), true);
  const treeCancelResult = await treeHandle.cancel("tree_cancel");
  assert.equal(treeCancelResult.status, "cancelled");
  await waitFor(() => !processExists(nestedPid));
  assert.equal(processExists(nestedPid), false);
  spawnedNestedPid = null;

  let capturedExecutable = null;
  const fakeSpawn = (executable) => {
    capturedExecutable = executable;
    const { EventEmitter } = require("node:events");
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = () => true;
    setImmediate(() => child.emit("close", 0, null));
    return child;
  };
  const pinnedHandle = startProcessExecution({
    command: "node",
    args: ["--version"],
    cwd: "mcp-tests",
  }, { spawn: fakeSpawn });
  await pinnedHandle.completion;
  assert.equal(capturedExecutable, process.execPath);

  console.log("smoke_process_execution ok");
})().catch((error) => {
  if (spawnedNestedPid && processExists(spawnedNestedPid)) {
    try { process.kill(spawnedNestedPid, "SIGKILL"); } catch {}
  }
  console.error(error);
  process.exit(1);
});

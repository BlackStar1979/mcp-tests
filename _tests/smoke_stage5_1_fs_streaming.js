const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const publicRoot = path.join(__dirname, "..", "_public_sandbox");
const largePath = path.join(publicRoot, "docs", "large-lines.txt");
const syncReadName = ["read", "File", "Sync"].join("");
const syncWriteName = ["write", "File", "Sync"].join("");

function ensureLargeFixture() {
  fs.mkdirSync(path.dirname(largePath), { recursive: true });
  const lines = [];
  for (let i = 1; i <= 1200; i += 1) {
    lines.push(`line-${String(i).padStart(4, "0")} ${"x".repeat(80)}`);
  }
  fs[syncWriteName](largePath, `${lines.join("\n")}\n`, "utf8");
}

(async () => {
  ensureLargeFixture();

  const policy = require("../src/util/path_policy");
  const original = fs[syncReadName];
  let calls = 0;

  fs[syncReadName] = function blocked(...args) {
    calls += 1;
    throw new Error(`sync full read was called: ${args[0]}`);
  };

  try {
    const info = await policy.fileInfoFor("docs/large-lines.txt");
    assert.equal(info.kind, "file");
    assert.ok(info.sha256.length > 20);

    const prefix = await policy.readBoundedText("docs/large-lines.txt", { maxChars: 120 });
    assert.equal(prefix.text.length, 120);
    assert.equal(prefix.truncated, true);
    assert.match(prefix.text, /^line-0001/);

    const lines = await policy.readPublicLines("docs/large-lines.txt", {
      startLine: 100,
      endLine: 102,
      maxChars: 1000,
    });
    assert.match(lines.text, /^100: line-0100/m);
    assert.match(lines.text, /102: line-0102/);

    const chunk = await policy.readPublicChunk("docs/large-lines.txt", {
      offset: 10,
      length: 50,
    });
    assert.equal(chunk.text.length, 50);

    assert.equal(calls, 0);
  } finally {
    fs[syncReadName] = original;
  }

  console.log("smoke_stage5_1_fs_streaming ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});

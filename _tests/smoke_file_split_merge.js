"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { assertMatchesSchema } = require("../src/output_schema_guard");

const {
  commitMerge,
  commitSplit,
  createFileComposeManager,
  prepareMerge,
  prepareSplit,
} = require("../src/util/file_compose");
const { fileMergeTool } = require("../tools/file_merge");
const { fileSplitTool } = require("../tools/file_split");

const ROOT = path.resolve(__dirname, "..");
const WORKSPACE_ROOT = path.resolve(ROOT, "..");
const FIXTURE_REL = "mcp-tests/_control/smoke_file_split_merge";
const FIXTURE = path.join(WORKSPACE_ROOT, ...FIXTURE_REL.split("/"));
const BACKUP_FIXTURE = path.join(WORKSPACE_ROOT, ".mcp_backups", ...FIXTURE_REL.split("/"));

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function workspacePath(name) {
  return `${FIXTURE_REL}/${name}`;
}

async function read(name) {
  return fs.readFile(path.join(FIXTURE, name), "utf8");
}

(async () => {
  assert.equal(fileSplitTool.name, "file_split");
  assert.equal(fileMergeTool.name, "file_merge");
  assert.equal(fileSplitTool.descriptor.annotations.destructiveHint, true);
  assert.equal(fileMergeTool.descriptor.annotations.openWorldHint, false);
  assert.equal((await fileSplitTool.execute({ action: "unknown" })).error.code, "file_compose_action_invalid");
  assert.equal((await fileMergeTool.execute({ action: "unknown" })).error.code, "file_compose_action_invalid");
  await fs.rm(FIXTURE, { recursive: true, force: true });
  await fs.rm(BACKUP_FIXTURE, { recursive: true, force: true });
  await fs.mkdir(FIXTURE, { recursive: true });
  const spec = `# Specification\n${"S".repeat(42 * 1024)}\n`;
  const history = `# Historical log\n${"H".repeat(52 * 1024)}\n`;
  const current = `# Current log\n${"C".repeat(31 * 1024)}\n`;
  const source = `${spec}${history}${current}`;
  assert.ok(Buffer.byteLength(source) > 122 * 1024);
  await fs.writeFile(path.join(FIXTURE, "large.md"), source, "utf8");

  const manager = createFileComposeManager({ storageFile: path.join(FIXTURE, "compose.sqlite") });
  try {
    const splitInput = {
      source: workspacePath("large.md"),
      expected_source_sha256: sha256(source),
      require_full_coverage: true,
      parts: [
        { destination: workspacePath("spec.md"), selector: { kind: "bytes", start_byte: 0, end_byte: Buffer.byteLength(spec) } },
        { destination: workspacePath("archive.md"), selector: { kind: "bytes", start_byte: Buffer.byteLength(spec), end_byte: Buffer.byteLength(spec + history) } },
        { destination: workspacePath("current.md"), selector: { kind: "bytes", start_byte: Buffer.byteLength(spec + history), end_byte: Buffer.byteLength(source) } },
      ],
    };
    const splitPreview = await prepareSplit(splitInput, { composeManager: manager });
    assert.equal(splitPreview.status, "preview");
    assert.equal(splitPreview.outputs.length, 3);
    const splitToolPreview = await fileSplitTool.execute({ ...splitInput, action: "preview" }, { composeManager: manager });
    assert.doesNotThrow(() => assertMatchesSchema(splitToolPreview, fileSplitTool.descriptor.outputSchema, "file_split"));
    const splitCommitted = await commitSplit({ ...splitInput, receipt: splitPreview.receipt }, { composeManager: manager });
    assert.equal(splitCommitted.status, "committed");
    assert.equal(await read("spec.md"), spec);
    assert.equal(await read("archive.md"), history);
    assert.equal(await read("current.md"), current);
    assert.equal(await read("large.md"), source, "split must preserve its source");

    await assert.rejects(
      () => prepareSplit({
        ...splitInput,
        parts: [splitInput.parts[0], { ...splitInput.parts[2], selector: { kind: "bytes", start_byte: Buffer.byteLength(spec) + 1, end_byte: Buffer.byteLength(source) } }],
      }, { composeManager: manager }),
      (error) => error?.code === "file_split_coverage_invalid"
    );
    await assert.rejects(
      () => prepareSplit({
        ...splitInput,
        parts: [splitInput.parts[0], { ...splitInput.parts[1], selector: { kind: "bytes", start_byte: Buffer.byteLength(spec) - 1, end_byte: Buffer.byteLength(spec + history) } }, splitInput.parts[2]],
      }, { composeManager: manager }),
      (error) => error?.code === "file_split_coverage_invalid"
    );

    const fragments = ["one", "two", "three", "four", "five"];
    for (let index = 0; index < fragments.length; index += 1) {
      await fs.writeFile(path.join(FIXTURE, `log-${index + 1}.md`), fragments[index], "utf8");
    }
    const mergeInput = {
      destination: workspacePath("merged.md"),
      separator: "\n---\n",
      sources: fragments.map((text, index) => ({
        path: workspacePath(`log-${index + 1}.md`),
        expected_sha256: sha256(text),
      })),
    };
    const mergePreview = await prepareMerge(mergeInput, { composeManager: manager });
    assert.equal(mergePreview.status, "preview");
    const mergeToolPreview = await fileMergeTool.execute({ ...mergeInput, action: "preview" }, { composeManager: manager });
    assert.doesNotThrow(() => assertMatchesSchema(mergeToolPreview, fileMergeTool.descriptor.outputSchema, "file_merge"));
    const mergeCommitted = await commitMerge({ ...mergeInput, receipt: mergePreview.receipt }, { composeManager: manager });
    assert.equal(mergeCommitted.status, "committed");
    assert.equal(await read("merged.md"), fragments.join("\n---\n"));
    for (let index = 0; index < fragments.length; index += 1) assert.equal(await read(`log-${index + 1}.md`), fragments[index]);

    await assert.rejects(
      () => prepareMerge({ ...mergeInput, sources: [mergeInput.sources[0], mergeInput.sources[0]] }, { composeManager: manager }),
      (error) => error?.code === "file_merge_repeated_source"
    );
    await assert.rejects(
      () => prepareMerge({ ...mergeInput, destination: mergeInput.sources[0].path }, { composeManager: manager }),
      (error) => error?.code === "file_compose_alias_invalid"
    );

    const racePreview = await prepareMerge({ ...mergeInput, destination: workspacePath("race.md") }, { composeManager: manager });
    await fs.writeFile(path.join(FIXTURE, "log-3.md"), "three changed", "utf8");
    await assert.rejects(
      () => commitMerge({ ...mergeInput, destination: workspacePath("race.md"), receipt: racePreview.receipt }, { composeManager: manager }),
      (error) => error?.code === "file_compose_source_changed"
    );
    await fs.writeFile(path.join(FIXTURE, "log-3.md"), "three", "utf8");
  } finally {
    manager.close();
  }

  await fs.writeFile(path.join(FIXTURE, "rollback-one.md"), "old one", "utf8");
  await fs.writeFile(path.join(FIXTURE, "rollback-two.md"), "old two", "utf8");
  const rollbackManager = createFileComposeManager({
    storageFile: path.join(FIXTURE, "rollback.sqlite"),
    dependencies: {
      beforeTargetCommit: async ({ ordinal }) => {
        if (ordinal === 1) throw Object.assign(new Error("injected second commit failure"), { code: "injected_commit_failure" });
      },
    },
  });
  try {
    const input = {
      source: workspacePath("large.md"),
      expected_source_sha256: sha256(source),
      parts: [
        { destination: workspacePath("rollback-one.md"), selector: { kind: "bytes", start_byte: 0, end_byte: Buffer.byteLength(spec) } },
        { destination: workspacePath("rollback-two.md"), selector: { kind: "bytes", start_byte: Buffer.byteLength(spec), end_byte: Buffer.byteLength(spec + history) } },
      ],
    };
    const preview = await prepareSplit(input, { composeManager: rollbackManager });
    await assert.rejects(
      () => commitSplit({ ...input, receipt: preview.receipt }, { composeManager: rollbackManager }),
      /injected second commit failure/
    );
    assert.equal(await read("rollback-one.md"), "old one");
    assert.equal(await read("rollback-two.md"), "old two");
  } finally {
    rollbackManager.close();
  }

  await fs.writeFile(path.join(FIXTURE, "recover-one.md"), "recover old one", "utf8");
  await fs.writeFile(path.join(FIXTURE, "recover-two.md"), "recover old two", "utf8");
  const recoveryDb = path.join(FIXTURE, "recovery.sqlite");
  const crashingManager = createFileComposeManager({
    storageFile: recoveryDb,
    dependencies: {
      afterTargetCommit: async ({ ordinal }) => {
        if (ordinal === 0) throw Object.assign(new Error("simulated process crash"), { code: "file_compose_simulated_crash" });
      },
    },
  });
  let crashedOperationId;
  try {
    const input = {
      source: workspacePath("large.md"),
      expected_source_sha256: sha256(source),
      parts: [
        { destination: workspacePath("recover-one.md"), selector: { kind: "bytes", start_byte: 0, end_byte: Buffer.byteLength(spec) } },
        { destination: workspacePath("recover-two.md"), selector: { kind: "bytes", start_byte: Buffer.byteLength(spec), end_byte: Buffer.byteLength(spec + history) } },
      ],
    };
    const preview = await prepareSplit(input, { composeManager: crashingManager });
    await assert.rejects(
      async () => {
        try {
          await commitSplit({ ...input, receipt: preview.receipt }, { composeManager: crashingManager });
        } catch (error) {
          crashedOperationId = error.operationId;
          throw error;
        }
      },
      (error) => error?.code === "file_compose_simulated_crash"
    );
  } finally {
    crashingManager.close();
  }

  const recoveredManager = createFileComposeManager({ storageFile: recoveryDb });
  try {
    const recovered = await recoveredManager.recover();
    assert.ok(recovered.some((item) => item.operation_id === crashedOperationId && item.status === "rolled_back"));
    assert.equal(await read("recover-one.md"), "recover old one");
    assert.equal(await read("recover-two.md"), "recover old two");
    assert.equal(recoveredManager.getOperation(crashedOperationId).status, "rolled_back");
    const leftovers = (await fs.readdir(FIXTURE)).filter((name) => name.includes(".mcp-compose-"));
    assert.deepEqual(leftovers, []);
  } finally {
    recoveredManager.close();
    await fs.rm(FIXTURE, { recursive: true, force: true });
    await fs.rm(BACKUP_FIXTURE, { recursive: true, force: true });
  }

  console.log("smoke_file_split_merge ok");
})().catch((error) => {
  console.error(error?.stack || error);
  process.exit(1);
});

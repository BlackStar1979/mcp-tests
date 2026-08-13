"use strict";

const { createHash, randomUUID } = require("node:crypto");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const { DEFAULT_MAX_FILE_BYTES, inspectTextFile, resolveSelector } = require("./file_selectors");
const { createBackupIfExists, resolveWritableWorkspacePath } = require("./workspace_mutation");
const { safeWorkspacePath } = require("./workspace_roots");

let defaultManager = null;

function composeError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function hashReceipt(kind, payload) {
  return createHash("sha256")
    .update(`file-compose-${kind}-receipt-v1\0`, "utf8")
    .update(JSON.stringify(canonicalize(payload)), "utf8")
    .digest("hex");
}

function pathKey(absolutePath) {
  const value = path.resolve(absolutePath);
  return process.platform === "win32" ? value.toLowerCase() : value;
}

function configuredMaxBytes(context = {}) {
  const value = Number(context.maxFileBytes || process.env.MCP_STRUCTURED_FILE_MAX_BYTES || DEFAULT_MAX_FILE_BYTES);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw composeError("Structured file max byte limit must be a positive integer.", "structured_file_config_invalid");
  }
  return value;
}

async function inspectDestination(resolved, maxBytes) {
  try {
    const info = await inspectTextFile(resolved.absolutePath, { maxFileBytes: maxBytes });
    return { exists: true, sha256: info.fileSha256, mode: info.mode, bytes: info.bytes };
  } catch (error) {
    if (error?.code === "ENOENT") return { exists: false, sha256: null, mode: null, bytes: 0 };
    throw error;
  }
}

async function measureMerge(sources, separator) {
  const hash = createHash("sha256");
  const separatorBuffer = Buffer.from(separator, "utf8");
  let bytes = 0;
  for (let index = 0; index < sources.length; index += 1) {
    if (index > 0 && separatorBuffer.length) {
      hash.update(separatorBuffer);
      bytes += separatorBuffer.length;
    }
    for await (const chunk of fs.createReadStream(sources[index].absolutePath)) {
      hash.update(chunk);
      bytes += chunk.length;
    }
  }
  return { bytes, sha256: hash.digest("hex") };
}

function splitCoverage(ranges, sourceBytes) {
  const sorted = [...ranges].sort((left, right) => left.startByte - right.startByte || left.endByte - right.endByte);
  let cursor = 0;
  for (const range of sorted) {
    if (range.startByte !== cursor || range.endByte < range.startByte) return false;
    cursor = range.endByte;
  }
  return cursor === sourceBytes;
}

async function compileSplit(input = {}, context = {}) {
  const maxBytes = configuredMaxBytes(context);
  const source = safeWorkspacePath(input.source);
  const sourceInfo = await inspectTextFile(source.absolutePath, { maxFileBytes: maxBytes });
  if (String(input.expected_source_sha256 || "").toLowerCase() !== sourceInfo.fileSha256) {
    throw composeError("Split source changed or expected_source_sha256 is invalid.", "file_compose_source_changed");
  }
  if (!Array.isArray(input.parts) || input.parts.length < 1) {
    throw composeError("Split requires at least one destination part.", "file_split_parts_invalid");
  }
  const destinations = new Set();
  const outputs = [];
  for (let ordinal = 0; ordinal < input.parts.length; ordinal += 1) {
    const part = input.parts[ordinal] || {};
    const destination = resolveWritableWorkspacePath(part.destination, { allowProtected: input.allow_protected === true });
    const destinationKey = pathKey(destination.absolutePath);
    if (destinationKey === pathKey(source.absolutePath)) {
      throw composeError("Split destination cannot alias its source.", "file_compose_alias_invalid");
    }
    if (destinations.has(destinationKey)) {
      throw composeError("Split destinations must be unique.", "file_compose_destination_duplicate");
    }
    destinations.add(destinationKey);
    const selected = await resolveSelector(source.absolutePath, part.selector, {
      fileInfo: sourceInfo,
      maxFileBytes: maxBytes,
      markdownResolver: context.markdownResolver,
    });
    const prior = await inspectDestination(destination, Number.MAX_SAFE_INTEGER);
    outputs.push({
      ordinal,
      destination,
      prior,
      bytes: selected.bytes,
      resultSha256: selected.rangeSha256,
      mode: prior.mode || sourceInfo.mode,
      writer: { kind: "range", absolutePath: source.absolutePath, startByte: selected.startByte, endByte: selected.endByte },
      selector: {
        start_byte: selected.startByte,
        end_byte: selected.endByte,
        range_sha256: selected.rangeSha256,
      },
    });
  }
  if (input.require_full_coverage === true && !splitCoverage(outputs.map((item) => ({
    startByte: item.writer.startByte,
    endByte: item.writer.endByte,
  })), sourceInfo.bytes)) {
    throw composeError("Split parts contain a gap or overlap and do not cover the complete source.", "file_split_coverage_invalid");
  }
  const receiptPayload = {
    source: source.displayPath,
    source_sha256: sourceInfo.fileSha256,
    source_bytes: sourceInfo.bytes,
    require_full_coverage: input.require_full_coverage === true,
    outputs: outputs.map((item) => ({
      ordinal: item.ordinal,
      destination: item.destination.displayPath,
      start_byte: item.writer.startByte,
      end_byte: item.writer.endByte,
      result_sha256: item.resultSha256,
      prior_sha256: item.prior.sha256,
      prior_exists: item.prior.exists,
    })),
  };
  return {
    kind: "split",
    maxBytes,
    sourceManifest: [{ path: source.displayPath, absolutePath: source.absolutePath, sha256: sourceInfo.fileSha256 }],
    outputs,
    receiptPayload,
    receipt: hashReceipt("split", receiptPayload),
  };
}

async function compileMerge(input = {}, context = {}) {
  const maxBytes = configuredMaxBytes(context);
  if (!Array.isArray(input.sources) || input.sources.length < 1) {
    throw composeError("Merge requires at least one source file.", "file_merge_sources_invalid");
  }
  const separator = String(input.separator || "");
  if (typeof separator.isWellFormed === "function" && !separator.isWellFormed()) {
    throw composeError("Merge separator contains an unpaired UTF-16 surrogate.", "structured_file_invalid_utf8");
  }
  const seen = new Set();
  const sources = [];
  for (const item of input.sources) {
    const resolved = safeWorkspacePath(item.path);
    const key = pathKey(resolved.absolutePath);
    if (seen.has(key) && input.allow_repeated_sources !== true) {
      throw composeError("Repeated merge source requires allow_repeated_sources=true.", "file_merge_repeated_source");
    }
    seen.add(key);
    const info = await inspectTextFile(resolved.absolutePath, { maxFileBytes: maxBytes });
    if (String(item.expected_sha256 || "").toLowerCase() !== info.fileSha256) {
      throw composeError("Merge source changed or expected_sha256 is invalid.", "file_compose_source_changed");
    }
    sources.push({ ...resolved, ...info, sha256: info.fileSha256 });
  }
  const destination = resolveWritableWorkspacePath(input.destination, { allowProtected: input.allow_protected === true });
  if (sources.some((item) => pathKey(item.absolutePath) === pathKey(destination.absolutePath))) {
    throw composeError("Merge destination cannot alias a source.", "file_compose_alias_invalid");
  }
  const prior = await inspectDestination(destination, Number.MAX_SAFE_INTEGER);
  const measured = await measureMerge(sources, separator);
  if (measured.bytes > maxBytes) {
    throw composeError(`Merged result exceeds ${maxBytes} bytes.`, "structured_file_size_limit");
  }
  const output = {
    ordinal: 0,
    destination,
    prior,
    bytes: measured.bytes,
    resultSha256: measured.sha256,
    mode: prior.mode || sources[0].mode,
    writer: { kind: "merge", sources, separator },
  };
  const receiptPayload = {
    sources: sources.map((item, ordinal) => ({ ordinal, path: item.displayPath, sha256: item.sha256, bytes: item.bytes })),
    destination: destination.displayPath,
    prior_sha256: prior.sha256,
    prior_exists: prior.exists,
    separator_sha256: createHash("sha256").update(separator, "utf8").digest("hex"),
    result_sha256: measured.sha256,
    result_bytes: measured.bytes,
    allow_repeated_sources: input.allow_repeated_sources === true,
  };
  return {
    kind: "merge",
    maxBytes,
    sourceManifest: sources.map((item) => ({ path: item.displayPath, absolutePath: item.absolutePath, sha256: item.sha256 })),
    outputs: [output],
    receiptPayload,
    receipt: hashReceipt("merge", receiptPayload),
  };
}

function previewPayload(compiled) {
  return {
    status: "preview",
    kind: compiled.kind,
    source_count: compiled.sourceManifest.length,
    output_count: compiled.outputs.length,
    outputs: compiled.outputs.map((item) => ({
      ordinal: item.ordinal,
      destination: item.destination.displayPath,
      bytes: item.bytes,
      result_sha256: item.resultSha256,
      prior_sha256: item.prior.sha256,
      prior_exists: item.prior.exists,
      ...(item.selector ? { selector: item.selector } : {}),
    })),
    receipt: compiled.receipt,
  };
}

function createFileComposeManager(options = {}) {
  const storageFile = String(options.storageFile || ":memory:");
  const normalizedStorage = storageFile === ":memory:" ? storageFile : path.resolve(storageFile);
  if (normalizedStorage !== ":memory:") fs.mkdirSync(path.dirname(normalizedStorage), { recursive: true });
  const db = options.database || new DatabaseSync(normalizedStorage, { timeout: 5000 });
  const dependencies = options.dependencies || {};
  let executionTail = Promise.resolve();
  db.exec("PRAGMA foreign_keys=ON");
  db.exec("PRAGMA busy_timeout=5000");
  db.exec("PRAGMA synchronous=FULL");
  if (normalizedStorage !== ":memory:") db.exec("PRAGMA journal_mode=WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS file_compose_operations (
      operation_id TEXT PRIMARY KEY,
      kind TEXT NOT NULL CHECK(kind IN ('split', 'merge')),
      status TEXT NOT NULL,
      receipt TEXT NOT NULL,
      source_manifest_json TEXT NOT NULL,
      destination_manifest_json TEXT NOT NULL,
      created_at_ms INTEGER NOT NULL,
      updated_at_ms INTEGER NOT NULL,
      error TEXT
    );
    CREATE TABLE IF NOT EXISTS file_compose_targets (
      operation_id TEXT NOT NULL,
      ordinal INTEGER NOT NULL,
      destination TEXT NOT NULL,
      temp_path TEXT,
      backup_path TEXT,
      prior_exists INTEGER NOT NULL,
      prior_sha256 TEXT,
      result_sha256 TEXT NOT NULL,
      state TEXT NOT NULL,
      PRIMARY KEY(operation_id, ordinal),
      FOREIGN KEY(operation_id) REFERENCES file_compose_operations(operation_id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_file_compose_operations_status
      ON file_compose_operations(status, updated_at_ms);
  `);

  function transaction(callback) {
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = callback();
      db.exec("COMMIT");
      return result;
    } catch (error) {
      try { db.exec("ROLLBACK"); } catch {}
      throw error;
    }
  }

  async function runExclusive(callback) {
    const previous = executionTail;
    let release;
    executionTail = new Promise((resolve) => { release = resolve; });
    await previous;
    try {
      return await callback();
    } finally {
      release();
    }
  }

  function setOperationStatus(operationId, status, error = null) {
    db.prepare(`UPDATE file_compose_operations SET status=?, updated_at_ms=?, error=? WHERE operation_id=?`)
      .run(status, Date.now(), error, operationId);
  }

  function setTarget(operationId, ordinal, fields) {
    const allowed = ["temp_path", "backup_path", "state"];
    const entries = Object.entries(fields).filter(([key]) => allowed.includes(key));
    if (!entries.length) return;
    const sql = `UPDATE file_compose_targets SET ${entries.map(([key]) => `${key}=?`).join(", ")} WHERE operation_id=? AND ordinal=?`;
    db.prepare(sql).run(...entries.map(([, value]) => value), operationId, ordinal);
  }

  function getOperation(operationId) {
    const row = db.prepare("SELECT * FROM file_compose_operations WHERE operation_id=?").get(operationId);
    if (!row) return null;
    const targets = db.prepare("SELECT * FROM file_compose_targets WHERE operation_id=? ORDER BY ordinal").all(operationId);
    return {
      operationId: row.operation_id,
      operation_id: row.operation_id,
      kind: row.kind,
      status: row.status,
      receipt: row.receipt,
      sourceManifest: JSON.parse(row.source_manifest_json),
      destinationManifest: JSON.parse(row.destination_manifest_json),
      error: row.error,
      targets: targets.map((item) => ({
        ordinal: Number(item.ordinal),
        destination: item.destination,
        tempPath: item.temp_path,
        backupPath: item.backup_path,
        priorExists: item.prior_exists === 1,
        priorSha256: item.prior_sha256,
        resultSha256: item.result_sha256,
        state: item.state,
      })),
    };
  }

  async function verifyDestination(target) {
    const resolved = safeWorkspacePath(target.destination);
    const current = await inspectDestination(resolved, Number.MAX_SAFE_INTEGER);
    if (current.exists !== target.priorExists || current.sha256 !== target.priorSha256) {
      throw composeError("Composition destination changed after preview.", "file_compose_destination_changed");
    }
  }

  async function writeFully(handle, buffer) {
    let offset = 0;
    while (offset < buffer.length) {
      const result = await handle.write(buffer, offset, buffer.length - offset, null);
      if (!result.bytesWritten) throw composeError("Prepared file writer made no progress.", "file_compose_write_stalled");
      offset += result.bytesWritten;
    }
  }

  async function writeStream(handle, stream, hashState) {
    for await (const chunk of stream) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), "utf8");
      await writeFully(handle, buffer);
      hashState.hash.update(buffer);
      hashState.bytes += buffer.length;
    }
  }

  async function prepareTarget(operationId, output) {
    const directory = path.dirname(output.destination.absolutePath);
    const tempPath = path.join(directory, `.${path.basename(output.destination.absolutePath)}.mcp-compose-${operationId}-${output.ordinal}`);
    await fsp.mkdir(directory, { recursive: true });
    await fsp.rm(tempPath, { force: true });
    let handle;
    let prepared = false;
    const hashState = { hash: createHash("sha256"), bytes: 0 };
    try {
      handle = await fsp.open(tempPath, "wx", Number(output.mode || 0o600) & 0o777);
      if (output.writer.kind === "range") {
        if (output.writer.endByte > output.writer.startByte) {
          await writeStream(handle, fs.createReadStream(output.writer.absolutePath, {
            start: output.writer.startByte,
            end: output.writer.endByte - 1,
          }), hashState);
        }
      } else {
        const separator = Buffer.from(output.writer.separator, "utf8");
        for (let index = 0; index < output.writer.sources.length; index += 1) {
          if (index > 0 && separator.length) {
            await writeFully(handle, separator);
            hashState.hash.update(separator);
            hashState.bytes += separator.length;
          }
          await writeStream(handle, fs.createReadStream(output.writer.sources[index].absolutePath), hashState);
        }
      }
      await handle.sync();
      await handle.close();
      handle = null;
      await fsp.chmod(tempPath, Number(output.mode || 0o600) & 0o777);
      const sha256 = hashState.hash.digest("hex");
      if (hashState.bytes !== output.bytes || sha256 !== output.resultSha256) {
        throw composeError("Prepared composition output failed integrity verification.", "file_compose_prepare_integrity_failed");
      }
      setTarget(operationId, output.ordinal, { temp_path: tempPath, state: "prepared" });
      prepared = true;
      return tempPath;
    } finally {
      try { await handle?.close(); } catch {}
      if (!prepared) await fsp.rm(tempPath, { force: true });
    }
  }

  async function restoreBackup(target) {
    const destination = safeWorkspacePath(target.destination);
    const current = await inspectDestination(destination, Number.MAX_SAFE_INTEGER);
    if (!target.priorExists) {
      if (current.exists && current.sha256 !== target.resultSha256) {
        throw composeError("Rollback refused to delete a destination changed after commit.", "file_compose_recovery_conflict");
      }
      await fsp.rm(destination.absolutePath, { force: true });
      return;
    }
    if (current.exists && current.sha256 === target.priorSha256) return;
    if (current.exists && current.sha256 !== target.resultSha256) {
      throw composeError("Rollback refused to overwrite a destination changed after commit.", "file_compose_recovery_conflict");
    }
    if (!target.backupPath) {
      throw composeError("Rollback backup is missing for a replaced destination.", "file_compose_recovery_backup_missing");
    }
    const backup = safeWorkspacePath(target.backupPath);
    const rollbackTemp = path.join(path.dirname(destination.absolutePath), `.${path.basename(destination.absolutePath)}.mcp-compose-rollback-${randomUUID()}`);
    try {
      await fsp.copyFile(backup.absolutePath, rollbackTemp);
      const handle = await fsp.open(rollbackTemp, "r+");
      try { await handle.sync(); } finally { await handle.close(); }
      await fsp.rename(rollbackTemp, destination.absolutePath);
    } finally {
      await fsp.rm(rollbackTemp, { force: true });
    }
  }

  async function rollbackOperation(operationId) {
    const operation = getOperation(operationId);
    if (!operation) throw composeError("Unknown file composition operation.", "file_compose_operation_not_found");
    const failures = [];
    for (const target of [...operation.targets].reverse()) {
      try {
        let committed = target.state === "committed";
        if (!committed) {
          const current = await inspectDestination(safeWorkspacePath(target.destination), Number.MAX_SAFE_INTEGER);
          committed = current.exists
            && current.sha256 === target.resultSha256
            && (target.priorExists ? Boolean(target.backupPath) : true);
        }
        if (committed) await restoreBackup(target);
        if (target.tempPath) await fsp.rm(target.tempPath, { force: true });
        setTarget(operationId, target.ordinal, { state: "rolled_back", temp_path: null });
      } catch (error) {
        failures.push({ ordinal: target.ordinal, error: error?.message || String(error) });
      }
    }
    if (failures.length) {
      setOperationStatus(operationId, "recovery_failed", JSON.stringify(failures));
      throw composeError("File composition rollback could not restore every destination.", "file_compose_recovery_failed");
    }
    setOperationStatus(operationId, "rolled_back");
    return { operation_id: operationId, status: "rolled_back" };
  }

  async function recoverPending() {
    const rows = db.prepare(`SELECT operation_id FROM file_compose_operations WHERE status NOT IN ('committed', 'rolled_back', 'recovery_failed') ORDER BY created_at_ms`).all();
    const recovered = [];
    for (const row of rows) recovered.push(await rollbackOperation(row.operation_id));
    return recovered;
  }

  async function executeExclusive(compiled) {
    await recoverPending();
    const operationId = randomUUID();
    const now = Date.now();
    transaction(() => {
      db.prepare(`
        INSERT INTO file_compose_operations (
          operation_id, kind, status, receipt, source_manifest_json, destination_manifest_json, created_at_ms, updated_at_ms
        ) VALUES (?, ?, 'preparing', ?, ?, ?, ?, ?)
      `).run(
        operationId,
        compiled.kind,
        compiled.receipt,
        JSON.stringify(compiled.sourceManifest.map(({ absolutePath, ...item }) => item)),
        JSON.stringify(compiled.outputs.map((item) => ({
          ordinal: item.ordinal,
          destination: item.destination.displayPath,
          prior_exists: item.prior.exists,
          prior_sha256: item.prior.sha256,
          result_sha256: item.resultSha256,
        }))),
        now,
        now
      );
      const insert = db.prepare(`
        INSERT INTO file_compose_targets (
          operation_id, ordinal, destination, prior_exists, prior_sha256, result_sha256, state
        ) VALUES (?, ?, ?, ?, ?, ?, 'pending')
      `);
      for (const output of compiled.outputs) {
        insert.run(operationId, output.ordinal, output.destination.displayPath, output.prior.exists ? 1 : 0, output.prior.sha256, output.resultSha256);
      }
    });
    try {
      for (const output of compiled.outputs) await prepareTarget(operationId, output);
      setOperationStatus(operationId, "prepared");
      for (const source of compiled.sourceManifest) {
        const current = await inspectTextFile(source.absolutePath, { maxFileBytes: compiled.maxBytes || DEFAULT_MAX_FILE_BYTES });
        if (current.fileSha256 !== source.sha256) throw composeError("Composition source changed during preparation.", "file_compose_source_changed");
      }
      for (const target of getOperation(operationId).targets) await verifyDestination(target);
      setOperationStatus(operationId, "committing");
      for (const output of compiled.outputs) {
        if (typeof dependencies.beforeTargetCommit === "function") await dependencies.beforeTargetCommit({ operationId, ordinal: output.ordinal });
        const backupPath = await createBackupIfExists(output.destination);
        setTarget(operationId, output.ordinal, { backup_path: backupPath });
        await verifyDestination(getOperation(operationId).targets.find((item) => item.ordinal === output.ordinal));
        const target = getOperation(operationId).targets.find((item) => item.ordinal === output.ordinal);
        await (dependencies.rename || fsp.rename)(target.tempPath, output.destination.absolutePath);
        setTarget(operationId, output.ordinal, { state: "committed", temp_path: null });
        if (typeof dependencies.afterTargetCommit === "function") await dependencies.afterTargetCommit({ operationId, ordinal: output.ordinal });
      }
      setOperationStatus(operationId, "committed");
      return { operationId, operation_id: operationId, status: "committed" };
    } catch (error) {
      error.operationId = operationId;
      if (error?.code === "file_compose_simulated_crash") throw error;
      try {
        await rollbackOperation(operationId);
      } catch (rollbackError) {
        error.rollbackError = rollbackError;
      }
      throw error;
    }
  }

  async function recover() {
    return runExclusive(recoverPending);
  }

  async function execute(compiled) {
    return runExclusive(() => executeExclusive(compiled));
  }

  function close() {
    db.close();
  }

  return { close, execute, getOperation, recover, storageFile: normalizedStorage };
}

function resolveManager(context = {}) {
  if (context.composeManager) return context.composeManager;
  if (!defaultManager) {
    const storageFile = process.env.MCP_FILE_COMPOSE_STORAGE_FILE
      || path.resolve(__dirname, "..", "..", "_control", "file-compose.sqlite");
    defaultManager = createFileComposeManager({ storageFile });
  }
  return defaultManager;
}

async function prepareSplit(input = {}, context = {}) {
  return previewPayload(await compileSplit(input, context));
}

async function commitSplit(input = {}, context = {}) {
  const compiled = await compileSplit(input, context);
  if (String(input.receipt || "") !== compiled.receipt) {
    throw composeError("Split receipt does not match current sources and destinations.", "file_compose_receipt_invalid");
  }
  const result = await resolveManager(context).execute(compiled);
  return { ...previewPayload(compiled), ...result };
}

async function prepareMerge(input = {}, context = {}) {
  return previewPayload(await compileMerge(input, context));
}

async function commitMerge(input = {}, context = {}) {
  const compiled = await compileMerge(input, context);
  if (String(input.receipt || "") !== compiled.receipt) {
    throw composeError("Merge receipt does not match current sources and destination.", "file_compose_receipt_invalid");
  }
  const result = await resolveManager(context).execute(compiled);
  return { ...previewPayload(compiled), ...result };
}

module.exports = {
  commitMerge,
  commitSplit,
  createFileComposeManager,
  prepareMerge,
  prepareSplit,
};

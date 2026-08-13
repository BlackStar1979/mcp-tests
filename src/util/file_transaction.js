"use strict";

const { createHash, randomUUID } = require("node:crypto");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");

function transactionError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function resolveDependencies(overrides = {}) {
  return {
    chmod: overrides.chmod || fsp.chmod.bind(fsp),
    createReadStream: overrides.createReadStream || fs.createReadStream.bind(fs),
    mkdir: overrides.mkdir || fsp.mkdir.bind(fsp),
    open: overrides.open || fsp.open.bind(fsp),
    rename: overrides.rename || fsp.rename.bind(fsp),
    rm: overrides.rm || fsp.rm.bind(fsp),
  };
}

async function writeHandleFully(handle, buffer) {
  let offset = 0;
  while (offset < buffer.length) {
    const result = await handle.write(buffer, offset, buffer.length - offset, null);
    if (!result.bytesWritten) throw transactionError("Atomic writer made no progress.", "file_transaction_write_stalled");
    offset += result.bytesWritten;
  }
}

async function flushParentDirectory(directory, deps) {
  let handle;
  try {
    handle = await deps.open(directory, "r");
    await handle.sync();
    return null;
  } catch (error) {
    return `parent directory flush unavailable: ${error?.code || error?.message || String(error)}`;
  } finally {
    try { await handle?.close(); } catch {}
  }
}

async function atomicReplaceFile(options = {}) {
  const targetPath = path.resolve(String(options.targetPath || ""));
  const directory = path.dirname(targetPath);
  const basename = path.basename(targetPath);
  const deps = resolveDependencies(options.dependencies);
  const tempPath = path.join(directory, `.${basename}.mcp-tmp-${randomUUID()}`);
  const maxBytes = Number(options.maxBytes);
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw transactionError("Atomic writer maxBytes must be a positive integer.", "file_transaction_config_invalid");
  }
  if (typeof options.writeContent !== "function") {
    throw transactionError("Atomic writer requires writeContent.", "file_transaction_config_invalid");
  }
  await deps.mkdir(directory, { recursive: true });
  let handle = null;
  let committed = false;
  let bytesWritten = 0;
  const outputHash = createHash("sha256");
  try {
    handle = await deps.open(tempPath, "wx", Number(options.mode || 0o600) & 0o777);
    const writer = {
      async write(value) {
        const buffer = Buffer.isBuffer(value) ? value : Buffer.from(String(value), "utf8");
        if (bytesWritten + buffer.length > maxBytes) {
          throw transactionError(`Structured file result exceeds ${maxBytes} bytes.`, "structured_file_size_limit");
        }
        await writeHandleFully(handle, buffer);
        outputHash.update(buffer);
        bytesWritten += buffer.length;
      },
      async writeStream(stream) {
        for await (const chunk of stream) await this.write(chunk);
      },
      async copyRange(sourcePath, startByte, endByte) {
        if (endByte <= startByte) return;
        const stream = deps.createReadStream(sourcePath, { start: startByte, end: endByte - 1 });
        await this.writeStream(stream);
      },
      get bytesWritten() {
        return bytesWritten;
      },
    };

    await options.writeContent(writer);
    await handle.sync();
    await handle.close();
    handle = null;
    await deps.chmod(tempPath, Number(options.mode || 0o600) & 0o777);
    const backup = typeof options.createBackup === "function" ? await options.createBackup() : null;
    if (typeof options.verifyBeforeRename === "function") await options.verifyBeforeRename();
    await deps.rename(tempPath, targetPath);
    committed = true;
    const warning = await flushParentDirectory(directory, deps);
    return {
      backup,
      bytes: bytesWritten,
      sha256: outputHash.digest("hex"),
      tempPath,
      warning,
    };
  } finally {
    try { await handle?.close(); } catch {}
    if (!committed) {
      try { await deps.rm(tempPath, { force: true }); } catch {}
    }
  }
}

module.exports = { atomicReplaceFile };

"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const posixPath = require("node:path/posix");

const DEFAULT_MAX_FILE_BYTES = 256 * 1024;
const DEFAULT_RETENTION_DAYS = Object.freeze({
  logs: 30,
  edits: 30,
  trash: 14,
  meta: 180,
});
const ALLOWED_EXTENSIONS = new Set([".html", ".css", ".js", ".txt", ".json", ".svg", ".ico"]);
const OPS_AREAS = new Set(["logs", "edits", "trash", "meta"]);
const REMOTE_SITE_SCHEMA_VERSION = 1;

function normalizeRemoteRelativePath(input, { allowDot = false } = {}) {
  if (typeof input !== "string" || input.trim() === "") {
    throw new Error("remote_path must be a non-empty string");
  }
  const raw = input.replaceAll("\\", "/").trim();
  if (raw.startsWith("/")) throw new Error("absolute remote paths are not allowed");
  if (raw.includes("\0")) throw new Error("NUL byte is not allowed");
  const normalized = posixPath.normalize(raw);
  if (allowDot && (normalized === "." || normalized === "")) return ".";
  if (normalized === "." || normalized === "") throw new Error("remote_path must target a file or directory");
  if (normalized === ".." || normalized.startsWith("../")) throw new Error("path traversal is not allowed");
  if (normalized.split("/").some((part) => part === ".." || part === "")) throw new Error("unsafe path segment");
  return normalized;
}

function joinRemoteUnderRoot(root, relativePath) {
  const cleanRoot = posixPath.normalize(String(root || "").replaceAll("\\", "/"));
  if (!cleanRoot.startsWith("/")) throw new Error("remote root must be absolute POSIX path");
  const cleanRel = normalizeRemoteRelativePath(relativePath);
  const joined = posixPath.normalize(posixPath.join(cleanRoot, cleanRel));
  if (joined !== cleanRoot && !joined.startsWith(`${cleanRoot}/`)) {
    throw new Error("resolved remote path escapes root");
  }
  return joined;
}

function normalizeConfigRef(configRef) {
  if (typeof configRef !== "string" || configRef.trim() === "") {
    throw new Error("vps_config_ref must be a non-empty string");
  }
  const resolved = path.resolve(configRef.trim());
  const ext = path.extname(resolved).toLowerCase();
  if (ext !== ".json") {
    throw new Error("vps_config_ref must point to a .json file");
  }
  return resolved;
}

async function loadRemoteConfig(configRef) {
  const configPath = normalizeConfigRef(configRef);
  const raw = await fs.readFile(configPath, "utf8");
  const parsed = JSON.parse(raw);
  const requiredKeys = ["host", "username", "privateKeyPath", "siteRoot", "opsRoot"];
  for (const key of requiredKeys) {
    if (typeof parsed[key] !== "string" || parsed[key].trim() === "") {
      throw new Error(`remote config missing required field: ${key}`);
    }
  }
  const privateKeyPath = path.resolve(String(parsed.privateKeyPath));
  const privateKey = await fs.readFile(privateKeyPath, "utf8");
  const allowedExtensions = Array.isArray(parsed.allowedExtensions) && parsed.allowedExtensions.length > 0
    ? new Set(parsed.allowedExtensions.map((value) => String(value).toLowerCase()))
    : new Set(ALLOWED_EXTENSIONS);
  return {
    host: String(parsed.host),
    port: Number.isInteger(parsed.port) ? parsed.port : 22,
    username: String(parsed.username),
    privateKey,
    passphrase: typeof parsed.passphrase === "string" ? parsed.passphrase : undefined,
    siteRoot: posixPath.normalize(String(parsed.siteRoot).replaceAll("\\", "/")),
    opsRoot: posixPath.normalize(String(parsed.opsRoot).replaceAll("\\", "/")),
    maxFileBytes: Number.isInteger(parsed.maxFileBytes) ? parsed.maxFileBytes : DEFAULT_MAX_FILE_BYTES,
    allowedExtensions,
  };
}

async function loadSftpClient() {
  const mod = require("ssh2-sftp-client");
  return mod.default || mod;
}

async function withSftp(configRef, fn, deps = {}) {
  const loadRemoteConfigImpl = typeof deps.loadRemoteConfig === "function" ? deps.loadRemoteConfig : loadRemoteConfig;
  const loadSftpClientImpl = typeof deps.loadSftpClient === "function" ? deps.loadSftpClient : loadSftpClient;
  const config = await loadRemoteConfigImpl(configRef);
  const SftpClient = await loadSftpClientImpl();
  const client = new SftpClient();
  let result;
  let operationError = null;
  try {
    await client.connect({
      host: config.host,
      port: config.port,
      username: config.username,
      privateKey: config.privateKey,
      passphrase: config.passphrase,
      readyTimeout: 15000,
    });
    await ensureRemoteSiteOpsDirs(client, config);
    result = await fn(client, config);
  } catch (error) {
    operationError = error;
  }
  try {
    await client.end();
  } catch (cleanupError) {
    const cleanupMessage = cleanupError?.message || String(cleanupError);
    if (operationError) {
      operationError.message = `${operationError.message} [cleanup failed: ${cleanupMessage}]`;
    } else {
      throw cleanupError;
    }
  }
  if (operationError) throw operationError;
  return result;
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function generateOperationId() {
  return crypto.randomUUID();
}

function generateCorrelationId() {
  return crypto.randomUUID();
}

function artifactPath({ opsRoot, kind, remotePath, suffix }) {
  const cleanRel = normalizeRemoteRelativePath(remotePath);
  const parsed = posixPath.parse(cleanRel);
  const safeName = `${parsed.name}__${suffix}_${timestamp()}${parsed.ext || ""}`;
  return posixPath.join(opsRoot, kind, parsed.dir, safeName);
}

function diffPath({ opsRoot, remotePath }) {
  const cleanRel = normalizeRemoteRelativePath(remotePath);
  const parsed = posixPath.parse(cleanRel);
  const safeName = `${parsed.name}__edited_${timestamp()}${parsed.ext || ""}.diff`;
  return posixPath.join(opsRoot, "edits", parsed.dir, safeName);
}

async function ensureRemoteDir(client, remoteDir) {
  await client.mkdir(remoteDir, true);
}

async function ensureRemoteSiteOpsDirs(client, configOrOpsRoot) {
  const opsRoot = resolveOpsRoot(configOrOpsRoot);
  for (const dir of OPS_AREAS) {
    await ensureRemoteDir(client, posixPath.join(opsRoot, dir));
  }
  return opsRoot;
}

function resolveOpsRoot(configOrOpsRoot) {
  if (typeof configOrOpsRoot === "string") return configOrOpsRoot;
  if (configOrOpsRoot && typeof configOrOpsRoot === "object" && typeof configOrOpsRoot.opsRoot === "string") {
    return configOrOpsRoot.opsRoot;
  }
  throw new Error("unable to resolve remote ops root");
}

function safeString(value) {
  const text = String(value ?? "");
  return text.length <= 4000 ? text : `${text.slice(0, 4000)}...[truncated:${text.length - 4000}]`;
}

function safeValue(value, depth = 0) {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return safeString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) {
    const out = value.slice(0, 100).map((item) => safeValue(item, depth + 1));
    if (value.length > 100) out.push({ truncated_items: value.length - 100 });
    return out;
  }
  if (typeof value === "object") {
    if (depth >= 5) return { type: "object", truncated_depth: true };
    const out = {};
    const keys = Object.keys(value);
    for (const [index, key] of keys.entries()) {
      if (index >= 100) {
        out.truncated_keys = keys.length - 100;
        break;
      }
      out[key] = safeValue(value[key], depth + 1);
    }
    return out;
  }
  return safeString(value);
}

function buildRemoteMetadataRecord({
  operation,
  remotePath,
  artifactPath: remoteArtifactPath,
  actor = "codex-mcp-tests",
  correlationId,
  operationId,
  details = {},
}) {
  if (!operation) throw new Error("buildRemoteMetadataRecord requires operation");
  if (!remotePath) throw new Error("buildRemoteMetadataRecord requires remotePath");
  return {
    schema_version: REMOTE_SITE_SCHEMA_VERSION,
    operation_id: operationId || generateOperationId(),
    correlation_id: correlationId || generateCorrelationId(),
    operation,
    actor,
    remote_path: remotePath,
    artifact_path: remoteArtifactPath || null,
    created_at: new Date().toISOString(),
    details: safeValue(details),
  };
}

function metadataFilenameForRecord(record) {
  if (!record?.operation_id) throw new Error("metadataFilenameForRecord requires operation_id");
  return `${record.operation_id}.json`;
}

function metadataPathForRecord(metaRoot, record) {
  if (!metaRoot) throw new Error("metadataPathForRecord requires metaRoot");
  return posixPath.join(metaRoot, metadataFilenameForRecord(record));
}

function buildMetadataManifestLocation({ opsRoot, record }) {
  if (!opsRoot) throw new Error("buildMetadataManifestLocation requires opsRoot");
  if (!record) throw new Error("buildMetadataManifestLocation requires record");
  const metaRoot = posixPath.join(opsRoot, "meta");
  return {
    meta_root: metaRoot,
    filename: metadataFilenameForRecord(record),
    full_path: metadataPathForRecord(metaRoot, record),
  };
}

async function writeRemoteMetadataManifest(client, config, manifest) {
  const location = buildMetadataManifestLocation({
    opsRoot: config.opsRoot,
    record: manifest,
  });
  await ensureRemoteDir(client, location.meta_root);
  await client.put(Buffer.from(JSON.stringify(manifest, null, 2), "utf8"), location.full_path);
  return location.full_path;
}

function buildMetadataManifest({ operation, remotePath, artifactPath: remoteArtifactPath, correlationId, operationId, details = {} }) {
  return buildRemoteMetadataRecord({
    operation,
    remotePath,
    artifactPath: remoteArtifactPath,
    correlationId,
    operationId,
    details,
  });
}

function normalizeOpsEvent(event = {}) {
  const operation = event.operation || event.action;
  if (!operation) throw new Error("ops log event requires operation");
  return {
    schema_version: event.schema_version || REMOTE_SITE_SCHEMA_VERSION,
    ts: event.ts || new Date().toISOString(),
    operation_id: event.operation_id || generateOperationId(),
    correlation_id: event.correlation_id || generateCorrelationId(),
    operation: String(operation),
    actor: event.actor || "codex-mcp-tests",
    remote_path: event.remote_path ?? null,
    result: event.result || "success",
    artifact: event.artifact ?? event.trash_path ?? event.diff ?? null,
    details: safeValue(event.details || {}),
  };
}

function remoteOpsLogPath(opsRoot) {
  return posixPath.join(opsRoot, "logs", "site-files.log");
}

async function appendRemoteSiteOpsLog(client, configOrOpsRoot, event) {
  const opsRoot = resolveOpsRoot(configOrOpsRoot);
  await ensureRemoteSiteOpsDirs(client, opsRoot);
  const entry = normalizeOpsEvent(event);
  await client.append(Buffer.from(`${JSON.stringify(entry)}\n`, "utf8"), remoteOpsLogPath(opsRoot));
  return entry;
}

function makeUnifiedDiff({ remotePath, before, after }) {
  const beforeLines = String(before ?? "").split(/\r?\n/);
  const afterLines = String(after ?? "").split(/\r?\n/);
  const out = [
    `--- a/${remotePath}`,
    `+++ b/${remotePath}`,
    `@@ generated ${new Date().toISOString()} @@`,
  ];
  const max = Math.max(beforeLines.length, afterLines.length);
  for (let index = 0; index < max; index += 1) {
    const a = beforeLines[index];
    const b = afterLines[index];
    if (a === b) {
      if (a !== undefined) out.push(` ${a}`);
    } else {
      if (a !== undefined) out.push(`-${a}`);
      if (b !== undefined) out.push(`+${b}`);
    }
  }
  return `${out.join("\n")}\n`;
}

async function putRemoteText(client, remoteFile, content, maxBytes) {
  const bytes = Buffer.byteLength(content, "utf8");
  if (bytes > maxBytes) throw new Error(`content exceeds maxFileBytes: ${bytes}`);
  await ensureRemoteDir(client, posixPath.dirname(remoteFile));
  await client.put(Buffer.from(content, "utf8"), remoteFile);
  return bytes;
}

function buildRestoreMetadataPath({ opsRoot, operationId }) {
  if (!opsRoot) throw new Error("buildRestoreMetadataPath requires opsRoot");
  if (!operationId) throw new Error("buildRestoreMetadataPath requires operationId");
  return metadataPathForRecord(posixPath.join(opsRoot, "meta"), {
    operation_id: operationId,
  });
}

function validateRestoreMetadata(record) {
  if (!record || typeof record !== "object") throw new Error("restore metadata must be an object");
  if (record.schema_version !== 1) throw new Error("unsupported restore metadata schema_version");
  if (!record.operation_id) throw new Error("restore metadata missing operation_id");
  if (!record.correlation_id) throw new Error("restore metadata missing correlation_id");
  if (!record.operation) throw new Error("restore metadata missing operation");
  if (!record.remote_path) throw new Error("restore metadata missing remote_path");
  if (!record.artifact_path) throw new Error("restore metadata missing artifact_path");
  return record;
}

function parseRestoreMetadata(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("restore metadata is not valid JSON");
  }
  return validateRestoreMetadata(parsed);
}

function assertRestorableMetadata(record) {
  const validated = validateRestoreMetadata(record);
  if (validated.operation !== "delete") {
    throw new Error(`restore supports delete metadata only in v1: ${validated.operation}`);
  }
  return validated;
}

function assertAllowedFileExtension(remotePath, allowedExtensions) {
  const ext = posixPath.extname(remotePath).toLowerCase();
  if (!allowedExtensions.has(ext)) {
    throw new Error(`remote_path extension is not allowed: ${ext || "<none>"}`);
  }
}

async function readRemoteText(client, remoteFile, maxBytes) {
  const stat = await client.stat(remoteFile);
  if (!stat || stat.type === "d") throw new Error("remote target is not a file");
  if (Number(stat.size || 0) > maxBytes) throw new Error(`remote file exceeds maxFileBytes: ${stat.size}`);
  const data = await client.get(remoteFile);
  return Buffer.isBuffer(data) ? data.toString("utf8") : String(data);
}

function summarizeRemoteSiteArgs(args = {}) {
  return {
    has_config_ref: Boolean(args.vps_config_ref),
    remote_path: typeof args.remote_path === "string" ? args.remote_path : "",
  };
}

function countJsonChars(payload) {
  return JSON.stringify(payload || {}).length;
}

function rightsPartToOctal(part) {
  if (typeof part !== "string") return 0;
  let value = 0;
  if (part.includes("r")) value += 4;
  if (part.includes("w")) value += 2;
  if (part.includes("x")) value += 1;
  return value;
}

function normalizeMode(value) {
  if (typeof value === "number" && Number.isFinite(value)) return `0${(value & 0o777).toString(8)}`;
  if (value && typeof value === "object") {
    if (value.mode !== undefined) return normalizeMode(value.mode);
    if ("user" in value || "group" in value || "other" in value) {
      return `0${rightsPartToOctal(value.user)}${rightsPartToOctal(value.group)}${rightsPartToOctal(value.other)}`;
    }
  }
  if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim();
    if (/^[0-7]{3,4}$/.test(trimmed)) return trimmed.length === 3 ? `0${trimmed}` : trimmed;
    return trimmed;
  }
  return null;
}

function remoteRowMode(row) {
  if (!row || typeof row !== "object") return null;
  if (row.mode !== undefined) return row.mode;
  if (row.rights && typeof row.rights === "object") return row.rights;
  if (typeof row.longname === "string") {
    const match = row.longname.match(/^[dl-]([rwx-]{3})([rwx-]{3})([rwx-]{3})/);
    if (match) {
      return {
        user: match[1].replace(/-/g, ""),
        group: match[2].replace(/-/g, ""),
        other: match[3].replace(/-/g, ""),
      };
    }
  }
  return null;
}

async function collectOpsRootInventory(client, opsRoot) {
  const inventory = [];
  async function walk(dir, prefix = "") {
    const rows = await client.list(dir);
    for (const row of rows) {
      const rel = prefix ? `${prefix}/${row.name}` : row.name;
      const full = posixPath.join(dir, row.name);
      if (row.type === "d") {
        await walk(full, rel);
        continue;
      }
      inventory.push({
        relative_path: rel,
        area: rel.split("/")[0] || "unknown",
        size: Number.isFinite(row.size) ? row.size : 0,
        modified_at: row.modifyTime ? new Date(row.modifyTime).toISOString() : new Date().toISOString(),
        mode: remoteRowMode(row),
        type: row.type === "-" ? "file" : row.type || "file",
      });
    }
  }
  await walk(opsRoot);
  return inventory;
}

async function readOpsMetadataRecords(client, opsRoot, inventoryEntries) {
  const metadataFiles = inventoryEntries
    .filter((entry) => String(entry.relative_path || "").startsWith("meta/") && String(entry.relative_path || "").endsWith(".json"))
    .map((entry) => entry.relative_path);
  const records = [];
  for (const rel of metadataFiles) {
    try {
      const data = await client.get(posixPath.join(opsRoot, rel));
      const text = Buffer.isBuffer(data) ? data.toString("utf8") : String(data);
      records.push(JSON.parse(text));
    } catch (error) {
      records.push({
        schema_version: -1,
        operation: "invalid_metadata",
        operation_id: rel,
        error: error?.message || String(error),
      });
    }
  }
  return records;
}

async function readOpsLogLines(client, opsRoot) {
  try {
    const data = await client.get(posixPath.join(opsRoot, "logs", "site-files.log"));
    const text = Buffer.isBuffer(data) ? data.toString("utf8") : String(data);
    return text.split(/\r?\n/).filter((line) => line.trim());
  } catch {
    return [];
  }
}

function summarizeRuntimeInventory(entries) {
  const by_area = {};
  const permission_warnings = [];
  const invalid_entries = [];
  let total_size = 0;
  let total_artifacts = 0;

  for (const entry of Array.isArray(entries) ? entries : []) {
    try {
      const relativePath = String(entry.relative_path || entry.path || "");
      if (!relativePath) throw new Error("missing relative_path");
      const area = String(entry.area || relativePath.split("/")[0] || "unknown");
      by_area[area] = (by_area[area] || 0) + 1;
      total_size += Number.isFinite(entry.size) ? entry.size : 0;
      total_artifacts += 1;
      const expectedMode = area === "meta" || area === "logs" ? "0644" : area === "edits" || area === "trash" ? "0640" : null;
      const actualMode = normalizeMode(entry.mode);
      if (expectedMode && actualMode && actualMode !== expectedMode) {
        permission_warnings.push({
          relative_path: relativePath,
          area,
          expected_mode: expectedMode,
          actual_mode: actualMode,
        });
      }
    } catch (error) {
      invalid_entries.push({
        path: entry?.relative_path || entry?.path || null,
        error: error?.message || String(error),
      });
    }
  }

  return { total_artifacts, total_size, by_area, permission_warnings, invalid_entries };
}

function summarizeMetadataRecords(records) {
  const by_operation = {};
  const by_schema_version = {};
  const invalid_records = [];
  for (const [index, record] of (Array.isArray(records) ? records : []).entries()) {
    if (!record || typeof record !== "object") {
      invalid_records.push({ index, error: "metadata record must be object" });
      continue;
    }
    const schemaKey = String(record.schema_version ?? "missing");
    by_schema_version[schemaKey] = (by_schema_version[schemaKey] || 0) + 1;
    if (typeof record.operation === "string" && record.operation) {
      by_operation[record.operation] = (by_operation[record.operation] || 0) + 1;
    } else {
      invalid_records.push({ index, operation_id: record.operation_id || null, error: "missing operation" });
    }
  }
  return { total_records: Array.isArray(records) ? records.length : 0, by_operation, by_schema_version, invalid_records };
}

function classifyOpsLogLine(line) {
  if (typeof line !== "string" || !line.trim()) return { schema: "blank", valid: false, error: "blank line" };
  try {
    const record = JSON.parse(line);
    if (record.schema_version === 1 && typeof record.operation_id === "string") {
      return { schema: "schema_v1", valid: true, operation: record.operation || null };
    }
    if (typeof record.operation === "string" && typeof record.actor === "string") {
      return { schema: "canonical_v0", valid: true, operation: record.operation };
    }
    if (typeof record.action === "string") {
      return { schema: "legacy_action", valid: true, operation: record.action };
    }
    return { schema: "unknown_json", valid: false, error: "unrecognized JSONL schema" };
  } catch (error) {
    return { schema: "invalid_json", valid: false, error: error?.message || String(error) };
  }
}

function summarizeOpsLogLines(lines) {
  const by_schema = {};
  const by_operation = {};
  const invalid_lines = [];
  const source = Array.isArray(lines) ? lines : [];
  for (const [index, line] of source.entries()) {
    const classified = classifyOpsLogLine(line);
    by_schema[classified.schema] = (by_schema[classified.schema] || 0) + 1;
    if (classified.operation) by_operation[classified.operation] = (by_operation[classified.operation] || 0) + 1;
    if (!classified.valid) invalid_lines.push({ line: index + 1, schema: classified.schema, error: classified.error });
  }
  return { total_lines: source.length, by_schema, by_operation, invalid_lines };
}

function buildReferencedArtifactSet(records) {
  const referenced = new Set();
  const invalid_records = [];
  for (const record of Array.isArray(records) ? records : []) {
    try {
      if (!record || typeof record !== "object") throw new Error("metadata manifest must be object");
      if (record.schema_version !== 1) throw new Error("unsupported metadata schema_version");
      if (typeof record.operation !== "string" || !record.operation) throw new Error("metadata manifest missing operation");
      if (typeof record.operation_id !== "string" || !record.operation_id) throw new Error("metadata manifest missing operation_id");
      const candidates = [record.artifact, record.diff_artifact, record.trash_artifact, record.backup_artifact];
      if (Array.isArray(record.artifacts)) candidates.push(...record.artifacts);
      for (const item of candidates) {
        if (typeof item === "string" && item.trim()) {
          referenced.add(normalizeRemoteRelativePath(item, { allowDot: false }));
        }
      }
    } catch (error) {
      invalid_records.push({
        operation_id: record?.operation_id || null,
        error: error?.message || String(error),
      });
    }
  }
  return { referenced_artifacts: Array.from(referenced).sort(), invalid_records };
}

function classifyRetentionArtifacts({ inventoryEntries, metadataRecords, now = new Date() }) {
  const referenced = buildReferencedArtifactSet(metadataRecords);
  const referencedSet = new Set(referenced.referenced_artifacts);
  const classifications = [];
  const invalid_inventory_entries = [];
  const nowMs = (now instanceof Date ? now : new Date(now)).getTime();

  for (const entry of Array.isArray(inventoryEntries) ? inventoryEntries : []) {
    try {
      const relative_path = normalizeRemoteRelativePath(String(entry.relative_path || entry.path || ""));
      const area = String(entry.area || relative_path.split("/")[0] || "unknown");
      const modifiedAt = new Date(entry.modified_at || entry.mtime || entry.modifyTime);
      if (Number.isNaN(modifiedAt.getTime())) throw new Error("inventory entry modified_at must be valid date");
      const base = {
        relative_path,
        area,
        modified_at: modifiedAt.toISOString(),
        size: Number.isFinite(entry.size) ? entry.size : null,
      };
      if (!OPS_AREAS.has(area)) {
        classifications.push({ ...base, classification: "unknown", purge_candidate: false, reason: "area_unknown" });
        continue;
      }
      if (area === "meta") {
        classifications.push({ ...base, classification: "protected", purge_candidate: false, reason: "area_protected" });
        continue;
      }
      if (referencedSet.has(relative_path)) {
        classifications.push({ ...base, classification: "referenced", purge_candidate: false, reason: "referenced_by_metadata" });
        continue;
      }
      const retentionDays = DEFAULT_RETENTION_DAYS[area];
      const cutoffMs = nowMs - (retentionDays * 24 * 60 * 60 * 1000);
      const expired = modifiedAt.getTime() < cutoffMs;
      if (expired) {
        classifications.push({ ...base, classification: "purge_candidate", purge_candidate: true, reason: "expired_and_unreferenced" });
      } else {
        classifications.push({ ...base, classification: "unreferenced", purge_candidate: false, reason: "within_retention_window" });
      }
    } catch (error) {
      invalid_inventory_entries.push({
        path: entry?.relative_path || entry?.path || null,
        error: error?.message || String(error),
      });
    }
  }

  const summary = classifications.reduce((acc, row) => {
    acc[row.classification] = (acc[row.classification] || 0) + 1;
    return acc;
  }, {});

  return {
    referenced,
    invalid_inventory_entries,
    purge_candidates: classifications.filter((row) => row.purge_candidate),
    classifications,
    summary,
  };
}

function buildRemoteSiteRuntimeStatus({ inventoryEntries, metadataRecords, logLines, generatedAt = new Date().toISOString() }) {
  const inventory = summarizeRuntimeInventory(inventoryEntries);
  const metadata = summarizeMetadataRecords(metadataRecords);
  const logs = summarizeOpsLogLines(logLines);
  const warnings = [];
  if (inventory.permission_warnings.length) warnings.push({ code: "permission_policy_findings", count: inventory.permission_warnings.length });
  const missingAreas = ["logs", "meta", "edits", "trash"].filter((area) => !inventory.by_area[area]);
  if (missingAreas.length) warnings.push({ code: "lifecycle_markers_missing", areas: missingAreas });
  if (metadata.invalid_records.length) warnings.push({ code: "invalid_metadata_records", count: metadata.invalid_records.length });
  if (logs.invalid_lines.length) warnings.push({ code: "invalid_log_lines", count: logs.invalid_lines.length });
  return {
    status: warnings.length ? "attention_required" : "healthy",
    generated_at: generatedAt,
    inventory,
    metadata,
    logs,
    warnings,
  };
}

async function listRemoteSiteFiles(args = {}) {
  return withSftp(args.vps_config_ref, async (client, config) => {
    const rel = args.remote_path === "." || args.remote_path == null
      ? "."
      : normalizeRemoteRelativePath(args.remote_path, { allowDot: true });
    const remoteDir = rel === "." ? config.siteRoot : joinRemoteUnderRoot(config.siteRoot, rel);
    const entries = await client.list(remoteDir);
    return { remote_path: rel, count: entries.length, entries };
  });
}

async function readRemoteSiteFile(args = {}) {
  return withSftp(args.vps_config_ref, async (client, config) => {
    const rel = normalizeRemoteRelativePath(args.remote_path);
    assertAllowedFileExtension(rel, config.allowedExtensions);
    const remoteFile = joinRemoteUnderRoot(config.siteRoot, rel);
    const text = await readRemoteText(client, remoteFile, config.maxFileBytes);
    return { remote_path: rel, bytes: Buffer.byteLength(text, "utf8"), text };
  });
}

async function writeRemoteSiteFile(args = {}) {
  return withSftp(args.vps_config_ref, async (client, config) => {
    const rel = normalizeRemoteRelativePath(args.remote_path);
    assertAllowedFileExtension(rel, config.allowedExtensions);
    const remoteFile = joinRemoteUnderRoot(config.siteRoot, rel);
    let before = "";
    let existed = true;
    try {
      before = await readRemoteText(client, remoteFile, config.maxFileBytes);
    } catch {
      existed = false;
    }
    if (existed) {
      const patchFile = diffPath({ opsRoot: config.opsRoot, remotePath: rel });
      await ensureRemoteDir(client, posixPath.dirname(patchFile));
      await client.put(Buffer.from(makeUnifiedDiff({ remotePath: rel, before, after: args.content }), "utf8"), patchFile);
    }
    const bytes = await putRemoteText(client, remoteFile, args.content, config.maxFileBytes);
    const manifest = buildMetadataManifest({
      operation: "write",
      remotePath: rel,
      artifactPath: existed ? diffPath({ opsRoot: config.opsRoot, remotePath: rel }) : null,
      details: {
        existed,
        bytes_after: bytes,
        bytes_before: existed ? Buffer.byteLength(before, "utf8") : 0,
      },
    });
    const metadataPath = await writeRemoteMetadataManifest(client, config, manifest);
    await appendRemoteSiteOpsLog(client, config, {
      action: "write",
      remote_path: rel,
      bytes,
      existed,
      operation_id: manifest.operation_id,
      correlation_id: manifest.correlation_id,
      artifact: manifest.artifact_path,
      details: {
        metadata_path: metadataPath,
        bytes_before: existed ? Buffer.byteLength(before, "utf8") : 0,
        bytes_after: bytes,
      },
    });
    return {
      status: "written",
      remote_path: rel,
      bytes,
      diff_created: existed,
      metadata_path: metadataPath,
      operation_id: manifest.operation_id,
      correlation_id: manifest.correlation_id,
    };
  });
}

async function editRemoteSiteFile(args = {}) {
  return withSftp(args.vps_config_ref, async (client, config) => {
    const rel = normalizeRemoteRelativePath(args.remote_path);
    assertAllowedFileExtension(rel, config.allowedExtensions);
    const remoteFile = joinRemoteUnderRoot(config.siteRoot, rel);
    const before = await readRemoteText(client, remoteFile, config.maxFileBytes);
    const patchFile = diffPath({ opsRoot: config.opsRoot, remotePath: rel });
    await ensureRemoteDir(client, posixPath.dirname(patchFile));
    await client.put(Buffer.from(makeUnifiedDiff({ remotePath: rel, before, after: args.content }), "utf8"), patchFile);
    const bytes = await putRemoteText(client, remoteFile, args.content, config.maxFileBytes);
    const manifest = buildMetadataManifest({
      operation: "edit",
      remotePath: rel,
      artifactPath: patchFile,
      details: {
        diff_path: patchFile,
        bytes_after: bytes,
        bytes_before: Buffer.byteLength(before, "utf8"),
      },
    });
    const metadataPath = await writeRemoteMetadataManifest(client, config, manifest);
    await appendRemoteSiteOpsLog(client, config, {
      action: "edit",
      remote_path: rel,
      bytes,
      diff: patchFile,
      operation_id: manifest.operation_id,
      correlation_id: manifest.correlation_id,
      artifact: patchFile,
      details: {
        metadata_path: metadataPath,
        bytes_before: Buffer.byteLength(before, "utf8"),
        bytes_after: bytes,
      },
    });
    return {
      status: "edited",
      remote_path: rel,
      bytes,
      diff: patchFile,
      metadata_path: metadataPath,
      operation_id: manifest.operation_id,
      correlation_id: manifest.correlation_id,
    };
  });
}

async function deleteRemoteSiteFile(args = {}) {
  return withSftp(args.vps_config_ref, async (client, config) => {
    const rel = normalizeRemoteRelativePath(args.remote_path);
    assertAllowedFileExtension(rel, config.allowedExtensions);
    const source = joinRemoteUnderRoot(config.siteRoot, rel);
    const target = artifactPath({ opsRoot: config.opsRoot, kind: "trash", remotePath: rel, suffix: "deleted" });
    await ensureRemoteDir(client, posixPath.dirname(target));
    await client.rename(source, target);
    const manifest = buildMetadataManifest({
      operation: "delete",
      remotePath: rel,
      artifactPath: target,
      details: {
        source_path: source,
        trash_path: target,
      },
    });
    const metadataPath = await writeRemoteMetadataManifest(client, config, manifest);
    await appendRemoteSiteOpsLog(client, config, {
      action: "delete",
      remote_path: rel,
      trash_path: target,
      operation_id: manifest.operation_id,
      correlation_id: manifest.correlation_id,
      artifact: target,
      details: { metadata_path: metadataPath },
    });
    return {
      status: "moved_to_trash",
      remote_path: rel,
      trash_path: target,
      metadata_path: metadataPath,
      operation_id: manifest.operation_id,
      correlation_id: manifest.correlation_id,
    };
  });
}

async function moveRemoteSiteFile(args = {}) {
  return withSftp(args.vps_config_ref, async (client, config) => {
    const sourceRel = normalizeRemoteRelativePath(args.source_path);
    const targetRel = normalizeRemoteRelativePath(args.target_path);
    assertAllowedFileExtension(sourceRel, config.allowedExtensions);
    assertAllowedFileExtension(targetRel, config.allowedExtensions);
    const source = joinRemoteUnderRoot(config.siteRoot, sourceRel);
    const target = joinRemoteUnderRoot(config.siteRoot, targetRel);
    try {
      await client.stat(target);
      throw new Error("target already exists; overwrite is forbidden in v1");
    } catch (error) {
      if (!/No such file|not exist|ENOENT/i.test(error?.message || String(error))) throw error;
    }
    await ensureRemoteDir(client, posixPath.dirname(target));
    await client.rename(source, target);
    await appendRemoteSiteOpsLog(client, config, {
      action: "move",
      source_path: sourceRel,
      target_path: targetRel,
    });
    return {
      status: "moved",
      source_path: sourceRel,
      target_path: targetRel,
    };
  });
}

async function restoreRemoteSiteFile(args = {}) {
  return withSftp(args.vps_config_ref, async (client, config) => {
    const metadataPath = buildRestoreMetadataPath({
      opsRoot: config.opsRoot,
      operationId: args.operation_id,
    });
    const rawMetadata = await client.get(metadataPath);
    const metadataText = Buffer.isBuffer(rawMetadata) ? rawMetadata.toString("utf8") : String(rawMetadata);
    const deleteMetadata = assertRestorableMetadata(parseRestoreMetadata(metadataText));
    const targetRel = normalizeRemoteRelativePath(deleteMetadata.remote_path);
    assertAllowedFileExtension(targetRel, config.allowedExtensions);
    const source = deleteMetadata.artifact_path;
    const target = joinRemoteUnderRoot(config.siteRoot, targetRel);
    const trashRoot = posixPath.normalize(posixPath.join(config.opsRoot, "trash"));
    const cleanSource = posixPath.normalize(String(source || "").replaceAll("\\", "/"));
    if (cleanSource !== trashRoot && !cleanSource.startsWith(`${trashRoot}/`)) {
      throw new Error("restore artifact is outside trash root");
    }
    try {
      await client.stat(target);
      throw new Error("restore target already exists; overwrite is forbidden in v1");
    } catch (error) {
      if (!/No such file|not exist|ENOENT/i.test(error?.message || String(error))) throw error;
    }
    await ensureRemoteDir(client, posixPath.dirname(target));
    await client.rename(cleanSource, target);
    const restoreManifest = buildMetadataManifest({
      operation: "restore",
      remotePath: targetRel,
      artifactPath: target,
      correlationId: deleteMetadata.correlation_id,
      details: {
        restored_from_operation_id: deleteMetadata.operation_id,
        restored_from_metadata_path: metadataPath,
        restored_from_artifact_path: cleanSource,
        restore_target_path: target,
      },
    });
    const restoreMetadataPath = await writeRemoteMetadataManifest(client, config, restoreManifest);
    await appendRemoteSiteOpsLog(client, config, {
      action: "restore",
      remote_path: targetRel,
      operation_id: restoreManifest.operation_id,
      correlation_id: restoreManifest.correlation_id,
      artifact: target,
      details: {
        restored_from_operation_id: deleteMetadata.operation_id,
        restored_from_metadata_path: metadataPath,
        restore_metadata_path: restoreMetadataPath,
      },
    });
    return {
      status: "restored",
      remote_path: targetRel,
      restored_from: cleanSource,
      restored_to: target,
      source_operation_id: deleteMetadata.operation_id,
      restore_operation_id: restoreManifest.operation_id,
      correlation_id: restoreManifest.correlation_id,
      restore_metadata_path: restoreMetadataPath,
    };
  });
}

async function remoteSiteRuntimeStatus(args = {}) {
  return withSftp(args.vps_config_ref, async (client, config) => {
    const inventoryEntries = await collectOpsRootInventory(client, config.opsRoot);
    const metadataRecords = await readOpsMetadataRecords(client, config.opsRoot, inventoryEntries);
    const logLines = await readOpsLogLines(client, config.opsRoot);
    const payload = buildRemoteSiteRuntimeStatus({ inventoryEntries, metadataRecords, logLines });
    return { ...payload, text: JSON.stringify(payload, null, 2) };
  });
}

async function previewRemoteSiteRetention(args = {}) {
  return withSftp(args.vps_config_ref, async (client, config) => {
    const inventoryEntries = await collectOpsRootInventory(client, config.opsRoot);
    const metadataRecords = await readOpsMetadataRecords(client, config.opsRoot, inventoryEntries);
    const preview = classifyRetentionArtifacts({ inventoryEntries, metadataRecords });
    const payload = {
      mode: "retention_preview_operation",
      preview: {
        mode: "preview",
        generated_at: new Date().toISOString(),
        referenced_artifacts_count: preview.referenced.referenced_artifacts.length,
        invalid_metadata_records: preview.referenced.invalid_records,
        invalid_inventory_entries: preview.invalid_inventory_entries,
        purge_count: preview.purge_candidates.length,
        summary: preview.summary,
        purge_candidates: preview.purge_candidates,
        classifications: preview.classifications,
      },
    };
    return {
      mode: payload.mode,
      purge_count: payload.preview.purge_count,
      summary: {
        generated_at: payload.preview.generated_at,
        referenced_artifacts_count: payload.preview.referenced_artifacts_count,
        invalid_metadata_records: payload.preview.invalid_metadata_records.length,
        invalid_inventory_entries: payload.preview.invalid_inventory_entries.length,
        purge_candidates: payload.preview.purge_candidates.length,
      },
      text: JSON.stringify(payload, null, 2),
    };
  });
}

module.exports = {
  countJsonChars,
  deleteRemoteSiteFile,
  editRemoteSiteFile,
  listRemoteSiteFiles,
  moveRemoteSiteFile,
  previewRemoteSiteRetention,
  readRemoteSiteFile,
  remoteSiteRuntimeStatus,
  restoreRemoteSiteFile,
  summarizeRemoteSiteArgs,
  withSftp,
  writeRemoteSiteFile,
};

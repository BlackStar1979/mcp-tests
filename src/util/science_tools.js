"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const { spawn } = require("node:child_process");

const { safeWorkspacePath } = require("./workspace_roots");

const MODULE_DIR = __dirname;
const INVENTORY_DEFAULT_MAX_FILES = 20000;
const DEFAULT_TIMEOUT_MS = Number(process.env.MCP_TEST_SCIENCE_TIMEOUT_MS || 120000);
const PYTHON_CANDIDATES = process.platform === "win32"
  ? [["python", []], ["py", ["-3"]]]
  : [["python3", []], ["python", []]];

function humanBytes(bytes) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = Number(bytes || 0);
  let idx = 0;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  return `${value.toFixed(idx === 0 ? 0 : 2)} ${units[idx]}`;
}

function extensionKey(name) {
  const lower = String(name || "").toLowerCase();
  if (lower.endsWith(".fits.gz")) return ".fits.gz";
  if (lower.endsWith(".fit.gz")) return ".fit.gz";
  if (lower.endsWith(".pdf.gz")) return ".pdf.gz";
  if (lower.endsWith(".tar.gz")) return ".tar.gz";
  if (lower.endsWith(".hdf5")) return ".hdf5";
  return path.extname(lower) || "[none]";
}

function kindForExtension(ext) {
  if ([".fit", ".fits", ".fit.gz", ".fits.gz"].includes(ext)) return "fits";
  if ([".h5", ".hdf5"].includes(ext)) return "hdf5";
  if ([".txt", ".csv", ".tsv", ".rdb", ".dat"].includes(ext)) return "table_or_text";
  if ([".gz", ".pdf.gz", ".tar.gz"].includes(ext)) return "compressed";
  if ([".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(ext)) return "image";
  if (ext === ".pdf") return "pdf";
  return "other";
}

function addGroup(groups, key, bytes) {
  if (!groups[key]) groups[key] = { count: 0, bytes: 0, human_bytes: "0 B" };
  groups[key].count += 1;
  groups[key].bytes += bytes;
}

function finalizeGroups(groups) {
  for (const value of Object.values(groups)) {
    value.human_bytes = humanBytes(value.bytes);
  }
  return Object.fromEntries(
    Object.entries(groups).sort((a, b) => b[1].bytes - a[1].bytes || a[0].localeCompare(b[0]))
  );
}

function scriptPath(scriptName) {
  return path.join(MODULE_DIR, "science_scripts", scriptName);
}

function normalizeShape(value) {
  if (Array.isArray(value)) return value.map((item) => Number(item));
  if (value && typeof value === "object" && typeof value.length === "number") {
    return Array.from(value, (item) => Number(item));
  }
  return null;
}

function normalizeFitColumns(columns = []) {
  return Array.isArray(columns)
    ? columns.map((column) => ({
        name: String(column?.name || ""),
        format: column?.format == null ? null : String(column.format),
        unit: column?.unit == null ? null : String(column.unit),
      }))
    : [];
}

function normalizeHdus(hdus = []) {
  return Array.isArray(hdus)
    ? hdus.map((hdu, index) => ({
        index: Number.isInteger(hdu?.index) ? hdu.index : index,
        type: String(hdu?.type || ""),
        shape: normalizeShape(hdu?.shape),
        dtype: hdu?.dtype == null || hdu.dtype === "None" ? null : String(hdu.dtype),
        header: Object.fromEntries(
          Object.entries(hdu?.header || {}).map(([key, value]) => [String(key), String(value)])
        ),
        columns: normalizeFitColumns(hdu?.columns),
      }))
    : [];
}

function normalizeHdf5Items(items = []) {
  return Array.isArray(items)
    ? items.map((item) => ({
        path: String(item?.path || ""),
        type: String(item?.type || ""),
        shape: normalizeShape(item?.shape),
        dtype: item?.dtype == null || item.dtype === "None" ? null : String(item.dtype),
        chunks: normalizeShape(item?.chunks),
        compression: item?.compression == null || item.compression === "None" ? null : String(item.compression),
        attrs: Object.fromEntries(
          Object.entries(item?.attrs || {}).map(([key, value]) => [String(key), String(value)])
        ),
      }))
    : [];
}

function normalizeTableRows(rows = []) {
  return Array.isArray(rows)
    ? rows.map((row) => Array.isArray(row) ? row.map((value) => value == null ? null : String(value)) : [])
    : [];
}

async function runPythonCandidate(executable, leadingArgs, script, payload, timeoutMs, spawnImpl = spawn) {
  return new Promise((resolve, reject) => {
    const proc = spawnImpl(executable, [...leadingArgs, scriptPath(script)], {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
      env: { ...process.env },
    });

    let stdout = "";
    let stderr = "";
    let finished = false;
    let timeoutKillError = "";
    const timer = setTimeout(() => {
      if (finished) return;
      finished = true;
      try {
        const killed = proc.kill();
        if (killed === false) timeoutKillError = " kill() returned false.";
      } catch (error) {
        timeoutKillError = ` kill() failed: ${error?.message || String(error)}.`;
      }
      reject(new Error(`Timeout after ${timeoutMs} ms while running ${script}.${timeoutKillError}`));
    }, timeoutMs);

    proc.stdout.on("data", (buf) => {
      stdout += buf.toString("utf8");
    });
    proc.stderr.on("data", (buf) => {
      stderr += buf.toString("utf8");
    });
    proc.on("error", (error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      reject(error);
    });
    proc.on("close", (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error((stderr || `Python exited with code ${code}`).trim()));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(new Error(`Invalid JSON from ${script}: ${error.message}`));
      }
    });

    proc.stdin.write(JSON.stringify(payload));
    proc.stdin.end();
  });
}

async function runSciencePython(script, payload, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const errors = [];
  for (const [executable, leadingArgs] of PYTHON_CANDIDATES) {
    try {
      return await runPythonCandidate(executable, leadingArgs, script, payload, timeoutMs);
    } catch (error) {
      if (error && (error.code === "ENOENT" || /spawn .*ENOENT/i.test(error.message || ""))) {
        errors.push(`${executable}: not found`);
        continue;
      }
      throw error;
    }
  }
  throw new Error(`Python interpreter not available (${errors.join("; ") || "no candidates"}).`);
}

async function inventoryTree(relativePath, options = {}) {
  const resolved = safeWorkspacePath(relativePath);
  const rootStat = await fs.stat(resolved.absolutePath);
  if (!rootStat.isDirectory()) {
    throw new Error("Not a directory.");
  }

  const maxDepth = Math.max(0, Math.min(30, Number.isInteger(options.max_depth) ? options.max_depth : 20));
  const topNLargest = Math.max(1, Math.min(200, Number.isInteger(options.top_n_largest) ? options.top_n_largest : 50));
  const groupDepth = Math.max(1, Math.min(10, Number.isInteger(options.group_depth) ? options.group_depth : 4));
  const maxFiles = Math.max(1, Math.min(100000, Number.isInteger(options.max_files) ? options.max_files : INVENTORY_DEFAULT_MAX_FILES));

  const state = {
    path: resolved.displayPath,
    root_alias: resolved.rootAlias,
    files: 0,
    directories: 0,
    total_bytes: 0,
    human_total_bytes: "0 B",
    truncated: false,
    max_files: maxFiles,
    by_extension: {},
    by_kind: {},
    by_directory: {},
    largest: [],
  };

  async function walk(dir, depth) {
    if (depth > maxDepth || state.files >= maxFiles) return;
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (state.files >= maxFiles) {
        state.truncated = true;
        return;
      }

      const full = path.join(dir, entry.name);
      const rel = path.relative(resolved.absolutePath, full).replaceAll("\\", "/");
      const displayRel = resolved.displayPath === "." ? rel : `${resolved.displayPath.replaceAll("\\", "/")}/${rel}`;

      if (entry.isDirectory()) {
        state.directories += 1;
        await walk(full, depth + 1);
        continue;
      }

      if (!entry.isFile()) continue;

      const stat = await fs.stat(full);
      const ext = extensionKey(entry.name);
      const kind = kindForExtension(ext);
      const dirKey = displayRel.split("/").slice(0, groupDepth).join("/");

      state.files += 1;
      state.total_bytes += stat.size;
      addGroup(state.by_extension, ext, stat.size);
      addGroup(state.by_kind, kind, stat.size);
      addGroup(state.by_directory, dirKey, stat.size);
      state.largest.push({
        path: displayRel,
        bytes: stat.size,
        human_bytes: humanBytes(stat.size),
        extension: ext,
        kind,
        modified: stat.mtime.toISOString(),
      });
      state.largest.sort((a, b) => b.bytes - a.bytes);
      if (state.largest.length > topNLargest) {
        state.largest.length = topNLargest;
      }
    }
  }

  await walk(resolved.absolutePath, 0);
  state.human_total_bytes = humanBytes(state.total_bytes);
  state.by_extension = finalizeGroups(state.by_extension);
  state.by_kind = finalizeGroups(state.by_kind);
  state.by_directory = finalizeGroups(state.by_directory);
  return state;
}

async function inspectFits(relativePath, options = {}) {
  const resolved = safeWorkspacePath(relativePath);
  const data = await runSciencePython("fits_info.py", {
    path: resolved.absolutePath,
    rel_path: resolved.displayPath,
    max_header_cards: options.max_header_cards,
    max_columns: options.max_columns,
  });
  return {
    path: resolved.displayPath,
    root_alias: resolved.rootAlias,
    hdu_count: Number(data?.hdu_count || 0),
    hdus: normalizeHdus(data?.hdus),
  };
}

async function inspectHdf5(relativePath, options = {}) {
  const resolved = safeWorkspacePath(relativePath);
  const data = await runSciencePython("hdf5_info.py", {
    path: resolved.absolutePath,
    rel_path: resolved.displayPath,
    max_items: options.max_items,
    include_attrs: options.include_attrs,
    max_attrs: options.max_attrs,
  });
  return {
    path: resolved.displayPath,
    root_alias: resolved.rootAlias,
    returned_items: Number(data?.returned_items || 0),
    truncated: Boolean(data?.truncated),
    items: normalizeHdf5Items(data?.items),
  };
}

async function profileTable(relativePath, options = {}) {
  const resolved = safeWorkspacePath(relativePath);
  const data = await runSciencePython("table_profile.py", {
    path: resolved.absolutePath,
    rel_path: resolved.displayPath,
    max_lines: options.max_lines,
    sample_rows: options.sample_rows,
  });
  return {
    path: resolved.displayPath,
    root_alias: resolved.rootAlias,
    lines_read: Number(data?.lines_read || data?.lines || 0),
    delimiter: String(data?.delimiter || ""),
    columns: Array.isArray(data?.columns) ? data.columns.map((value) => String(value)) : [],
    sample_rows: normalizeTableRows(data?.sample_rows),
  };
}

function summarizeSciencePath(args = {}) {
  const input = String(args.path || ".");
  const aliasMatch = input.match(/^@([a-z0-9_-]+)(?:\/|$)/i);
  return {
    arg_name: "path",
    path_length_chars: input.length,
    explicit_root_alias: aliasMatch ? aliasMatch[1].toLowerCase() : "",
  };
}

module.exports = {
  inspectFits,
  inspectHdf5,
  inventoryTree,
  profileTable,
  runPythonCandidate,
  summarizeSciencePath,
};

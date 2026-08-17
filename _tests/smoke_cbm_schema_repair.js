"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { DatabaseSync } = require("node:sqlite");

const REPO_ROOT = path.join(__dirname, "..");
const SCRIPT = path.join(REPO_ROOT, "scripts", "repair_cbm_v090_edges_schema.js");
const PROJECT = "C-Work-schema-repair-fixture";

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function createOldDatabase(filePath, summary = "## PURPOSE\nPreserve fixture ADR") {
  const db = new DatabaseSync(filePath);
  try {
    db.exec(`
      PRAGMA journal_mode=WAL;
      PRAGMA foreign_keys=ON;
      CREATE TABLE projects (
        name TEXT PRIMARY KEY,
        indexed_at TEXT NOT NULL,
        root_path TEXT NOT NULL
      );
      CREATE TABLE nodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project TEXT NOT NULL REFERENCES projects(name) ON DELETE CASCADE,
        label TEXT NOT NULL,
        name TEXT NOT NULL,
        qualified_name TEXT NOT NULL,
        file_path TEXT DEFAULT '',
        start_line INTEGER DEFAULT 0,
        end_line INTEGER DEFAULT 0,
        properties TEXT DEFAULT '{}',
        UNIQUE(project, qualified_name)
      );
      CREATE TABLE edges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project TEXT NOT NULL REFERENCES projects(name) ON DELETE CASCADE,
        source_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
        target_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        properties TEXT DEFAULT '{}',
        url_path_gen TEXT GENERATED ALWAYS AS (json_extract(properties,'$.url_path')),
        UNIQUE(source_id, target_id, type)
      );
      CREATE INDEX idx_edges_source ON edges(source_id, type);
      CREATE INDEX idx_edges_source_type ON edges(project, source_id, type);
      CREATE INDEX idx_edges_target ON edges(target_id, type);
      CREATE INDEX idx_edges_target_type ON edges(project, target_id, type);
      CREATE INDEX idx_edges_type ON edges(project, type);
      CREATE INDEX idx_edges_url_path ON edges(project, url_path_gen);
      CREATE TABLE project_summaries (
        project TEXT PRIMARY KEY,
        summary TEXT NOT NULL,
        source_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    db.prepare("INSERT INTO projects VALUES (?, ?, ?)").run(PROJECT, "2026-07-26T00:00:00Z", "C:/Work/fixture");
    db.prepare("INSERT INTO nodes(project,label,name,qualified_name,file_path,properties) VALUES (?,?,?,?,?,?)")
      .run(PROJECT, "Module", "a", `${PROJECT}.a`, "a.js", "{}");
    db.prepare("INSERT INTO nodes(project,label,name,qualified_name,file_path,properties) VALUES (?,?,?,?,?,?)")
      .run(PROJECT, "Module", "b", `${PROJECT}.b`, "b.js", "{}");
    db.prepare("INSERT INTO edges(project,source_id,target_id,type,properties) VALUES (?,?,?,?,?)")
      .run(PROJECT, 1, 2, "IMPORTS", JSON.stringify({ local_name: "b" }));
    db.prepare("INSERT INTO project_summaries VALUES (?, ?, '', ?, ?)")
      .run(PROJECT, summary, "2026-07-26T00:00:00Z", "2026-07-26T00:00:00Z");
    db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  } finally {
    db.close();
  }
}

function run(args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    timeout: 30000,
  });
}

function readState(dbPath) {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    db.exec("PRAGMA query_only=ON");
    const columns = db.prepare("PRAGMA table_xinfo(edges)").all().map((row) => row.name);
    return {
      columns,
      edgeSql: db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='edges'").get().sql,
      edges: Number(db.prepare("SELECT count(*) AS n FROM edges").get().n),
      imports: Number(db.prepare("SELECT count(*) AS n FROM edges WHERE type='IMPORTS'").get().n),
      localName: columns.includes("local_name_gen")
        ? db.prepare("SELECT local_name_gen FROM edges WHERE type='IMPORTS'").get()?.local_name_gen
        : undefined,
      summary: db.prepare("SELECT summary FROM project_summaries WHERE project=?").get(PROJECT)?.summary,
      integrity: db.prepare("PRAGMA integrity_check").get().integrity_check,
      foreignKeys: db.prepare("PRAGMA foreign_key_check").all(),
    };
  } finally {
    db.close();
  }
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cbm-schema-repair-smoke-"));
try {
  const cacheDir = path.join(tempRoot, "cache");
  const backupRoot = path.join(tempRoot, "backup");
  const rawDir = path.join(backupRoot, "raw");
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.mkdirSync(rawDir, { recursive: true });
  const dbPath = path.join(cacheDir, `${PROJECT}.db`);
  createOldDatabase(dbPath);
  const sourceHash = sha256(dbPath);
  fs.copyFileSync(dbPath, path.join(rawDir, `${PROJECT}.db`));
  const manifestPath = path.join(backupRoot, "manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify({
    source_cache: cacheDir,
    projects: [{
      name: PROJECT,
      source_before: { sha256: sourceHash },
      raw_files: [{ name: `${PROJECT}.db`, sha256: sourceHash }],
    }],
  }, null, 2));

  const duplicateCacheDir = run([
    "--cache-dir", cacheDir,
    "--cache-dir", cacheDir,
    "--project", PROJECT,
  ]);
  assert.equal(duplicateCacheDir.status, 2, duplicateCacheDir.stderr || duplicateCacheDir.stdout);
  assert.equal(JSON.parse(duplicateCacheDir.stderr).error_code, "cli_argument_duplicate");

  const dryRun = run(["--cache-dir", cacheDir, "--project", PROJECT]);
  assert.equal(dryRun.status, 0, `${dryRun.stdout}\n${dryRun.stderr}`);
  const dryPayload = JSON.parse(dryRun.stdout);
  assert.equal(dryPayload.apply, false);
  assert.equal(dryPayload.projects[0].status, "migration_required");
  assert.equal(readState(dbPath).columns.includes("local_name_gen"), false);

  const apply = run([
    "--apply",
    "--cache-dir", cacheDir,
    "--backup-manifest", manifestPath,
    "--project", PROJECT,
  ]);
  assert.equal(apply.status, 0, `${apply.stdout}\n${apply.stderr}`);
  const applyPayload = JSON.parse(apply.stdout);
  assert.equal(applyPayload.projects[0].status, "migrated");
  assert.equal(applyPayload.projects[0].source_hash_verified, true);
  const state = readState(dbPath);
  assert.equal(state.columns.includes("local_name_gen"), true);
  assert.match(state.edgeSql, /UNIQUE\(source_id, target_id, type, local_name_gen\)/);
  assert.equal(state.edges, 1);
  assert.equal(state.imports, 1);
  assert.equal(state.localName, "b");
  assert.equal(state.summary, "## PURPOSE\nPreserve fixture ADR");
  assert.equal(state.integrity, "ok");
  assert.deepEqual(state.foreignKeys, []);

  const second = run([
    "--apply",
    "--cache-dir", cacheDir,
    "--backup-manifest", manifestPath,
    "--project", PROJECT,
  ]);
  assert.equal(second.status, 0, `${second.stdout}\n${second.stderr}`);
  assert.equal(JSON.parse(second.stdout).projects[0].status, "already_compatible");

  const mismatchCache = path.join(tempRoot, "mismatch-cache");
  fs.mkdirSync(mismatchCache, { recursive: true });
  const mismatchDb = path.join(mismatchCache, `${PROJECT}.db`);
  createOldDatabase(mismatchDb, "different");
  const mismatch = run([
    "--apply",
    "--cache-dir", mismatchCache,
    "--backup-manifest", manifestPath,
    "--project", PROJECT,
  ]);
  assert.notEqual(mismatch.status, 0);
  assert.match(`${mismatch.stdout}${mismatch.stderr}`, /source hash mismatch/i);
  assert.equal(readState(mismatchDb).columns.includes("local_name_gen"), false);

  console.log("smoke_cbm_schema_repair ok");
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

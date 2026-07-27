"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const EXPECTED_OLD_COLUMNS = Object.freeze([
  "id",
  "project",
  "source_id",
  "target_id",
  "type",
  "properties",
  "url_path_gen",
]);
const EXPECTED_NEW_COLUMNS = Object.freeze([
  ...EXPECTED_OLD_COLUMNS,
  "local_name_gen",
]);
const NEW_UNIQUE_PATTERN = /UNIQUE\s*\(\s*source_id\s*,\s*target_id\s*,\s*type\s*,\s*local_name_gen\s*\)/i;

function fail(message) {
  const error = new Error(message);
  error.code = "cbm_schema_repair_failed";
  throw error;
}

function parseArgs(argv) {
  const parsed = {
    apply: false,
    cacheDir: process.env.CBM_CACHE_DIR
      ? path.resolve(process.env.CBM_CACHE_DIR)
      : path.join(os.homedir(), ".cache", "codebase-memory-mcp"),
    backupManifest: "",
    projects: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = String(argv[index]);
    if (arg === "--apply") {
      parsed.apply = true;
      continue;
    }
    if (["--cache-dir", "--backup-manifest", "--project"].includes(arg)) {
      const value = argv[index + 1];
      if (!value || String(value).startsWith("--")) fail(`Missing value for ${arg}`);
      index += 1;
      if (arg === "--cache-dir") parsed.cacheDir = path.resolve(String(value));
      if (arg === "--backup-manifest") parsed.backupManifest = path.resolve(String(value));
      if (arg === "--project") parsed.projects.push(String(value));
      continue;
    }
    fail(`Unknown argument: ${arg}`);
  }

  if (parsed.apply && !parsed.backupManifest) {
    fail("--apply requires --backup-manifest");
  }
  return parsed;
}

function sha256(filePath) {
  const hash = crypto.createHash("sha256");
  const descriptor = fs.openSync(filePath, "r");
  const buffer = Buffer.alloc(1024 * 1024);
  try {
    let bytesRead;
    while ((bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, null)) > 0) {
      hash.update(buffer.subarray(0, bytesRead));
    }
  } finally {
    fs.closeSync(descriptor);
  }
  return hash.digest("hex");
}

function loadBackupContext(manifestPath) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (!manifest || !Array.isArray(manifest.projects)) fail("Backup manifest projects array is missing");
  const root = path.dirname(manifestPath);
  const byName = new Map(manifest.projects.map((entry) => [String(entry.name || ""), entry]));
  return { manifest, root, byName };
}

function listProjectNames(cacheDir, requested) {
  if (requested.length > 0) return [...new Set(requested)];
  return fs.readdirSync(cacheDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".db"))
    .map((entry) => entry.name.slice(0, -3))
    .sort();
}

function readSchemaState(dbPath, projectName) {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    db.exec("PRAGMA query_only=ON");
    const columns = db.prepare("PRAGMA table_xinfo(edges)").all().map((row) => String(row.name));
    const edgeSql = String(
      db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='edges'").get()?.sql || ""
    );
    const summaryRows = db.prepare(
      "SELECT project, summary, source_hash, created_at, updated_at FROM project_summaries ORDER BY project"
    ).all();
    return {
      columns,
      edgeSql,
      compatible: columns.length === EXPECTED_NEW_COLUMNS.length
        && EXPECTED_NEW_COLUMNS.every((name, index) => columns[index] === name)
        && NEW_UNIQUE_PATTERN.test(edgeSql),
      oldSchema: columns.length === EXPECTED_OLD_COLUMNS.length
        && EXPECTED_OLD_COLUMNS.every((name, index) => columns[index] === name),
      projectRows: db.prepare("SELECT name, indexed_at, root_path FROM projects ORDER BY name").all(),
      projectPresent: Boolean(db.prepare("SELECT 1 AS ok FROM projects WHERE name=?").get(projectName)),
      nodes: Number(db.prepare("SELECT count(*) AS n FROM nodes").get().n),
      edges: Number(db.prepare("SELECT count(*) AS n FROM edges").get().n),
      imports: Number(db.prepare("SELECT count(*) AS n FROM edges WHERE type='IMPORTS'").get().n),
      summaries: summaryRows.map((row) => ({
        project: String(row.project),
        summary: String(row.summary || ""),
        source_hash: String(row.source_hash || ""),
        created_at: String(row.created_at || ""),
        updated_at: String(row.updated_at || ""),
      })),
      integrity: String(db.prepare("PRAGMA integrity_check").get().integrity_check || ""),
      foreignKeyViolations: db.prepare("PRAGMA foreign_key_check").all(),
    };
  } finally {
    db.close();
  }
}

function verifyBackup(projectName, dbPath, backupContext) {
  const entry = backupContext.byName.get(projectName);
  if (!entry) fail(`Backup manifest has no project entry: ${projectName}`);
  const expectedSourceHash = String(entry.source_before?.sha256 || "");
  if (!expectedSourceHash) fail(`Backup manifest source hash is missing for ${projectName}`);
  const actualSourceHash = sha256(dbPath);
  if (actualSourceHash !== expectedSourceHash) {
    fail(`Source hash mismatch for ${projectName}: expected ${expectedSourceHash}, got ${actualSourceHash}`);
  }

  const rawEntry = Array.isArray(entry.raw_files)
    ? entry.raw_files.find((item) => String(item.name || "") === `${projectName}.db`)
    : null;
  if (!rawEntry?.sha256) fail(`Raw backup entry is missing for ${projectName}.db`);
  const rawPath = path.join(backupContext.root, "raw", `${projectName}.db`);
  if (!fs.existsSync(rawPath)) fail(`Raw backup file is missing: ${rawPath}`);
  const rawHash = sha256(rawPath);
  if (rawHash !== String(rawEntry.sha256)) {
    fail(`Raw backup hash mismatch for ${projectName}: expected ${rawEntry.sha256}, got ${rawHash}`);
  }

  const walPath = `${dbPath}-wal`;
  if (fs.existsSync(walPath) && fs.statSync(walPath).size !== 0) {
    fail(`Refusing migration with non-empty WAL for ${projectName}`);
  }

  return {
    sourceHash: actualSourceHash,
    rawPath,
  };
}

function migrateDatabase(dbPath) {
  const db = new DatabaseSync(dbPath);
  let committed = false;
  try {
    db.exec("PRAGMA foreign_keys=OFF");
    db.exec(`
      BEGIN EXCLUSIVE;
      CREATE TABLE edges_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project TEXT NOT NULL REFERENCES projects(name) ON DELETE CASCADE,
        source_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
        target_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        properties TEXT DEFAULT '{}',
        url_path_gen TEXT GENERATED ALWAYS AS (json_extract(properties,'$.url_path')),
        local_name_gen TEXT GENERATED ALWAYS AS (
          CASE WHEN type='IMPORTS'
            THEN coalesce(json_extract(properties,'$.local_name'),'')
            ELSE ''
          END
        ),
        UNIQUE(source_id, target_id, type, local_name_gen)
      );
      INSERT INTO edges_new(id, project, source_id, target_id, type, properties)
        SELECT id, project, source_id, target_id, type, properties FROM edges;
      DROP TABLE edges;
      ALTER TABLE edges_new RENAME TO edges;
      CREATE INDEX idx_edges_source ON edges(source_id, type);
      CREATE INDEX idx_edges_source_type ON edges(project, source_id, type);
      CREATE INDEX idx_edges_target ON edges(target_id, type);
      CREATE INDEX idx_edges_target_type ON edges(project, target_id, type);
      CREATE INDEX idx_edges_type ON edges(project, type);
      CREATE INDEX idx_edges_url_path ON edges(project, url_path_gen);
      COMMIT;
    `);
    committed = true;
    db.exec("PRAGMA foreign_keys=ON");
  } catch (error) {
    if (!committed) {
      try { db.exec("ROLLBACK"); } catch {}
    }
    throw error;
  } finally {
    db.close();
  }
}

function validatePostMigration(before, after) {
  if (!after.compatible) fail("Migrated edges schema does not match the v0.9.0 contract");
  if (after.integrity !== "ok") fail(`Post-migration integrity check failed: ${after.integrity}`);
  if (after.foreignKeyViolations.length > 0) fail("Post-migration foreign key violations detected");
  if (after.nodes !== before.nodes || after.edges !== before.edges || after.imports !== before.imports) {
    fail("Post-migration node or edge counts changed");
  }
  if (JSON.stringify(after.projectRows) !== JSON.stringify(before.projectRows)) {
    fail("Post-migration project rows changed");
  }
  if (JSON.stringify(after.summaries) !== JSON.stringify(before.summaries)) {
    fail("Post-migration ADR summaries changed");
  }
}

function restoreRawDatabase(projectName, cacheDir, backupContext) {
  const source = path.join(backupContext.root, "raw", `${projectName}.db`);
  const target = path.join(cacheDir, `${projectName}.db`);
  if (!fs.existsSync(source)) fail(`Rollback source is missing: ${source}`);
  for (const suffix of ["-wal", "-shm"]) {
    fs.rmSync(`${target}${suffix}`, { force: true });
  }
  fs.copyFileSync(source, target);
  for (const suffix of ["-wal", "-shm"]) {
    const rawSidecar = path.join(backupContext.root, "raw", `${projectName}.db${suffix}`);
    if (fs.existsSync(rawSidecar)) fs.copyFileSync(rawSidecar, `${target}${suffix}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(args.cacheDir) || !fs.statSync(args.cacheDir).isDirectory()) {
    fail(`CBM cache directory does not exist: ${args.cacheDir}`);
  }
  const backupContext = args.apply ? loadBackupContext(args.backupManifest) : null;
  const projectNames = listProjectNames(args.cacheDir, args.projects);
  if (projectNames.length === 0) fail("No CBM project databases found");

  const report = {
    schema_version: 1,
    apply: args.apply,
    cache_dir: args.cacheDir,
    backup_manifest: args.backupManifest,
    projects: [],
    rolled_back: false,
  };
  const migrated = [];

  try {
    for (const projectName of projectNames) {
      const dbPath = path.join(args.cacheDir, `${projectName}.db`);
      if (!fs.existsSync(dbPath)) fail(`Project database does not exist: ${dbPath}`);
      const before = readSchemaState(dbPath, projectName);
      if (!before.projectPresent) fail(`Database does not contain project row: ${projectName}`);
      if (before.integrity !== "ok") fail(`Pre-migration integrity check failed for ${projectName}`);
      if (before.foreignKeyViolations.length > 0) fail(`Pre-migration foreign key violations for ${projectName}`);

      if (before.compatible) {
        report.projects.push({
          project: projectName,
          status: "already_compatible",
          source_hash: sha256(dbPath),
          nodes: before.nodes,
          edges: before.edges,
          imports: before.imports,
          adr_summary_lengths: before.summaries.map((row) => ({ project: row.project, length: row.summary.length })),
        });
        continue;
      }
      if (!before.oldSchema) {
        fail(`Unsupported edges schema for ${projectName}: ${before.columns.join(",")}`);
      }

      if (!args.apply) {
        report.projects.push({
          project: projectName,
          status: "migration_required",
          nodes: before.nodes,
          edges: before.edges,
          imports: before.imports,
          columns: before.columns,
          adr_summary_lengths: before.summaries.map((row) => ({ project: row.project, length: row.summary.length })),
        });
        continue;
      }

      const backup = verifyBackup(projectName, dbPath, backupContext);
      migrateDatabase(dbPath);
      migrated.push(projectName);
      const after = readSchemaState(dbPath, projectName);
      validatePostMigration(before, after);
      report.projects.push({
        project: projectName,
        status: "migrated",
        source_hash_verified: true,
        source_hash_before: backup.sourceHash,
        source_hash_after: sha256(dbPath),
        nodes: after.nodes,
        edges: after.edges,
        imports: after.imports,
        columns: after.columns,
        integrity_check: after.integrity,
        foreign_key_violations: after.foreignKeyViolations.length,
        adr_summary_lengths: after.summaries.map((row) => ({ project: row.project, length: row.summary.length })),
      });
    }
  } catch (error) {
    if (args.apply && backupContext) {
      for (const projectName of migrated.reverse()) {
        restoreRawDatabase(projectName, args.cacheDir, backupContext);
      }
      report.rolled_back = migrated.length > 0;
    }
    throw error;
  }

  report.ok = true;
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error?.message || String(error)}\n`);
  process.exitCode = 1;
}

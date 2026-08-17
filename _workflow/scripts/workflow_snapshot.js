"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { CliArgumentError, parseCliArgs } = require("./cli_args");

const ROOT = path.resolve(__dirname, "..", "..");
const DEFAULT_FILES = [
  "_workflow/WORKFLOW_CANON.md",
  "_workflow/state.json",
  "_workflow/README.md",
  "_workflow/scripts/workflow_snapshot.js",
  "_workflow/scripts/workflow_validate.js",
  "_workflow/scripts/runtime_apply_package_preparation_check.js",
  "_tests/smoke_workstream_boundary_control_review.js",
  "_tests/smoke_workplace_contract.js",
  "_tests/run_all_smokes.js",
  "_tests/run_all_smoke_scripts.json",
];

const RUNTIME_SNAPSHOT_ALLOWLIST = new Set([
  "server.js",
  "src/stage_metadata.js",
  "src/runtime/identity.js",
  "src/runtime/auth_bootstrap_config_resolver.js",
  "src/runtime/cors_preflight_handler.js",
  "src/runtime/startup_report_builder.js",
  "src/runtime/server_cli_args.js",
  "src/runtime/static_docs.js",
  "src/runtime/server_factory.js",
  "src/runtime/server_lifecycle.js",
  "src/runtime/server_bootstrap_runtime.js",
  "src/runtime/mcp_runtime_handlers.js",
  "src/runtime/runtime_context_assembly.js",
  "src/runtime/runtime_status_assembly.js",
  "src/runtime/optional_tools_assembly.js",
  "src/runtime/runtime_support_assembly.js",
  "src/runtime/code_sample_selftest.js",
  "src/mechanism_parity_matrix.js",
  "src/truth/parity_audit.js",
  "src/truth/project_truth_audit.js",
  "src/runtime/request_body_parse_handler.js",
  "tools/plugin_execution_governance.js",
  "src/schemas/plugin_execution_tools.js",
  "src/auth/auth_policy.js",
  "src/auth/auth_access.js",
  "src/auth/auth_bearer.js",
  "src/startup_report.js",
  "SERVER_SPEC.json",
]);

const FORBIDDEN_PATH_SEGMENTS = new Set([
  ".env",
  ".mcp_trash",
  ".secrets",
  "logs",
  "_logs",
  "node_modules",
]);

const TRANSIENT_RENAME_CODES = new Set(["EACCES", "EBUSY", "EPERM"]);
const SNAPSHOT_RENAME_RETRY_DELAYS_MS = [25, 50, 100, 200, 400, 500, 500];

function safeLabel(label) {
  return String(label || "workflow-snapshot")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "workflow-snapshot";
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function sleepSync(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function publishSnapshotDirectory(stagingDir, snapshotDir) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      fs.renameSync(stagingDir, snapshotDir);
      return;
    } catch (error) {
      if (!TRANSIENT_RENAME_CODES.has(error?.code) || attempt >= SNAPSHOT_RENAME_RETRY_DELAYS_MS.length) {
        throw error;
      }
      sleepSync(SNAPSHOT_RENAME_RETRY_DELAYS_MS[attempt]);
    }
  }
}

function parseArgs(argv) {
  const parsed = parseCliArgs(argv, {
    valueOptions: ["label"],
    repeatableValueOptions: ["file"],
  });
  return {
    files: parsed.values("file"),
    label: parsed.value("label"),
  };
}

function assertSafeRelativePath(filePath) {
  if (path.isAbsolute(filePath)) throw new Error(`absolute path rejected: ${filePath}`);
  const normalized = filePath.replace(/\\/g, "/");
  if (normalized.includes("../") || normalized === "..") {
    throw new Error(`traversal rejected: ${filePath}`);
  }
  if (
    normalized === "_workflow/control_plane/snapshots" ||
    normalized.startsWith("_workflow/control_plane/snapshots/")
  ) {
    throw new Error(`nested control-plane snapshots rejected: ${filePath}`);
  }
  const segments = normalized.split("/");
  for (const segment of segments) {
    if (FORBIDDEN_PATH_SEGMENTS.has(segment)) {
      throw new Error(`forbidden snapshot path segment rejected: ${filePath}`);
    }
  }
  if (
    !normalized.startsWith("_workflow/") &&
    !normalized.startsWith("_tests/") &&
    !RUNTIME_SNAPSHOT_ALLOWLIST.has(normalized)
  ) {
    throw new Error(
      `workflow snapshot only accepts _workflow/, _tests/, or explicitly allowlisted runtime files: ${filePath}`
    );
  }
  return normalized;
}

function createSnapshot({ label = "workflow-snapshot", files = DEFAULT_FILES } = {}) {
  const normalizedFiles = files.map((filePath) => assertSafeRelativePath(filePath));
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const snapshotRoot = path.join(ROOT, "_workflow", "control_plane", "snapshots");
  const snapshotName = `${timestamp}_${safeLabel(label)}`;
  const snapshotDir = path.join(snapshotRoot, snapshotName);
  const stagingDir = path.join(
    snapshotRoot,
    `.pending-${snapshotName}-${process.pid}-${crypto.randomBytes(6).toString("hex")}`
  );
  fs.mkdirSync(snapshotRoot, { recursive: true });
  if (fs.existsSync(snapshotDir)) {
    throw new Error(`snapshot destination already exists: ${path.relative(ROOT, snapshotDir).replace(/\\/g, "/")}`);
  }
  fs.mkdirSync(stagingDir);

  try {
    const entries = [];
    for (const normalizedPath of normalizedFiles) {
      const source = path.resolve(ROOT, normalizedPath);
      const relativeSource = path.relative(ROOT, source).replace(/\\/g, "/");
      if (relativeSource.startsWith("../") || relativeSource === ".." || path.isAbsolute(relativeSource)) {
        throw new Error(`resolved path escapes repository root: ${normalizedPath}`);
      }
      if (!fs.existsSync(source)) {
        entries.push({ path: normalizedPath, copied: false, reason: "missing" });
        continue;
      }
      const content = fs.readFileSync(source);
      const target = path.join(stagingDir, normalizedPath);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, content);
      entries.push({
        path: normalizedPath,
        copied: true,
        bytes: content.length,
        sha256: sha256(content),
      });
    }

    const manifest = {
      snapshot_version: "workflow-snapshot-v1",
      created_at: new Date().toISOString(),
      label: safeLabel(label),
      root: "mcp-tests",
      path: path.relative(ROOT, snapshotDir).replace(/\\/g, "/"),
      entries,
    };
    fs.writeFileSync(path.join(stagingDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    publishSnapshotDirectory(stagingDir, snapshotDir);
    return manifest;
  } catch (error) {
    fs.rmSync(stagingDir, { recursive: true, force: true });
    throw error;
  }
}

if (require.main === module) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const manifest = createSnapshot({
      label: args.label || "workflow-snapshot",
      files: args.files.length ? args.files : DEFAULT_FILES,
    });
    console.log(JSON.stringify(manifest, null, 2));
  } catch (error) {
    if (error instanceof CliArgumentError) {
      console.error(JSON.stringify({ success: false, error_code: error.code, argument: error.argument, message: error.message }));
      process.exit(2);
    }
    console.error(error?.stack || error?.message || String(error));
    process.exit(1);
  }
}

module.exports = {
  createSnapshot,
  parseArgs,
};

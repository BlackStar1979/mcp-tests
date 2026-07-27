"use strict";

const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { EXPECTED_NATIVE_TOOLS } = require("../src/integrations/codebase_memory/cbm_contract_registry");

function defaultExecutablePath(env = process.env) {
  if (process.platform === "win32") {
    return path.join(String(env.LOCALAPPDATA || env.USERPROFILE || ""), "Programs", "codebase-memory-mcp", "codebase-memory-mcp.exe");
  }
  return path.join(String(env.HOME || ""), ".local", "bin", "codebase-memory-mcp");
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function run(executable, args) {
  const result = childProcess.spawnSync(executable, args, {
    cwd: process.cwd(),
    shell: false,
    windowsHide: true,
    encoding: "utf8",
    timeout: 30000,
    maxBuffer: 2 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`CBM command failed (${result.status}): ${args.join(" ")}\n${result.stderr || result.stdout}`);
  }
  return { stdout: String(result.stdout || "").trim(), stderr: String(result.stderr || "").trim() };
}

function parseVersion(text) {
  const match = String(text).match(/^codebase-memory-mcp\s+(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)$/);
  if (!match) throw new Error(`Unexpected CBM version output: ${text}`);
  return match[1];
}

function parseTopLevelTools(help) {
  const block = String(help).match(/\nTools:\s*([\s\S]*?)(?:\r?\n\r?\n|$)/);
  if (!block) throw new Error("Top-level CBM help does not contain a Tools block.");
  const names = block[1].match(/[a-z][a-z0-9_]+/g) || [];
  return [...new Set(names)];
}

function parseFlags(help) {
  const flags = {};
  const ordered = [];
  for (const line of String(help).split(/\r?\n/)) {
    const match = line.match(/^\s+--([a-z0-9-]+)\s+<([^>]+)>(\s+\[required\])?(?:\s{2,}.*)?$/i);
    if (!match) continue;
    const name = match[1].replaceAll("-", "_");
    const type = match[2].toLowerCase();
    const required = Boolean(match[3]);
    flags[name] = { type, required };
    ordered.push(name);
  }
  return {
    flags,
    required_flags: ordered.filter((name) => flags[name].required),
    optional_flags: ordered.filter((name) => !flags[name].required),
  };
}

function buildManifest(executable) {
  const versionOutput = run(executable, ["--version"]).stdout;
  const version = parseVersion(versionOutput);
  const topHelp = run(executable, ["--help"]).stdout;
  const nativeTools = parseTopLevelTools(topHelp);
  if (JSON.stringify(nativeTools) !== JSON.stringify(EXPECTED_NATIVE_TOOLS)) {
    throw new Error(`Native CBM tool list mismatch: ${JSON.stringify(nativeTools)}`);
  }

  const tools = {};
  const helpParts = [topHelp];
  for (const tool of nativeTools) {
    const help = run(executable, ["cli", tool, "--help"]).stdout;
    helpParts.push(help);
    tools[tool] = { ...parseFlags(help), help_sha256: sha256(help) };
  }

  return {
    contract_version: "cbm-cli-contract-v1",
    cbm_version: version,
    captured_at: new Date().toISOString(),
    captured_executable_path: path.normalize(executable),
    captured_executable_size: fs.statSync(executable).size,
    captured_executable_sha256: sha256(fs.readFileSync(executable)),
    native_tools: nativeTools,
    tools,
    help_sha256: sha256(helpParts.join("\n\n---\n\n")),
    sources: {
      release: `https://github.com/DeusData/codebase-memory-mcp/releases/tag/v${version}`,
      readme: `https://github.com/DeusData/codebase-memory-mcp/blob/v${version}/README.md`,
      docs: `https://github.com/DeusData/codebase-memory-mcp/tree/v${version}/docs`,
    },
  };
}

function main() {
  const args = new Set(process.argv.slice(2));
  const executableArg = process.argv.find((value) => value.startsWith("--executable="));
  const executable = path.normalize(executableArg ? executableArg.slice("--executable=".length) : process.env.CBM_EXE_PATH || defaultExecutablePath());
  const manifest = buildManifest(executable);
  const text = `${JSON.stringify(manifest, null, 2)}\n`;
  const output = path.join(__dirname, "..", "src", "integrations", "codebase_memory", "contracts", `v${manifest.cbm_version}.json`);

  if (args.has("--check")) {
    if (!fs.existsSync(output)) throw new Error(`Missing contract manifest: ${output}`);
    const existing = JSON.parse(fs.readFileSync(output, "utf8"));
    const comparable = { ...manifest, captured_at: existing.captured_at };
    if (JSON.stringify(existing) !== JSON.stringify(comparable)) {
      throw new Error(`CBM contract manifest drift: ${output}`);
    }
    console.log(JSON.stringify({ ok: true, mode: "check", output, version: manifest.cbm_version, tool_count: manifest.native_tools.length }));
    return;
  }

  if (args.has("--write")) {
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, text, "utf8");
    console.log(JSON.stringify({ ok: true, mode: "write", output, version: manifest.cbm_version, tool_count: manifest.native_tools.length }));
    return;
  }

  process.stdout.write(text);
}

if (require.main === module) main();

module.exports = {
  buildManifest,
  defaultExecutablePath,
  parseFlags,
  parseTopLevelTools,
  parseVersion,
};

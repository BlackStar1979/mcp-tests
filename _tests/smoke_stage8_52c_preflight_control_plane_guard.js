const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}
function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

const preflight = read("_workflow/PREFLIGHT.md");
const handoff = read("_workflow/NEXT_CHAT_HANDOFF.md");
const course = read("_workflow/WORKING_COURSE.md");
const index = read("_workflow/INDEX.md");

for (const required of [
  "MANDATORY / READ BEFORE ACTING",
  "## 1. Audience first",
  "Use Polish.",
  "Use English.",
  "Use instruction-style English.",
  "## 2. Read current project truth before acting",
  "Do not rely on conversational memory as the primary source of truth.",
  "## 3. Search existing doctrine before inventing a rule",
  "Do not rediscover it as new.",
  "## 4. Separate truth layers",
  "ChatGPT connector UI truth",
  "OpenAI platform documentation truth",
  "Uwagi do wersji is a ChatGPT UI field.",
  "dev-3 is an observed value of that UI field, not the field name.",
  "## 5. Choose the least risky tool",
  "run_process only when justified",
  "## 6. Interpret approval dialogs precisely",
  "platform risk classification",
  "actual returned data",
  "## 7. Update canonical sections, not only appendices",
  "## 8. Stop after repeated failure",
  "## 9. Restart and refresh rules",
  "Docs/tests/workflow scripts only: no restart.",
  "## 10. Minimum validation",
]) {
  assert.ok(preflight.includes(required), `PREFLIGHT.md missing: ${required}`);
}

for (const rel of [
  "_workflow/scripts/test_mcp_backup.ps1",
  "_workflow/scripts/test_mcp_deploy.ps1",
  "_workflow/scripts/test_mcp_rollback.ps1",
  "_workflow/scripts/test_mcp_restart.ps1",
  "_stages/2026-05-23_stage8_52b-control-plane/validation.md",
  "_tests/smoke_stage8_52d_control_plane_deploy_rollback.js",
]) {
  assert.ok(exists(rel), `${rel} must exist`);
}

assert.ok(exists("_backups/deploy"), "_backups/deploy must exist");
assert.ok(exists("_backups/deploy_files"), "_backups/deploy_files must exist");
assert.ok(exists("_backups/snapshots"), "_backups/snapshots must exist");

assert.ok(course.includes("Stage 8 / Step 52b — TEST MCP preflight and control-plane scripts"));
assert.ok(course.includes("backup real snapshot ok"));
assert.ok(course.includes("Stage 8 / Step 53 — server.js runtime container extraction"));
assert.ok(course.includes("stage8_52e-cross-server-mechanism-parity-matrix-complete"));
assert.ok(course.includes("Stage 8 / Step 52c added the PREFLIGHT guard"));
assert.ok(!course.includes("PREFLIGHT smoke guard: blocked by tool safety write layer"));
assert.ok(!course.includes("Next primary implementation course:\n\n```text\nStage 8 / Step 52 — runtime identity"));

assert.ok(handoff.includes("Read this first in the next ChatGPT window."));
assert.ok(handoff.includes("Updated: 2026-05-23 after Stage 8 / Step 52e."));
assert.ok(handoff.includes("current_working_course = stage8_52e-cross-server-mechanism-parity-matrix-complete"));
assert.ok(handoff.includes("src/mechanism_parity_matrix.js"));
assert.ok(handoff.includes("science_tools"));
assert.ok(handoff.includes("truth_tools"));
assert.ok(handoff.includes("process_tools"));
assert.ok(handoff.includes("remote_site_tools"));
assert.ok(handoff.includes("Stage 8 / Step 53a — internal-only truth_tools parity preflight"));
assert.ok(handoff.includes("Stage 8 / Step 53b — server.js runtime container extraction"));
assert.ok(handoff.includes("stage8_53a-internal-truth-tools-parity-preflight"));
assert.ok(handoff.includes("stage8_53b-server-entrypoint-split"));
assert.ok(!handoff.includes("Updated: 2026-05-22 after Stage 8 / Step 49."));
assert.ok(!handoff.includes("Current repo course after Stage 8 / Step 49"));
assert.ok(!handoff.includes("## 9. Next work: Stage 8 / Step 49"));
assert.ok(!handoff.includes("stage8_49-structural-topology-foundation-complete"));
assert.ok(!handoff.includes("next primary: Stage 8 / Step 51 operator decision packet"));
assert.ok(index.includes("Stage 8 / Step 52d GPT MCP deploy/rollback parity repair"));
assert.ok(index.includes("current_working_course = stage8_52e-cross-server-mechanism-parity-matrix-complete"));
assert.ok(index.includes("Stage 8 / Step 52e cross-server mechanism parity matrix"));
assert.ok(index.includes("Stage 8 / Step 53 — server.js runtime container extraction"));
assert.ok(index.lastIndexOf("Stage 8 / Step 52d GPT MCP deploy/rollback parity repair") > index.lastIndexOf("Stage 8 / Step 51 — workflow/plugin/readme topology cleanup"));
assert.ok(index.lastIndexOf("Stage 8 / Step 52e cross-server mechanism parity matrix") > index.lastIndexOf("Stage 8 / Step 52d GPT MCP deploy/rollback parity repair"));

console.log("smoke_stage8_52c_preflight_control_plane_guard ok");

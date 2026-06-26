"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { renderDocs } = require("./render_workflow_docs");
const { validate } = require("./workflow_validate");

const STATE_PATH = path.join(process.cwd(), "_workflow", "state.json");

function readState() {
  return JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
}

function writeState(state) {
  fs.writeFileSync(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`);
}

function closeoutFreeze({ runFullSmoke = false } = {}) {
  const profile = runFullSmoke ? "closeout" : "targeted";
  let state = readState();

  state.updated_at = new Date().toISOString();
  state.current_work_package.status = "frozen";
  state.current_work_package.restart_pending = false;
  state.current_work_package.operator_controlled_restart_required = false;
  state.current_work_package.acceptance.docs_point_to_state = true;
  state.current_work_package.acceptance.workflow_state_smoke = true;
  state.current_work_package.acceptance.closeout_freeze_helper = true;
  state.current_work_package.acceptance.closeout_uses_validator = true;
  writeState(state);

  const renderBefore = renderDocs({ dryRun: false });
  const validation = validate({ profile, updateState: true });

  state = readState();
  state.updated_at = new Date().toISOString();
  state.current_work_package.status = validation.ok ? "frozen" : "blocked";
  state.current_work_package.restart_pending = false;
  state.current_work_package.operator_controlled_restart_required = false;
  state.current_work_package.acceptance.closeout_uses_validator = true;
  if (validation.ok && runFullSmoke) {
    state.current_work_package.acceptance.full_smoke_skip_network = "ok";
  }
  writeState(state);

  const renderAfter = renderDocs({ dryRun: false });

  return {
    ok: validation.ok,
    profile,
    state: {
      current_work_package: state.current_work_package,
      last_validation: state.last_validation,
    },
    render_before: renderBefore,
    validation,
    render_after: renderAfter,
    index_rebuild_required: true,
  };
}

if (require.main === module) {
  try {
    const runFullSmoke = process.argv.includes("--run-full-smoke");
    const result = closeoutFreeze({ runFullSmoke });
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.ok ? 0 : 1);
  } catch (error) {
    console.error(error?.stack || error?.message || String(error));
    process.exit(1);
  }
}

module.exports = {
  closeoutFreeze,
};

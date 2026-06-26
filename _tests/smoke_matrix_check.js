const assert = require("node:assert/strict");
const { runMatrixAudit } = require("../_workflow/scripts/matrix_check");
const result = runMatrixAudit();
assert.equal(result.summary.ok, true);
assert.equal(result.summary.error_count, 0);
assert.equal(result.summary.warn_count, 0);
assert.ok(result.summary.root_spec_count >= 17);
console.log("smoke_matrix_check ok");

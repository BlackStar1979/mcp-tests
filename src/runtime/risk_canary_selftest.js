"use strict";

const { classifySensitiveMarkers } = require("./audit_arg_markers");

function assertRiskCanarySelfTest(riskPayload) {
  if (!riskPayload) {
    throw new Error("risk-canary-cyber-markers fetch payload missing");
  }

  if (riskPayload.text.includes("real credentials")) {
    throw new Error("risk canary must not contain real credential claim");
  }

  const flags = classifySensitiveMarkers(riskPayload.text);

  if (!flags.has_mcp || !flags.has_token || !flags.has_bearer || !flags.has_authorization || !flags.has_secret) {
    throw new Error("risk canary marker classification mismatch");
  }
}

module.exports = {
  assertRiskCanarySelfTest,
};

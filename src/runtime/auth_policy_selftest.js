"use strict";

function assertAuthPolicySelfTest(authPolicy) {
  const authStatus = authPolicy.status();

  if (!authStatus || authStatus.mode !== authPolicy.mode) {
    throw new Error("auth policy status mismatch");
  }

  if (authPolicy.mode === "none" && authStatus.requires_auth !== false) {
    throw new Error("none auth mode must not require auth");
  }
}

module.exports = {
  assertAuthPolicySelfTest,
};

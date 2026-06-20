function buildSecurityBoundary({ profile, authPolicy, stageStatus } = {}) {
  const authMode = authPolicy?.mode || "unknown";
  const requiresAuth = Boolean(authPolicy?.requiresAuth);
  const publicExposure = profile === "public";
  const internalProfile = profile === "internal";
  const errors = [];
  const warnings = [];

  if (internalProfile && !requiresAuth) {
    errors.push("internal profile requires authenticated transport");
  }

  if (publicExposure && authMode === "none") {
    warnings.push("public profile uses auth.none; only public_safe read-only tools may be exposed");
  }

  return {
    status: errors.length === 0 ? "ok" : "error",
    stage_status: stageStatus || "",
    profile,
    auth_mode: authMode,
    requires_auth: requiresAuth,
    public_exposure: publicExposure,
    internal_profile: internalProfile,
    plugin_execution_allowed: false,
    dynamic_import_allowed: false,
    write_tools_allowed: false,
    code_runner_allowed: false,
    list_changed_allowed: false,
    errors,
    warnings,
  };
}

function assertSecurityBoundary(context = {}) {
  const boundary = buildSecurityBoundary(context);
  if (boundary.errors.length > 0) {
    throw new Error(`security boundary failed: ${boundary.errors.join("; ")}`);
  }
  return boundary;
}

module.exports = {
  assertSecurityBoundary,
  buildSecurityBoundary,
};

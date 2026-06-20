"use strict";

const PUBLIC_HEALTH_AUTH_STATUS_VERSION = "public-health-auth-status-v1";

function boolFromStatus(value, fallback = false) {
  if (typeof value === "boolean") return value;
  return Boolean(fallback);
}

function buildPublicHealthAuthStatus(authPolicy = {}) {
  const status = typeof authPolicy.status === "function" ? authPolicy.status() : {};

  return {
    mode: String(status.mode || authPolicy.mode || "unknown"),
    enabled: boolFromStatus(status.enabled, authPolicy.enabled),
    requires_auth: boolFromStatus(status.requires_auth, authPolicy.requiresAuth),
    public_health_redacted: true,
    public_health_auth_status_version: PUBLIC_HEALTH_AUTH_STATUS_VERSION,
  };
}

module.exports = {
  PUBLIC_HEALTH_AUTH_STATUS_VERSION,
  buildPublicHealthAuthStatus,
};

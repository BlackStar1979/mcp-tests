"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { validateProfileObject } = require("./profile_schema_validator");

const PROFILE_NAME_RE = /^[a-z0-9_-]+$/;

function deriveProfileSurface(authMode) {
  return String(authMode || "none").trim().toLowerCase() === "none" ? "public" : "authenticated";
}

function loadServerProfileConfig({ profileName, authMode, rootDir = path.join(__dirname, "..") } = {}) {
  const name = String(profileName || "").trim().toLowerCase();
  if (!name) return null;
  if (!PROFILE_NAME_RE.test(name)) {
    throw new Error("Invalid server profile name: " + name + ".");
  }

  const profilePath = path.join(rootDir, "profiles", name + ".json");
  const parsed = JSON.parse(fs.readFileSync(profilePath, "utf8"));
  const validation = validateProfileObject(parsed, { expectedName: name, profilePath });
  if (!validation.ok) {
    throw new Error("Invalid server profile " + name + ": " + validation.errors.join("; "));
  }

  if (String(parsed.name || "").trim().toLowerCase() !== name) {
    throw new Error("Profile file name does not match profile name: " + profilePath);
  }

  const surfaceName = deriveProfileSurface(authMode);
  const surface = parsed.surfaces && parsed.surfaces[surfaceName];
  if (!surface || !Array.isArray(surface.optional_tool_groups)) {
    throw new Error("Profile " + name + " missing surface configuration for " + surfaceName);
  }

  return Object.freeze({
    name,
    path: profilePath,
    version: parsed.version || 1,
    raw: Object.freeze(parsed),
    surfaceName,
    surface: Object.freeze({ ...surface }),
  });
}

module.exports = {
  deriveProfileSurface,
  loadServerProfileConfig,
};

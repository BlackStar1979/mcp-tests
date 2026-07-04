const path = require("node:path");

const PRIMARY_WORK_ROOT_ALIAS = "work";
const WORK_ROOTS_ENV_VAR = "MCP_TEST_EXTRA_ROOTS";
const DEFAULT_WORK_ROOT = process.platform === "win32" ? "C:\\Work" : path.resolve(__dirname, "..", "..", "..");
const READ_BLOCKED_PATH_PREFIXES = new Set([
  "mcp/.secrets",
]);

function stripQuotes(value) {
  return String(value || "").trim().replace(/^['"]|['"]$/g, "");
}

function looksLikeWindowsAbsolute(value) {
  return /^[a-zA-Z]:[\\/]/.test(value) || /^\\\\[^\\]+[\\/][^\\/]+/.test(value);
}

function comparePath(value) {
  return String(value || "")
    .replaceAll("\\", "/")
    .replace(/\/+$/, "")
    .toLowerCase();
}

function hostResolveAbsolute(value) {
  const raw = stripQuotes(value);
  if (!raw) {
    throw new Error("Workspace root path cannot be empty.");
  }
  if (looksLikeWindowsAbsolute(raw)) {
    return path.win32.normalize(raw);
  }
  return path.resolve(raw);
}

function normalizeAlias(value) {
  const alias = String(value || "").trim().toLowerCase();
  if (!alias) {
    throw new Error("Workspace root alias cannot be empty.");
  }
  if (!/^[a-z0-9_-]+$/.test(alias)) {
    throw new Error(`Invalid workspace root alias: ${value}`);
  }
  return alias;
}

function overlaps(a, b) {
  const left = comparePath(a);
  const right = comparePath(b);
  return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
}

function parseExtraWorkRoots(raw = "") {
  const entries = [];
  const text = String(raw || "").trim();
  if (!text) {
    return entries;
  }

  for (const part of text.split(";")) {
    const item = part.trim();
    if (!item) {
      continue;
    }
    const eq = item.indexOf("=");
    if (eq <= 0) {
      throw new Error(`Invalid ${WORK_ROOTS_ENV_VAR} entry: ${item}`);
    }
    const alias = normalizeAlias(item.slice(0, eq));
    const root = hostResolveAbsolute(item.slice(eq + 1));
    entries.push([alias, root]);
  }

  return entries;
}

function buildWorkRoots({
  primaryAlias = PRIMARY_WORK_ROOT_ALIAS,
  primaryPath = process.env.MCP_TEST_WORK_ROOT || DEFAULT_WORK_ROOT,
  extraRootsEnv = process.env[WORK_ROOTS_ENV_VAR] || "",
} = {}) {
  const roots = new Map();
  const seen = [];

  function addRoot(aliasValue, rootValue) {
    const alias = normalizeAlias(aliasValue);
    const root = hostResolveAbsolute(rootValue);

    if (roots.has(alias)) {
      throw new Error(`Duplicate workspace root alias: ${alias}`);
    }

    for (const [existingAlias, existingPath] of seen) {
      if (overlaps(existingPath, root)) {
        throw new Error(`Overlapping workspace roots are not allowed: ${existingAlias}=${existingPath} overlaps with ${alias}=${root}`);
      }
    }

    roots.set(alias, root);
    seen.push([alias, root]);
  }

  addRoot(primaryAlias, primaryPath);
  for (const [alias, root] of parseExtraWorkRoots(extraRootsEnv)) {
    addRoot(alias, root);
  }
  return roots;
}

function normalizeRel(relativePath = ".") {
  const clean = String(relativePath || ".")
    .trim()
    .replaceAll("\\", "/");
  if (!clean) {
    return ".";
  }
  if (clean.length > 1000) {
    throw new Error("Path is too long.");
  }
  if (clean.includes("\u0000")) {
    throw new Error("Path contains NUL byte.");
  }
  if (clean.startsWith("/") || clean.startsWith("//")) {
    throw new Error("Absolute paths are not allowed.");
  }
  if (/^[A-Za-z]:/.test(clean)) {
    throw new Error("Drive-letter paths are not allowed.");
  }
  return clean || ".";
}

function formatDisplayPath(rootAlias, rootRelativePath, primaryAlias) {
  const rel = rootRelativePath && rootRelativePath !== "." ? rootRelativePath : "";
  if (rootAlias === primaryAlias) {
    return rel || ".";
  }
  return rel ? `@${rootAlias}/${rel}` : `@${rootAlias}`;
}

function listWorkspaceRoots(roots = buildWorkRoots(), primaryAlias = PRIMARY_WORK_ROOT_ALIAS) {
  return [...roots.entries()].map(([alias, rootPath]) => ({
    alias,
    path: rootPath,
    primary: alias === primaryAlias,
  }));
}

function resolveWorkspaceTarget(relativePath = ".", { roots = buildWorkRoots(), primaryAlias = PRIMARY_WORK_ROOT_ALIAS } = {}) {
  const clean = normalizeRel(relativePath);
  if (clean === ".") {
    return {
      requested: clean,
      rootAlias: primaryAlias,
      rootPath: roots.get(primaryAlias),
      rootRelativePath: ".",
      displayPath: ".",
      usedAlias: false,
    };
  }

  const aliasMatch = clean.match(/^@([a-z0-9_-]+)(?:\/(.*))?$/i);
  if (aliasMatch) {
    const rootAlias = aliasMatch[1].toLowerCase();
    if (!roots.has(rootAlias)) {
      throw new Error(`Unknown workspace root alias: @${rootAlias}`);
    }
    const rootRelativePath = aliasMatch[2] ? normalizeRel(aliasMatch[2]) : ".";
    return {
      requested: clean,
      rootAlias,
      rootPath: roots.get(rootAlias),
      rootRelativePath,
      displayPath: formatDisplayPath(rootAlias, rootRelativePath, primaryAlias),
      usedAlias: true,
    };
  }

  return {
    requested: clean,
    rootAlias: primaryAlias,
    rootPath: roots.get(primaryAlias),
    rootRelativePath: clean,
    displayPath: clean,
    usedAlias: false,
  };
}

function findBlockedPrefix(fullPath, prefixes, rootPath) {
  const resolved = path.resolve(fullPath);
  for (const prefix of prefixes) {
    const full = path.resolve(rootPath, prefix);
    if (resolved === full || resolved.startsWith(`${full}${path.sep}`)) {
      return prefix;
    }
  }
  return null;
}

function safeWorkspacePath(relativePath = ".", options = {}) {
  const roots = options.roots || buildWorkRoots();
  const primaryAlias = options.primaryAlias || PRIMARY_WORK_ROOT_ALIAS;
  const target = resolveWorkspaceTarget(relativePath, { roots, primaryAlias });
  const absolutePath = path.resolve(target.rootPath, target.rootRelativePath);
  const rootWithSep = target.rootPath.endsWith(path.sep) ? target.rootPath : `${target.rootPath}${path.sep}`;

  if (absolutePath !== target.rootPath && !absolutePath.startsWith(rootWithSep)) {
    throw new Error("Access denied");
  }

  const blockedPrefix = findBlockedPrefix(absolutePath, READ_BLOCKED_PATH_PREFIXES, target.rootPath);
  if (blockedPrefix) {
    throw new Error(`Blocked path: ${blockedPrefix}`);
  }

  return {
    ...target,
    absolutePath,
  };
}

module.exports = {
  PRIMARY_WORK_ROOT_ALIAS,
  READ_BLOCKED_PATH_PREFIXES,
  WORK_ROOTS_ENV_VAR,
  buildWorkRoots,
  listWorkspaceRoots,
  resolveWorkspaceTarget,
  safeWorkspacePath,
};

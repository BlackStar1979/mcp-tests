const crypto = require("node:crypto");
const dns = require("node:dns").promises;
const net = require("node:net");

const DEFAULT_ALLOWED_DOMAINS = [
  "modelcontextprotocol.io",
  "developers.openai.com",
  "community.openai.com",
  "raw.githubusercontent.com",
  "github.com",
  "api.github.com",
  "registry.npmjs.org",
  "pypi.org",
  "files.pythonhosted.org",
];

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_MAX_BYTES = 256 * 1024;
const MAX_REDIRECTS = 3;

const TEXT_CONTENT_TYPE_RE = /^(text\/|application\/(json|ld\+json|xml|xhtml\+xml|javascript|typescript)|image\/svg\+xml)/i;

function sha256(value) {
  return crypto.createHash("sha256").update(String(value ?? ""), "utf8").digest("hex");
}

function getAllowedDomains() {
  const raw = process.env.MCP_TEST_NET_ALLOWLIST;
  if (!raw || !String(raw).trim()) {
    return DEFAULT_ALLOWED_DOMAINS;
  }
  return String(raw)
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function getTimeoutMs() {
  const parsed = Number(process.env.MCP_TEST_NET_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  if (!Number.isInteger(parsed) || parsed < 1000 || parsed > 30000) {
    return DEFAULT_TIMEOUT_MS;
  }
  return parsed;
}

function getMaxBytes() {
  const parsed = Number(process.env.MCP_TEST_NET_MAX_BYTES || DEFAULT_MAX_BYTES);
  if (!Number.isInteger(parsed) || parsed < 1024 || parsed > 2 * 1024 * 1024) {
    return DEFAULT_MAX_BYTES;
  }
  return parsed;
}

function normalizeUrl(input) {
  const raw = String(input || "").trim();
  if (!raw || raw.length > 4096) {
    throw new Error("URL is required and must be <= 4096 characters.");
  }
  const parsed = new URL(raw);
  parsed.hash = "";
  if (parsed.protocol !== "https:") {
    throw new Error("Only HTTPS URLs are allowed.");
  }
  if (parsed.username || parsed.password) {
    throw new Error("URL credentials are not allowed.");
  }
  if (!parsed.hostname) {
    throw new Error("URL hostname is required.");
  }
  parsed.hostname = parsed.hostname.toLowerCase();
  return parsed;
}

function isAllowedDomain(hostname, allowedDomains = getAllowedDomains()) {
  const host = String(hostname || "").toLowerCase();
  return allowedDomains.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

function isPrivateIPv4(ip) {
  const parts = ip.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

function isPrivateIPv6(ip) {
  const lower = String(ip || "").toLowerCase();
  return (
    lower === "::1" ||
    lower === "::" ||
    lower.startsWith("fc") ||
    lower.startsWith("fd") ||
    lower.startsWith("fe80") ||
    lower.startsWith("ff")
  );
}

function isBlockedIp(ip) {
  const kind = net.isIP(ip);
  if (kind === 4) return isPrivateIPv4(ip);
  if (kind === 6) return isPrivateIPv6(ip);
  return true;
}

async function assertResolvedPublic(hostname) {
  if (net.isIP(hostname)) {
    if (isBlockedIp(hostname)) {
      throw new Error("Target resolves to a blocked IP range.");
    }
    return [{ address: hostname, family: net.isIP(hostname) }];
  }

  const lower = String(hostname || "").toLowerCase();
  if (
    lower === "localhost" ||
    lower.endsWith(".localhost") ||
    lower.endsWith(".local") ||
    lower.endsWith(".internal") ||
    lower.endsWith(".lan") ||
    lower.endsWith(".home.arpa")
  ) {
    throw new Error("Local/internal hostnames are blocked.");
  }

  const records = await dns.lookup(hostname, { all: true, verbatim: false });
  if (!records.length) {
    throw new Error("DNS lookup returned no records.");
  }
  for (const record of records) {
    if (isBlockedIp(record.address)) {
      throw new Error("Target resolves to a blocked IP range.");
    }
  }
  return records;
}

async function assertAllowedUrl(input) {
  const parsed = normalizeUrl(input);
  if (!isAllowedDomain(parsed.hostname)) {
    throw new Error(`Domain is not allowlisted: ${parsed.hostname}`);
  }
  const resolved = await assertResolvedPublic(parsed.hostname);
  return {
    url: parsed.toString(),
    origin: parsed.origin,
    hostname: parsed.hostname,
    path: `${parsed.pathname}${parsed.search}`,
    allowed_domains: getAllowedDomains(),
    resolved_count: resolved.length,
  };
}

function isTextContentType(contentType) {
  return TEXT_CONTENT_TYPE_RE.test(String(contentType || "").split(";")[0].trim());
}

function makeBlockedOutput(url, message) {
  const raw = String(url || "");
  let origin = "";
  try {
    origin = new URL(raw).origin;
  } catch {
    origin = "";
  }
  return {
    success: false,
    url: raw,
    final_url: "",
    origin,
    status: 0,
    ok: false,
    content_type: "",
    bytes: 0,
    truncated: false,
    duration_ms: 0,
    sha256: "",
    text: "",
    error: String(message || "Blocked by network policy."),
  };
}

async function fetchAllowlisted(inputUrl, options = {}) {
  const startedAt = Date.now();
  const method = options.method === "HEAD" ? "HEAD" : "GET";
  const wantText = Boolean(options.wantText);
  const requireText = Boolean(options.requireText);
  const maxBytes = Number(options.maxBytes || getMaxBytes());
  const timeoutMs = Number(options.timeoutMs || getTimeoutMs());
  let currentUrl = inputUrl;
  let redirects = 0;

  while (true) {
    const allowed = await assertAllowedUrl(currentUrl);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response;
    try {
      response = await fetch(allowed.url, {
        method,
        redirect: "manual",
        headers: {
          "user-agent": "mcp-tests-controlled-network/1.0",
          accept: "text/plain, text/markdown, text/html, application/json, application/xml, */*;q=0.1",
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    const status = response.status;
    const location = response.headers.get("location");

    if ([301, 302, 303, 307, 308].includes(status) && location) {
      redirects += 1;
      if (redirects > MAX_REDIRECTS) {
        throw new Error("Too many redirects.");
      }
      currentUrl = new URL(location, allowed.url).toString();
      continue;
    }

    const contentType = response.headers.get("content-type") || "";
    const output = {
      success: true,
      url: String(inputUrl || ""),
      final_url: response.url || allowed.url,
      origin: allowed.origin,
      status,
      ok: response.ok,
      content_type: contentType,
      bytes: 0,
      truncated: false,
      duration_ms: Date.now() - startedAt,
      sha256: "",
      text: "",
      error: "",
    };

    if (method === "HEAD" || !wantText) {
      return output;
    }

    if (requireText && !isTextContentType(contentType)) {
      throw new Error(`Content-Type is not allowed for text fetch: ${contentType || "unknown"}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    output.bytes = buffer.length;
    output.truncated = buffer.length > maxBytes;
    const bounded = output.truncated ? buffer.subarray(0, maxBytes) : buffer;
    output.sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
    output.text = bounded.toString("utf8");
    output.duration_ms = Date.now() - startedAt;
    return output;
  }
}

function summarizeUrlArg(args = {}) {
  const url = String(args.url || args.package || "");
  let origin = "";
  try {
    origin = new URL(url).origin;
  } catch {
    origin = "";
  }
  return {
    arg_name: args.url ? "url" : "package",
    url_sha256: sha256(url),
    url_length_chars: url.length,
    origin,
  };
}

function networkResultStats(output = {}) {
  return {
    result_count: output.success ? 1 : 0,
    result_chars: String(output.text || "").length,
    result_success: Boolean(output.success),
    result_status: Number(output.status) || 0,
    result_bytes: Number(output.bytes) || 0,
    result_truncated: Boolean(output.truncated),
    result_content_type: output.content_type || "",
  };
}

module.exports = {
  DEFAULT_ALLOWED_DOMAINS,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_MAX_BYTES,
  assertAllowedUrl,
  fetchAllowlisted,
  getAllowedDomains,
  getMaxBytes,
  getTimeoutMs,
  isAllowedDomain,
  isBlockedIp,
  isTextContentType,
  makeBlockedOutput,
  networkResultStats,
  sha256,
  summarizeUrlArg,
};

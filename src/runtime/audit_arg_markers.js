function classifySensitiveMarkers(value) {
  const text = String(value ?? "");
  const lower = text.toLowerCase();

  return {
    has_mcp: /\bmcp\b/i.test(text),
    has_token: /token/i.test(text),
    has_localhost: lower.includes("localhost"),
    has_loopback: lower.includes("127.0.0.1") || lower.includes("::1"),
    has_bearer: /\bbearer\b/i.test(text),
    has_authorization: /authorization/i.test(text),
    has_secret: /secret/i.test(text),
    has_key: /\bkey\b/i.test(text) || /api[_-]?key/i.test(text),
    has_password: /password/i.test(text) || /\bpwd\b/i.test(text),
  };
}

module.exports = {
  classifySensitiveMarkers,
};

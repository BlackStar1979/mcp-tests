const assert = require("node:assert/strict");
const { DEFAULT_ALLOWED_DOMAINS, isAllowedDomain, summarizeUrlArg } = require("../src/util/network_policy");

assert.ok(DEFAULT_ALLOWED_DOMAINS.includes("community.openai.com"));
assert.equal(isAllowedDomain("community.openai.com"), true);
assert.equal(isAllowedDomain("www.community.openai.com"), true);
assert.equal(isAllowedDomain("evilcommunity.openai.com.example.org"), false);

const summary = summarizeUrlArg({ url: "https://community.openai.com/t/example/123" });
assert.equal(summary.arg_name, "url");
assert.equal(summary.origin, "https://community.openai.com");
assert.equal(typeof summary.url_sha256, "string");
assert.equal(summary.url_length_chars, "https://community.openai.com/t/example/123".length);

console.log("smoke_network_allowlist_workflow ok");

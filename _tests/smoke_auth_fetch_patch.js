"use strict";

const raw = process.env.MCP_TEST_SMOKE_HEADERS_JSON || "";
const target = process.env.MCP_TEST_SMOKE_URL || "";
let extra = {};
try { extra = raw ? JSON.parse(raw) : {}; } catch { extra = {}; }

if (target && Object.keys(extra).length > 0 && typeof globalThis.fetch === "function") {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = function patchedSmokeFetch(input, init = undefined) {
    let url = "";
    if (typeof input === "string") url = input;
    else if (input && typeof input.url === "string") url = input.url;

    if (!url.startsWith(target)) {
      return originalFetch(input, init);
    }

    const nextInit = { ...(init || {}) };
    const headers = new Headers(nextInit.headers || (input && input.headers) || undefined);
    for (const [key, value] of Object.entries(extra)) {
      if (!headers.has(key)) headers.set(key, String(value));
    }
    nextInit.headers = headers;
    return originalFetch(input, nextInit);
  };
}

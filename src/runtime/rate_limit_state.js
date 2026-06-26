"use strict";

const fs = require("node:fs");
const path = require("node:path");

function nowMs() { return Date.now(); }

function createMemoryRateLimitStore() {
  const data = new Map();
  return {
    get(key) { return Array.isArray(data.get(key)) ? data.get(key).slice() : []; },
    set(key, value) { data.set(key, Array.isArray(value) ? value.slice() : []); },
    snapshot() { return Object.fromEntries(Array.from(data.entries()).map(([k, v]) => [k, v.slice()])); },
  };
}

function createJsonFileRateLimitStore(filePath) {
  function readAll() {
    try {
      if (!fs.existsSync(filePath)) return {};
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_) {
      return {};
    }
  }
  function writeAll(all) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(all, null, 2) + "\n");
  }
  return {
    get(key) {
      const all = readAll();
      return Array.isArray(all[key]) ? all[key].slice() : [];
    },
    set(key, value) {
      const all = readAll();
      all[key] = Array.isArray(value) ? value.slice() : [];
      writeAll(all);
    },
    snapshot() { return readAll(); },
  };
}

function createSlidingWindowLimiter({ store = createMemoryRateLimitStore(), clock = nowMs } = {}) {
  function checkAndRecord({ key, limit, windowMs, cost = 1 }) {
    const now = Number(clock());
    const safeLimit = Number(limit);
    const safeWindow = Number(windowMs);
    const safeCost = Math.max(1, Number(cost) || 1);
    if (!Number.isInteger(safeLimit) || safeLimit < 1) return { allow: true, disabled: true, reason: "invalid_limit_disabled" };
    if (!Number.isInteger(safeWindow) || safeWindow < 1) return { allow: true, disabled: true, reason: "invalid_window_disabled" };
    const cutoff = now - safeWindow;
    const current = store.get(key).filter((entry) => Number(entry) > cutoff);
    if (current.length + safeCost > safeLimit) {
      const oldest = current.length ? Math.min(...current) : now;
      return {
        allow: false,
        key,
        limit: safeLimit,
        window_ms: safeWindow,
        remaining: Math.max(0, safeLimit - current.length),
        retry_after_ms: Math.max(1, safeWindow - (now - oldest)),
      };
    }
    for (let i = 0; i < safeCost; i += 1) current.push(now);
    store.set(key, current);
    return { allow: true, key, limit: safeLimit, window_ms: safeWindow, remaining: Math.max(0, safeLimit - current.length) };
  }
  return { checkAndRecord, store };
}

module.exports = { createMemoryRateLimitStore, createJsonFileRateLimitStore, createSlidingWindowLimiter };

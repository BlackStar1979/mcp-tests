"use strict";

const { randomBytes: cryptoRandomBytes } = require("node:crypto");

const TRACEPARENT_META_KEY = "traceparent";
const TRACESTATE_META_KEY = "tracestate";
const BAGGAGE_META_KEY = "baggage";
const TRACEPARENT_MAX_CHARS = 1024;
const TRACESTATE_MAX_CHARS = 512;
const TRACESTATE_MAX_MEMBERS = 32;
const BAGGAGE_MAX_BYTES = 8192;
const BAGGAGE_MAX_MEMBERS = 64;
const ZERO_TRACE_ID = "0".repeat(32);
const ZERO_SPAN_ID = "0".repeat(16);
const LOWER_HEX = /^[0-9a-f]+$/;
const TRACESTATE_KEY = /^[a-z0-9][a-z0-9_\-*/@]{0,255}$/;
const BAGGAGE_KEY = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

function generateNonZeroHex(byteLength, randomBytes = cryptoRandomBytes) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const value = Buffer.from(randomBytes(byteLength)).toString("hex");
    if (value.length === byteLength * 2 && !/^0+$/.test(value)) return value;
  }
  throw new Error("Trace identifier generator returned invalid zero/length output.");
}

function parseTraceparent(value) {
  if (typeof value !== "string" || value.length === 0) {
    return { ok: false, reason: "traceparent_format" };
  }
  if (value.length > TRACEPARENT_MAX_CHARS) {
    return { ok: false, reason: "traceparent_oversized" };
  }
  if (value.length < 55 || value[2] !== "-" || value[35] !== "-" || value[52] !== "-") {
    return { ok: false, reason: "traceparent_format" };
  }

  const version = value.slice(0, 2);
  const traceId = value.slice(3, 35);
  const parentSpanId = value.slice(36, 52);
  const traceFlags = value.slice(53, 55);
  if (![version, traceId, parentSpanId, traceFlags].every((part) => LOWER_HEX.test(part))) {
    return { ok: false, reason: "traceparent_format" };
  }
  if (version === "ff") return { ok: false, reason: "traceparent_version_ff" };
  if (version === "00" && value.length !== 55) {
    return { ok: false, reason: "traceparent_v00_length" };
  }
  if (version !== "00" && value.length > 55 && value[55] !== "-") {
    return { ok: false, reason: "traceparent_future_version_format" };
  }
  if (traceId === ZERO_TRACE_ID) return { ok: false, reason: "trace_id_all_zero" };
  if (parentSpanId === ZERO_SPAN_ID) return { ok: false, reason: "parent_span_id_all_zero" };

  return {
    ok: true,
    version,
    traceId,
    parentSpanId,
    traceFlags,
    sampled: (Number.parseInt(traceFlags, 16) & 0x01) === 0x01,
  };
}

function validateTracestate(value) {
  if (value === undefined || value === null) return { valid: true, value: null, reason: null };
  if (typeof value !== "string") return { valid: false, value: null, reason: "tracestate_type" };
  if (value.length > TRACESTATE_MAX_CHARS) {
    return { valid: false, value: null, reason: "tracestate_oversized" };
  }
  if (!/^[\x20-\x7e]*$/.test(value)) {
    return { valid: false, value: null, reason: "tracestate_characters" };
  }

  const rawMembers = value.split(",");
  if (rawMembers.length > TRACESTATE_MAX_MEMBERS) {
    return { valid: false, value: null, reason: "tracestate_member_limit" };
  }
  const seen = new Set();
  for (const rawMember of rawMembers) {
    const member = rawMember.trim();
    if (!member) continue;
    const separator = member.indexOf("=");
    if (separator <= 0) return { valid: false, value: null, reason: "tracestate_member_format" };
    const key = member.slice(0, separator);
    const opaque = member.slice(separator + 1);
    if (!TRACESTATE_KEY.test(key)) return { valid: false, value: null, reason: "tracestate_key" };
    if (seen.has(key)) return { valid: false, value: null, reason: "tracestate_duplicate_key" };
    seen.add(key);
    if (opaque.length === 0 || opaque.length > 256 || /[,=\t\r\n]/.test(opaque) || opaque.endsWith(" ")) {
      return { valid: false, value: null, reason: "tracestate_value" };
    }
  }
  return { valid: true, value, reason: null };
}

function validateBaggage(value) {
  if (value === undefined || value === null) {
    return { present: false, valid: true, bytes: 0, memberCount: 0, reason: null };
  }
  if (typeof value !== "string") {
    return { present: true, valid: false, bytes: 0, memberCount: 0, reason: "baggage_type" };
  }
  const bytes = Buffer.byteLength(value, "utf8");
  const members = value.split(",");
  if (bytes > BAGGAGE_MAX_BYTES) {
    return { present: true, valid: false, bytes, memberCount: members.length, reason: "baggage_oversized" };
  }
  if (members.length > BAGGAGE_MAX_MEMBERS) {
    return { present: true, valid: false, bytes, memberCount: members.length, reason: "baggage_member_limit" };
  }
  for (const rawMember of members) {
    const member = rawMember.trim();
    const separator = member.indexOf("=");
    if (separator <= 0) {
      return { present: true, valid: false, bytes, memberCount: members.length, reason: "baggage_member_format" };
    }
    const key = member.slice(0, separator).trim();
    if (!BAGGAGE_KEY.test(key)) {
      return { present: true, valid: false, bytes, memberCount: members.length, reason: "baggage_key" };
    }
  }
  return { present: true, valid: true, bytes, memberCount: members.length, reason: null };
}

function resolveTraceContext(meta = {}, dependencies = {}) {
  const randomBytes = dependencies.randomBytes || cryptoRandomBytes;
  const hasTraceparent = Object.prototype.hasOwnProperty.call(meta, TRACEPARENT_META_KEY);
  const parsed = hasTraceparent
    ? parseTraceparent(meta[TRACEPARENT_META_KEY])
    : { ok: false, reason: null };
  const baggage = validateBaggage(meta[BAGGAGE_META_KEY]);

  if (!parsed.ok) {
    return {
      traceId: generateNonZeroHex(16, randomBytes),
      spanId: generateNonZeroHex(8, randomBytes),
      parentSpanId: null,
      traceFlags: "00",
      sampled: false,
      source: hasTraceparent ? "invalid_generated" : "generated",
      invalidReason: hasTraceparent ? parsed.reason : null,
      tracestate: null,
      tracestateValid: !Object.prototype.hasOwnProperty.call(meta, TRACESTATE_META_KEY),
      tracestateInvalidReason: Object.prototype.hasOwnProperty.call(meta, TRACESTATE_META_KEY)
        ? (hasTraceparent ? "tracestate_discarded_with_invalid_traceparent" : "tracestate_without_traceparent")
        : null,
      baggagePresent: baggage.present,
      baggageValid: baggage.valid,
      baggageBytes: baggage.bytes,
      baggageMemberCount: baggage.memberCount,
      baggageInvalidReason: baggage.reason,
    };
  }

  const tracestate = validateTracestate(meta[TRACESTATE_META_KEY]);
  return {
    traceId: parsed.traceId,
    spanId: generateNonZeroHex(8, randomBytes),
    parentSpanId: parsed.parentSpanId,
    traceFlags: parsed.traceFlags,
    sampled: parsed.sampled,
    source: "incoming",
    invalidReason: null,
    tracestate: tracestate.valid ? tracestate.value : null,
    tracestateValid: tracestate.valid,
    tracestateInvalidReason: tracestate.reason,
    baggagePresent: baggage.present,
    baggageValid: baggage.valid,
    baggageBytes: baggage.bytes,
    baggageMemberCount: baggage.memberCount,
    baggageInvalidReason: baggage.reason,
  };
}

function createChildTraceContext(parent = {}, dependencies = {}) {
  const randomBytes = dependencies.randomBytes || cryptoRandomBytes;
  if (!/^[0-9a-f]{32}$/.test(String(parent.traceId || "")) || parent.traceId === ZERO_TRACE_ID) {
    return resolveTraceContext({}, { randomBytes });
  }
  return {
    traceId: parent.traceId,
    spanId: generateNonZeroHex(8, randomBytes),
    parentSpanId: /^[0-9a-f]{16}$/.test(String(parent.spanId || "")) ? parent.spanId : null,
    traceFlags: /^[0-9a-f]{2}$/.test(String(parent.traceFlags || "")) ? parent.traceFlags : "00",
    sampled: parent.sampled === true,
    source: "internal_child",
    invalidReason: null,
    tracestate: typeof parent.tracestate === "string" ? parent.tracestate : null,
    tracestateValid: parent.tracestateValid !== false,
    tracestateInvalidReason: parent.tracestateInvalidReason || null,
    baggagePresent: parent.baggagePresent === true,
    baggageValid: parent.baggageValid !== false,
    baggageBytes: Math.max(0, Number(parent.baggageBytes || 0)),
    baggageMemberCount: Math.max(0, Number(parent.baggageMemberCount || 0)),
    baggageInvalidReason: parent.baggageInvalidReason || null,
  };
}

function traceAuditFields(traceContext = {}) {
  return {
    trace_id: traceContext.traceId || null,
    span_id: traceContext.spanId || null,
    parent_span_id: traceContext.parentSpanId || null,
    trace_flags: traceContext.traceFlags || "00",
    trace_sampled: traceContext.sampled === true,
    trace_source: traceContext.source || "unknown",
    trace_context_invalid_reason: traceContext.invalidReason || null,
    tracestate_valid: traceContext.tracestateValid !== false,
    tracestate_invalid_reason: traceContext.tracestateInvalidReason || null,
    baggage_present: traceContext.baggagePresent === true,
    baggage_valid: traceContext.baggageValid !== false,
    baggage_bytes: Math.max(0, Number(traceContext.baggageBytes || 0)),
    baggage_member_count: Math.max(0, Number(traceContext.baggageMemberCount || 0)),
    baggage_invalid_reason: traceContext.baggageInvalidReason || null,
  };
}

module.exports = {
  BAGGAGE_MAX_BYTES,
  BAGGAGE_MAX_MEMBERS,
  BAGGAGE_META_KEY,
  TRACEPARENT_META_KEY,
  TRACEPARENT_MAX_CHARS,
  TRACESTATE_MAX_CHARS,
  TRACESTATE_MAX_MEMBERS,
  TRACESTATE_META_KEY,
  createChildTraceContext,
  parseTraceparent,
  resolveTraceContext,
  traceAuditFields,
  validateBaggage,
  validateTracestate,
};

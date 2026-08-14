"use strict";

const assert = require("node:assert/strict");
const {
  BAGGAGE_META_KEY,
  TRACEPARENT_META_KEY,
  TRACESTATE_META_KEY,
  createChildTraceContext,
  resolveTraceContext,
  traceAuditFields,
} = require("../src/runtime/trace_context");

function deterministicBytes(length, byte) {
  return Buffer.alloc(length, byte);
}

(() => {
  assert.equal(TRACEPARENT_META_KEY, "traceparent");
  assert.equal(TRACESTATE_META_KEY, "tracestate");
  assert.equal(BAGGAGE_META_KEY, "baggage");

  const incoming = resolveTraceContext({
    traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
    tracestate: "vendor=value",
    baggage: "account=secret-value,region=eu",
  }, { randomBytes: (length) => deterministicBytes(length, 0x12) });
  assert.equal(incoming.source, "incoming");
  assert.equal(incoming.traceId, "4bf92f3577b34da6a3ce929d0e0e4736");
  assert.equal(incoming.parentSpanId, "00f067aa0ba902b7");
  assert.equal(incoming.spanId, "1212121212121212");
  assert.equal(incoming.traceFlags, "01");
  assert.equal(incoming.sampled, true);
  assert.equal(incoming.tracestate, "vendor=value");
  assert.equal(incoming.baggagePresent, true);
  assert.equal(Object.hasOwn(incoming, "baggage"), false);

  const audit = traceAuditFields(incoming);
  assert.equal(audit.trace_id, incoming.traceId);
  assert.equal(audit.span_id, incoming.spanId);
  assert.equal(audit.parent_span_id, incoming.parentSpanId);
  assert.equal(audit.trace_source, "incoming");
  assert.equal(audit.trace_sampled, true);
  assert.equal(audit.baggage_present, true);
  assert.equal(JSON.stringify(audit).includes("secret-value"), false);

  const child = createChildTraceContext(incoming, { randomBytes: (length) => deterministicBytes(length, 0x34) });
  assert.equal(child.traceId, incoming.traceId);
  assert.equal(child.parentSpanId, incoming.spanId);
  assert.equal(child.spanId, "3434343434343434");
  assert.equal(child.traceFlags, incoming.traceFlags);
  assert.equal(child.source, "internal_child");
  assert.equal(child.tracestate, incoming.tracestate);

  const generated = resolveTraceContext({}, { randomBytes: (length) => deterministicBytes(length, 0x56) });
  assert.equal(generated.source, "generated");
  assert.equal(generated.traceId, "56565656565656565656565656565656");
  assert.equal(generated.spanId, "5656565656565656");
  assert.equal(generated.parentSpanId, null);
  assert.equal(generated.traceFlags, "00");

  const invalid = resolveTraceContext({
    traceparent: "00-00000000000000000000000000000000-00f067aa0ba902b7-01",
    tracestate: "vendor=value",
    baggage: "token=must-not-survive",
  }, { randomBytes: (length) => deterministicBytes(length, 0x78) });
  assert.equal(invalid.source, "invalid_generated");
  assert.equal(invalid.invalidReason, "trace_id_all_zero");
  assert.equal(invalid.traceId, "78787878787878787878787878787878");
  assert.equal(invalid.tracestate, null);
  assert.equal(Object.hasOwn(invalid, "baggage"), false);

  const uppercase = resolveTraceContext({
    traceparent: "00-4BF92F3577B34DA6A3CE929D0E0E4736-00f067aa0ba902b7-01",
  }, { randomBytes: (length) => deterministicBytes(length, 0x79) });
  assert.equal(uppercase.source, "invalid_generated");
  assert.equal(uppercase.invalidReason, "traceparent_format");

  const oversizedState = resolveTraceContext({
    traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
    tracestate: `vendor=${"x".repeat(600)}`,
  }, { randomBytes: (length) => deterministicBytes(length, 0x80) });
  assert.equal(oversizedState.source, "incoming");
  assert.equal(oversizedState.tracestate, null);
  assert.equal(oversizedState.tracestateValid, false);

  const oversizedBaggage = resolveTraceContext({
    traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
    baggage: `opaque=${"x".repeat(9000)}`,
  }, { randomBytes: (length) => deterministicBytes(length, 0x81) });
  assert.equal(oversizedBaggage.baggagePresent, true);
  assert.equal(oversizedBaggage.baggageValid, false);
  assert.equal(Object.hasOwn(oversizedBaggage, "baggage"), false);

  console.log("smoke_w3c_trace_context ok");
})();

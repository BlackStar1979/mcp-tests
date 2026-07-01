"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { evaluateToolSurfaceState } = require("../../src/tool_surface_state");
const { createToolsListChangedNotifier } = require("../../src/runtime/tools_list_changed_emitter");
const { McpSession } = require("../../src/runtime/session");
const { handleMcpGetStream } = require("../../src/runtime/mcp_get_stream_handler");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-tests-surface-state-"));
const stateFile = path.join(tmp, "tool-surface-state.json");
const now = () => "2026-06-27T16:00:00.000Z";
const surfaceA = { tool_count: 2, tool_names_hash: "names-a", input_schema_fingerprint: "in-a", output_schema_fingerprint: "out-a", descriptor_fingerprint: "desc-a", combined_fingerprint: "combined-a" };
const surfaceB = { ...surfaceA, output_schema_fingerprint: "out-b", descriptor_fingerprint: "desc-b", combined_fingerprint: "combined-b" };
function auditSink(){ const events=[]; return { events, auditLog(event,data){ events.push({event,data}); } }; }

const firstAudit = auditSink();
const first = evaluateToolSurfaceState({ stateFile, currentSurface: surfaceA, serverStartId: "start-1", auditLog: firstAudit.auditLog, now });
assert.equal(first.had_previous, false);
assert.equal(first.surface_changed_since_last_start, false);
assert.ok(firstAudit.events.some((x) => x.event === "tool_surface"+"_state_missing"));
assert.ok(firstAudit.events.some((x) => x.event === "tool_surface"+"_state_saved"));
assert.equal(JSON.parse(fs.readFileSync(stateFile, "utf8")).current_surface.combined_fingerprint, "combined-a");

const sameAudit = auditSink();
const same = evaluateToolSurfaceState({ stateFile, currentSurface: surfaceA, serverStartId: "start-2", auditLog: sameAudit.auditLog, now });
assert.equal(same.had_previous, true);
assert.equal(same.surface_changed_since_last_start, false);
assert.ok(sameAudit.events.some((x) => x.event === "tool_surface"+"_state_loaded"));

const changedAudit = auditSink();
const changed = evaluateToolSurfaceState({ stateFile, currentSurface: surfaceB, serverStartId: "start-3", auditLog: changedAudit.auditLog, now });
assert.equal(changed.had_previous, true);
assert.equal(changed.surface_changed_since_last_start, true);
assert.equal(changed.previous_surface.combined_fingerprint, "combined-a");
assert.equal(changed.current_surface.combined_fingerprint, "combined-b");
assert.ok(changedAudit.events.some((x) => x.event === "tool_surface"+"_changed"));

const notifierAudit = auditSink();
const notifier = createToolsListChangedNotifier({ state: changed, serverStartId: "start-3" });
assert.equal(notifier.enabled, true);
assert.equal(notifier.pending, true);
const fakeSession = { id: "session-a", sent: [], enqueueOutbound(event){ this.sent.push(String(event)); } };
const emitted = notifier.emitToSession({ session: fakeSession, auditLog: notifierAudit.auditLog, requestId: "stream-1" });
assert.equal(emitted.emitted, true);
assert.ok(fakeSession.sent.join("\n").includes("notifications/"+"tools/list_changed"));
assert.ok(notifierAudit.events.some((x) => x.event === "tools_list"+"_changed_emitted"));
const second = notifier.emitToSession({ session: fakeSession, auditLog: notifierAudit.auditLog, requestId: "stream-2" });
assert.equal(second.emitted, false);
assert.equal(second.reason, "session_already_notified");

function response(){ return { statusCode: null, headers: {}, chunks: [], writeHead(code, headers){ this.statusCode = code; this.headers = headers || {}; }, write(chunk){ this.chunks.push(String(chunk)); }, end(chunk){ if(chunk) this.chunks.push(String(chunk)); }, body(){ return this.chunks.join(""); } }; }
const streamAudit = auditSink();
const session = new McpSession({ id: "session-stream", protocolVersion: "2025-06-18" });
const store = { get(id){ return id === session.id ? session : null; } };
const req = { headers: {}, on(){ return this; } };
const res = response();
handleMcpGetStream({ req, res, requestId: "get-1", sessionId: session.id, sessionStore: store, auditLog: streamAudit.auditLog, keepaliveIntervalMs: 0, listChangedNotifier: createToolsListChangedNotifier({ state: changed, serverStartId: "start-3" }) });
assert.equal(res.statusCode, 200);
assert.ok(res.body().includes("notifications/stream/ready"));
assert.ok(res.body().includes("notifications/"+"tools/list_changed"));
assert.ok(streamAudit.events.some((x) => x.event === "tools_list"+"_changed_emitted"));
fs.rmSync(tmp, { recursive: true, force: true });
console.log("smoke_tools_list_changed_runtime ok");

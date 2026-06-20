"use strict";

const DEFAULT_MAX_REPLAY_EVENTS = 100;

function parseSseId(event) {
  const match = String(event || "").match(/^id:\s*(\d+)\s*$/m);
  return match ? Number(match[1]) : null;
}

class McpSession {
  constructor({ id, protocolVersion, clientCapabilities = {}, createdAt = Date.now(), ttlMs = 30 * 60 * 1000, maxReplayEvents = DEFAULT_MAX_REPLAY_EVENTS } = {}) {
    if (!id) throw new Error("Session id is required");
    this.id = id;
    this.protocolVersion = protocolVersion;
    this.clientCapabilities = clientCapabilities && typeof clientCapabilities === "object" ? clientCapabilities : {};
    this.createdAt = createdAt;
    this.lastSeen = createdAt;
    this.ttlMs = ttlMs;
    this.sseRes = null;
    this.outboundQueue = [];
    this.pending = new Map();
    this.nextSseEventId = 0;
    this.replayBuffer = [];
    this.maxReplayEvents = maxReplayEvents;
  }

  touch(now = Date.now()) {
    this.lastSeen = now;
  }

  isExpired(now = Date.now()) {
    return now - this.lastSeen > this.ttlMs;
  }

  stampSseEvent(event) {
    const existingId = parseSseId(event);
    if (existingId !== null) {
      this.nextSseEventId = Math.max(this.nextSseEventId, existingId);
      return { id: existingId, event: String(event) };
    }
    this.nextSseEventId += 1;
    return { id: this.nextSseEventId, event: `id: ${this.nextSseEventId}\n${String(event)}` };
  }

  rememberReplayEvent(id, event) {
    this.replayBuffer.push({ id, event });
    while (this.replayBuffer.length > this.maxReplayEvents) {
      this.replayBuffer.shift();
    }
  }

  attachStream(res, { lastEventId } = {}) {
    this.sseRes = res;
    this.replaySince(lastEventId);
    this.flushOutboundQueue();
  }

  detachStream(res) {
    if (!res || this.sseRes === res) {
      this.sseRes = null;
    }
  }

  enqueueOutbound(event) {
    const stamped = this.stampSseEvent(event);
    this.outboundQueue.push(stamped);
    this.flushOutboundQueue();
  }

  flushOutboundQueue() {
    if (!this.sseRes || typeof this.sseRes.write !== "function") return 0;
    let flushed = 0;
    while (this.outboundQueue.length > 0) {
      const item = this.outboundQueue.shift();
      const stamped = typeof item === "string" ? this.stampSseEvent(item) : item;
      this.sseRes.write(stamped.event);
      this.rememberReplayEvent(stamped.id, stamped.event);
      flushed += 1;
    }
    return flushed;
  }

  validateReplayRequest(lastEventId) {
    if (lastEventId === undefined || lastEventId === null || lastEventId === "") return { ok: true };
    const parsed = Number(lastEventId);
    if (!Number.isInteger(parsed) || parsed < 0) {
      return { ok: false, status: 400, reason: "invalid_last_event_id" };
    }
    if (parsed > this.nextSseEventId) {
      return { ok: false, status: 409, reason: "future_last_event_id", lastEventId: parsed, nextEventId: this.nextSseEventId };
    }
    if (this.replayBuffer.length === 0) {
      if (this.nextSseEventId > 0 && parsed < this.nextSseEventId) {
        return { ok: false, status: 409, reason: "replay_buffer_expired", lastEventId: parsed, nextEventId: this.nextSseEventId };
      }
      return { ok: true, lastEventId: parsed };
    }
    const firstReplayId = this.replayBuffer[0].id;
    if (parsed < firstReplayId - 1) {
      return { ok: false, status: 409, reason: "replay_buffer_expired", lastEventId: parsed, firstReplayId };
    }
    return { ok: true, lastEventId: parsed };
  }

  replaySince(lastEventId) {
    if (!this.sseRes || typeof this.sseRes.write !== "function") return 0;
    if (lastEventId === undefined || lastEventId === null || lastEventId === "") return 0;
    const parsed = Number(lastEventId);
    if (!Number.isFinite(parsed)) return 0;
    let replayed = 0;
    for (const item of this.replayBuffer) {
      if (item.id > parsed) {
        this.sseRes.write(item.event);
        replayed += 1;
      }
    }
    return replayed;
  }

  toAuditSummary() {
    return {
      id: this.id,
      protocol_version: this.protocolVersion,
      has_sampling: Boolean(this.clientCapabilities?.sampling),
      outbound_queue_length: this.outboundQueue.length,
      replay_buffer_length: this.replayBuffer.length,
      pending_count: this.pending.size,
      next_sse_event_id: this.nextSseEventId,
    };
  }
}

module.exports = {
  DEFAULT_MAX_REPLAY_EVENTS,
  McpSession,
};

"use strict";

const {
  createStateHandleStore,
  extractAuthContext,
  hashValue,
  normalizeScopes,
  summarizeRecord,
} = require("./state_handle_prototype");
const {
  FORM_ELICITATION_REQUIRED_CAPABILITIES,
  MODERN_PROTOCOL_VERSION,
  clientSupportsFormElicitation,
} = require("./protocol_capability_registry");

const MRTR_STATE_KIND = "mrtr_tools_call_v1";
const DEFAULT_MRTR_TTL_MS = 120000;
const MAX_MRTR_TTL_MS = 10 * 60 * 1000;
const MAX_INPUT_REQUESTS = 8;
const MAX_INPUT_REQUEST_BYTES = 16 * 1024;
const MAX_BINDING_BYTES = 64 * 1024;
const MAX_CANONICAL_DEPTH = 32;
const MAX_CANONICAL_NODES = 4096;
const VALID_ELICIT_ACTIONS = new Set(["accept", "decline", "cancel"]);

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function canonicalJson(value, { maxBytes = MAX_BINDING_BYTES } = {}) {
  let nodes = 0;

  function walk(current, depth) {
    if (depth > MAX_CANONICAL_DEPTH) throw new Error("canonical_depth_exceeded");
    nodes += 1;
    if (nodes > MAX_CANONICAL_NODES) throw new Error("canonical_nodes_exceeded");

    if (current === null) return "null";
    if (typeof current === "string" || typeof current === "boolean") return JSON.stringify(current);
    if (typeof current === "number") {
      if (!Number.isFinite(current)) throw new Error("canonical_non_finite_number");
      return JSON.stringify(current);
    }
    if (Array.isArray(current)) {
      return `[${current.map((item) => walk(item, depth + 1)).join(",")}]`;
    }
    if (isPlainObject(current)) {
      const keys = Object.keys(current).sort();
      const parts = keys.map((key) => `${JSON.stringify(key)}:${walk(current[key], depth + 1)}`);
      return `{${parts.join(",")}}`;
    }
    throw new Error("canonical_non_json_value");
  }

  const text = walk(value, 0);
  if (Buffer.byteLength(text, "utf8") > maxBytes) throw new Error("canonical_bytes_exceeded");
  return text;
}

function digestJson(value, options) {
  return hashValue(canonicalJson(value, options));
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeAuthContext(value = {}) {
  return extractAuthContext(value, value);
}

function exactScopeDigest(authContext) {
  return hashValue(JSON.stringify(normalizeScopes(authContext.scopes || [])));
}

function denied(code, reason, audit = {}) {
  return {
    status: "denied",
    code: String(code || "mrtr_denied"),
    reason: String(reason || "mrtr_denied"),
    audit: {
      reason_code: String(reason || "mrtr_denied"),
      ...audit,
    },
  };
}

function validateInputRequests(inputRequests) {
  if (!isPlainObject(inputRequests)) return { ok: false, reason: "mrtr_input_requests_invalid" };
  const keys = Object.keys(inputRequests).sort();
  if (keys.length < 1 || keys.length > MAX_INPUT_REQUESTS) {
    return { ok: false, reason: "mrtr_input_request_count_invalid" };
  }

  try {
    canonicalJson(inputRequests, { maxBytes: MAX_INPUT_REQUEST_BYTES });
  } catch {
    return { ok: false, reason: "mrtr_input_requests_too_complex" };
  }

  for (const key of keys) {
    if (!/^[A-Za-z0-9_.-]{1,64}$/.test(key)) return { ok: false, reason: "mrtr_input_request_key_invalid" };
    const request = inputRequests[key];
    if (!isPlainObject(request)) return { ok: false, reason: "mrtr_input_request_invalid" };
    if (request.method !== "elicitation/create") {
      return { ok: false, reason: "mrtr_input_request_method_not_supported" };
    }
    const params = request.params;
    if (!isPlainObject(params) || params.mode !== "form") {
      return { ok: false, reason: "mrtr_input_request_form_required" };
    }
    if (typeof params.message !== "string" || params.message.length < 1 || params.message.length > 2000) {
      return { ok: false, reason: "mrtr_input_request_message_invalid" };
    }
    if (!isPlainObject(params.requestedSchema)) {
      return { ok: false, reason: "mrtr_input_request_schema_invalid" };
    }
  }

  return { ok: true, keys, value: cloneJson(inputRequests) };
}

function validateInputResponses(inputResponses, expectedKeys) {
  if (!isPlainObject(inputResponses)) return { ok: false, reason: "mrtr_input_responses_invalid" };
  const keys = Object.keys(inputResponses).sort();
  if (keys.length !== expectedKeys.length || keys.some((key, index) => key !== expectedKeys[index])) {
    return { ok: false, reason: "mrtr_input_response_keys_mismatch" };
  }

  for (const key of keys) {
    const response = inputResponses[key];
    if (!isPlainObject(response) || !VALID_ELICIT_ACTIONS.has(response.action)) {
      return { ok: false, reason: "mrtr_input_response_invalid" };
    }
    if (response.content !== undefined) {
      if (response.action !== "accept" || !isPlainObject(response.content)) {
        return { ok: false, reason: "mrtr_input_response_invalid" };
      }
      try {
        canonicalJson(response.content, { maxBytes: MAX_INPUT_REQUEST_BYTES });
      } catch {
        return { ok: false, reason: "mrtr_input_response_invalid" };
      }
    }
  }

  return { ok: true, value: cloneJson(inputResponses) };
}

function createMrtrExtension({
  now = () => Date.now(),
  ttlMs = DEFAULT_MRTR_TTL_MS,
  store,
} = {}) {
  const boundedTtlMs = Math.max(1000, Math.min(Number(ttlMs) || DEFAULT_MRTR_TTL_MS, MAX_MRTR_TTL_MS));
  const stateStore = store || createStateHandleStore({ now, maxRecords: 1000 });

  function bindingFor({ toolName, args, authContext, requirement }) {
    const safeAuth = normalizeAuthContext(authContext);
    return {
      safeAuth,
      tool_name: String(toolName || ""),
      arguments_sha256: digestJson(args || {}),
      scope_sha256: exactScopeDigest(safeAuth),
      requirement_sha256: digestJson(requirement),
    };
  }

  function evaluate({
    protocolVersion,
    toolName,
    args = {},
    authContext = {},
    requirement,
    clientCapabilities = {},
    requestState,
    inputResponses,
  } = {}) {
    if (!requirement) return { status: "not_required" };
    if (String(protocolVersion || "") !== MODERN_PROTOCOL_VERSION) {
      return denied("mrtr_protocol_error", "mrtr_protocol_not_supported", { protocol_version: String(protocolVersion || "") });
    }

    const statePresent = requestState !== undefined;
    const responsesPresent = inputResponses !== undefined;
    if (statePresent !== responsesPresent) {
      return denied("mrtr_retry_invalid", "mrtr_retry_fields_must_be_paired");
    }

    let binding;
    try {
      binding = bindingFor({ toolName, args, authContext, requirement });
    } catch {
      return denied("mrtr_binding_invalid", "mrtr_request_binding_invalid");
    }

    if (!statePresent) {
      const requests = validateInputRequests(requirement.inputRequests);
      if (!requests.ok) return denied("mrtr_requirement_invalid", requests.reason);
      if (!clientSupportsFormElicitation(clientCapabilities)) {
        return {
          status: "missing_client_capability",
          requiredCapabilities: cloneJson(FORM_ELICITATION_REQUIRED_CAPABILITIES),
          audit: { reason_code: "mrtr_form_elicitation_capability_missing" },
        };
      }
      const created = stateStore.create({
        kind: MRTR_STATE_KIND,
        ttlMs: boundedTtlMs,
        authContext: binding.safeAuth,
        payload: {
          state_version: 1,
          tool_name: binding.tool_name,
          arguments_sha256: binding.arguments_sha256,
          scope_sha256: binding.scope_sha256,
          requirement_sha256: binding.requirement_sha256,
          input_request_keys: requests.keys,
        },
      });
      const summary = summarizeRecord(created.record, now());
      return {
        status: "input_required",
        result: {
          resultType: "input_required",
          inputRequests: requests.value,
          requestState: created.handle,
        },
        audit: {
          reason_code: "mrtr_input_required",
          state_handle_sha256: created.record.handle_id_hash,
          requirement_sha256: binding.requirement_sha256,
          input_request_count: requests.keys.length,
          expires_at: summary.expires_at,
        },
      };
    }

    if (typeof requestState !== "string" || requestState.length < 24 || requestState.length > 512) {
      return denied("mrtr_state_invalid", "mrtr_request_state_invalid");
    }

    const read = stateStore.read({ handle: requestState, authContext: binding.safeAuth, kind: MRTR_STATE_KIND });
    if (!read.ok) {
      return denied("mrtr_state_invalid", read.reason, {
        state_handle_sha256: hashValue(requestState),
        ...(read.summary ? { state: read.summary } : {}),
      });
    }

    const payload = read.payload || {};
    if (
      payload.tool_name !== binding.tool_name ||
      payload.arguments_sha256 !== binding.arguments_sha256 ||
      payload.scope_sha256 !== binding.scope_sha256 ||
      payload.requirement_sha256 !== binding.requirement_sha256
    ) {
      const invalidated = stateStore.destroy({
        handle: requestState,
        authContext: binding.safeAuth,
        kind: MRTR_STATE_KIND,
      });
      if (!invalidated.ok) {
        return denied("mrtr_state_invalid", invalidated.reason, {
          state_handle_sha256: hashValue(requestState),
        });
      }
      return denied("mrtr_binding_invalid", "mrtr_request_binding_mismatch", {
        state_handle_sha256: invalidated.record.handle_id_hash,
      });
    }

    const consumed = stateStore.destroy({ handle: requestState, authContext: binding.safeAuth, kind: MRTR_STATE_KIND });
    if (!consumed.ok) {
      return denied("mrtr_state_invalid", consumed.reason, { state_handle_sha256: hashValue(requestState) });
    }

    const responses = validateInputResponses(inputResponses, Array.isArray(payload.input_request_keys) ? payload.input_request_keys : []);
    if (!responses.ok) {
      return denied("mrtr_response_invalid", responses.reason, {
        state_handle_sha256: consumed.record.handle_id_hash,
      });
    }

    return {
      status: "retry_ready",
      inputResponses: responses.value,
      audit: {
        reason_code: "mrtr_retry_accepted",
        state_handle_sha256: consumed.record.handle_id_hash,
        requirement_sha256: binding.requirement_sha256,
        input_request_count: payload.input_request_keys.length,
      },
    };
  }

  return {
    evaluate,
    size: () => stateStore.size(),
  };
}

module.exports = {
  DEFAULT_MRTR_TTL_MS,
  MAX_MRTR_TTL_MS,
  MRTR_STATE_KIND,
  createMrtrExtension,
};

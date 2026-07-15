"use strict";

function buildInitializeRetirementReadiness({
  currentServerStartId = "",
  observedEntryPath = "",
  initializeObservedForCurrentStart = false,
  serverDiscoverObservedForCurrentStart = false,
  followupTrafficWithoutFreshEntry = false,
  requestContract = {},
  currentInitializeResponseSuccessCount = 0,
  currentServerDiscoverResponseSuccessCount = 0,
}) {
  const base = {
    status: "insufficient_runtime_context",
    can_reopen_retirement_decision: false,
    explicit_authorization_still_required: true,
    evidence_freshness: currentServerStartId ? "current_server_start_window" : "unknown_current_server_start",
    blocker: "Current runtime slice does not yet provide decisive client entry-path evidence.",
    next_action: "Capture a fresh client reconnect on the current runtime before drawing initialize-retirement conclusions.",
  };

  if (!currentServerStartId) {
    return {
      ...base,
      status: "current_server_start_unknown",
      blocker: "Current server_start_id is missing, so the inspected audit slice cannot prove current entry behavior.",
      next_action: "Establish current runtime identity first, then capture a fresh client reconnect.",
    };
  }

  if (followupTrafficWithoutFreshEntry) {
    return {
      ...base,
      status: "stale_entry_window",
      blocker: "The current audit window contains follow-up traffic but no fresh initialize or server/discover entry event.",
      next_action: "Trigger a fresh reconnect and re-check the current server_start_id before revisiting initialize retirement.",
    };
  }

  if (observedEntryPath === "initialize_only" || (initializeObservedForCurrentStart && !serverDiscoverObservedForCurrentStart)) {
    return {
      ...base,
      status: "blocked_initialize_only_current_window",
      blocker: "Fresh current-window client traffic still enters through legacy initialize.",
      next_action: "Keep the compatibility shim in place and gather fresh server/discover entry evidence for the same client line.",
      initialize_response_success_count: currentInitializeResponseSuccessCount,
      server_discover_response_success_count: currentServerDiscoverResponseSuccessCount,
    };
  }

  if (observedEntryPath === "mixed_initialize_and_server_discover") {
    return {
      ...base,
      status: "mixed_current_window_hold",
      blocker: "The current window still includes legacy initialize traffic, even though server/discover is also observed.",
      next_action: "Separate client families or capture a fresh reconnect window that shows operationally relevant clients entering only through server/discover.",
      initialize_response_success_count: currentInitializeResponseSuccessCount,
      server_discover_response_success_count: currentServerDiscoverResponseSuccessCount,
    };
  }

  if (observedEntryPath === "server_discover_only" || (!initializeObservedForCurrentStart && serverDiscoverObservedForCurrentStart)) {
    return {
      ...base,
      status: "candidate_authorization_review",
      can_reopen_retirement_decision: true,
      blocker: "Fresh current-window entry evidence is now compatible with initialize retirement, but explicit authorization is still required before any removal.",
      next_action: requestContract.server_discover_supported === false
        ? "Do not act yet; reconcile request-contract support with the observed entry path first."
        : "Preserve this fresh server/discover-only evidence, confirm useful no-handshake flow on the same runtime, and only then prepare an authorization-backed retirement package.",
      initialize_response_success_count: currentInitializeResponseSuccessCount,
      server_discover_response_success_count: currentServerDiscoverResponseSuccessCount,
    };
  }

  return base;
}

function buildClientEntryPathDiagnostics(entries, runtimeStatus = {}) {
  const requestContract = runtimeStatus.request_contract || {};
  const currentServerStartId = String(runtimeStatus.server_start_id || "");
  let activeServerStartId = "";
  let activeServerStartTs = "";
  let lastServerStart = null;
  let lastInitialize = null;
  let lastServerDiscover = null;
  let currentInitializeCount = 0;
  let currentServerDiscoverCount = 0;
  let currentInitializeResponseCount = 0;
  let currentServerDiscoverResponseCount = 0;
  let currentInitializeResponseSuccessCount = 0;
  let currentInitializeResponseErrorCount = 0;
  let currentServerDiscoverResponseSuccessCount = 0;
  let currentServerDiscoverResponseErrorCount = 0;
  let currentToolsListRpcCount = 0;
  let currentToolsCallStartCount = 0;
  const responseByRequestId = new Map();
  const requestServerStartIdByRequestId = new Map();
  const currentInitializeRequestIds = new Set();
  const currentServerDiscoverRequestIds = new Set();

  function belongsToCurrent(serverStartId) {
    if (!currentServerStartId) return false;
    return serverStartId === currentServerStartId;
  }

  function responseKey(serverStartId, requestId) {
    return `${String(serverStartId || "")}\u0000${String(requestId || "")}`;
  }

  for (const entry of entries || []) {
    const event = String(entry.event || "");
    const explicitServerStartId = String(entry.server_start_id || "");
    if (event === "server_start") {
      activeServerStartId = String(explicitServerStartId || activeServerStartId || "");
      activeServerStartTs = String(entry.ts || activeServerStartTs || "");
      lastServerStart = { ts: entry.ts || "", server_start_id: activeServerStartId };
    }

    if (entry.request_id && explicitServerStartId) {
      requestServerStartIdByRequestId.set(String(entry.request_id), explicitServerStartId);
    }

    const requestScopedServerStartId = entry.request_id
      ? String(requestServerStartIdByRequestId.get(String(entry.request_id)) || "")
      : "";
    const serverStartId = String(explicitServerStartId || requestScopedServerStartId || activeServerStartId || "");
    const common = {
      ts: entry.ts || "",
      request_id: entry.request_id || null,
      session_id: entry.session_id || "",
      server_start_id: serverStartId,
    };

    if (event === "initialize_received") {
      lastInitialize = {
        ...common,
        protocol_version: entry.protocol_version || "",
        client_name: entry.client_name || "",
        client_version: entry.client_version || "",
      };
      if (belongsToCurrent(serverStartId)) {
        currentInitializeCount += 1;
        if (common.request_id) currentInitializeRequestIds.add(common.request_id);
      }
    }

    if (event === "server_discover_received") {
      lastServerDiscover = {
        ...common,
        protocol_version: entry.protocol_version || "",
        client_name: entry.client_name || "",
        client_version: entry.client_version || "",
      };
      if (belongsToCurrent(serverStartId)) {
        currentServerDiscoverCount += 1;
        if (common.request_id) currentServerDiscoverRequestIds.add(common.request_id);
      }
    }

    if (event === "rpc_response_sent" && entry.request_id) {
      responseByRequestId.set(responseKey(serverStartId, entry.request_id), {
        ts: entry.ts || "",
        request_id: entry.request_id,
        server_start_id: serverStartId,
        status_code: Number(entry.status_code),
        response_mode: entry.response_mode || "",
        phase: entry.phase || "",
        has_result: entry.has_result === true,
        has_error: entry.has_error === true,
        error_code: typeof entry.error_code === "number" ? entry.error_code : null,
        response_bytes: typeof entry.response_bytes === "number" ? entry.response_bytes : null,
      });
    }

    if (event === "rpc_received" && entry.method === "tools/list" && belongsToCurrent(serverStartId)) {
      currentToolsListRpcCount += 1;
    }

    if (event === "tool_call_start" && belongsToCurrent(serverStartId)) {
      currentToolsCallStartCount += 1;
    }
  }

  for (const requestId of currentInitializeRequestIds) {
    const key = responseKey(currentServerStartId, requestId);
    if (!responseByRequestId.has(key)) continue;
    currentInitializeResponseCount += 1;
    const response = responseByRequestId.get(key);
    if (response?.has_error === true) currentInitializeResponseErrorCount += 1;
    else currentInitializeResponseSuccessCount += 1;
  }

  for (const requestId of currentServerDiscoverRequestIds) {
    const key = responseKey(currentServerStartId, requestId);
    if (!responseByRequestId.has(key)) continue;
    currentServerDiscoverResponseCount += 1;
    const response = responseByRequestId.get(key);
    if (response?.has_error === true) currentServerDiscoverResponseErrorCount += 1;
    else currentServerDiscoverResponseSuccessCount += 1;
  }

  const initializeObservedForCurrentStart = Boolean(currentServerStartId && currentInitializeCount > 0);
  const serverDiscoverObservedForCurrentStart = Boolean(currentServerStartId && currentServerDiscoverCount > 0);
  const initializeResponseObservedForCurrentStart = Boolean(currentServerStartId && currentInitializeResponseCount > 0);
  const serverDiscoverResponseObservedForCurrentStart = Boolean(currentServerStartId && currentServerDiscoverResponseCount > 0);
  const followupTrafficWithoutFreshEntry = Boolean(
    currentServerStartId
    && !initializeObservedForCurrentStart
    && !serverDiscoverObservedForCurrentStart
    && (currentToolsListRpcCount > 0 || currentToolsCallStartCount > 0)
  );

  const lastInitializeResponse = lastInitialize?.request_id
    ? responseByRequestId.get(responseKey(lastInitialize.server_start_id, lastInitialize.request_id)) || null
    : null;
  const lastServerDiscoverResponse = lastServerDiscover?.request_id
    ? responseByRequestId.get(responseKey(lastServerDiscover.server_start_id, lastServerDiscover.request_id)) || null
    : null;

  let observedEntryPath = "no_current_entry_observed";
  if (!currentServerStartId) observedEntryPath = "current_server_start_unknown";
  else if (initializeObservedForCurrentStart && serverDiscoverObservedForCurrentStart) observedEntryPath = "mixed_initialize_and_server_discover";
  else if (initializeObservedForCurrentStart) observedEntryPath = "initialize_only";
  else if (serverDiscoverObservedForCurrentStart) observedEntryPath = "server_discover_only";

  const initializeRetirementReadiness = buildInitializeRetirementReadiness({
    currentServerStartId,
    observedEntryPath,
    initializeObservedForCurrentStart,
    serverDiscoverObservedForCurrentStart,
    followupTrafficWithoutFreshEntry,
    requestContract,
    currentInitializeResponseSuccessCount,
    currentServerDiscoverResponseSuccessCount,
  });

  return {
    status: observedEntryPath,
    current_server_start_id: currentServerStartId,
    latest_server_start: lastServerStart || { ts: activeServerStartTs, server_start_id: activeServerStartId },
    current_window_counts: {
      initialize_received: currentInitializeCount,
      server_discover_received: currentServerDiscoverCount,
      initialize_response_sent: currentInitializeResponseCount,
      initialize_response_success: currentInitializeResponseSuccessCount,
      initialize_response_error: currentInitializeResponseErrorCount,
      server_discover_response_sent: currentServerDiscoverResponseCount,
      server_discover_response_success: currentServerDiscoverResponseSuccessCount,
      server_discover_response_error: currentServerDiscoverResponseErrorCount,
      tools_list_rpc: currentToolsListRpcCount,
      tools_call_start: currentToolsCallStartCount,
    },
    request_contract: {
      route: requestContract.route || "/mcp",
      server_discover_supported: requestContract.server_discover_supported !== false,
      legacy_initialize_supported: requestContract.legacy_initialize_supported !== false,
      initialize_required: requestContract.initialize_required === true,
      protocol_sessions: requestContract.protocol_sessions === true,
      transition_mode: requestContract.transport_mode || "",
    },
    initialize_observed_for_current_start: initializeObservedForCurrentStart,
    server_discover_observed_for_current_start: serverDiscoverObservedForCurrentStart,
    initialize_response_observed_for_current_start: initializeResponseObservedForCurrentStart,
    server_discover_response_observed_for_current_start: serverDiscoverResponseObservedForCurrentStart,
    followup_traffic_without_fresh_entry: followupTrafficWithoutFreshEntry,
    initialize_retirement_readiness: initializeRetirementReadiness,
    last_initialize: lastInitialize || null,
    last_initialize_response: lastInitializeResponse,
    last_server_discover: lastServerDiscover || null,
    last_server_discover_response: lastServerDiscoverResponse,
    note: observedEntryPath === "initialize_only"
      ? "Recent client traffic for the current server_start_id entered only through legacy initialize even though server/discover remains available. Use the paired response summary and the success/error counts to confirm how the server interpreted and answered that entry path."
      : observedEntryPath === "server_discover_only"
        ? "Recent client traffic for the current server_start_id entered through canonical server/discover without observed legacy initialize. Use the paired response summary and the success/error counts to confirm how the server interpreted and answered that entry path."
        : followupTrafficWithoutFreshEntry
          ? "The current audit window shows follow-up traffic such as tools/list or tools/call, but no fresh initialize or server/discover entry event for this server_start_id. Treat this as a stale-entry window, not as evidence that the client changed entry path."
        : "Use this section to distinguish declared request-contract support from the entry path clients actually used in the inspected audit window, and correlate those entry events with bounded response-side audit summaries plus per-entry success/error counts.",
  };
}

module.exports = {
  buildClientEntryPathDiagnostics,
};

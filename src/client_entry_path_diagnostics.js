"use strict";

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
  let currentToolsListRpcCount = 0;
  let currentToolsCallStartCount = 0;

  function belongsToCurrent(serverStartId) {
    if (!currentServerStartId) return false;
    return serverStartId === currentServerStartId;
  }

  for (const entry of entries || []) {
    const event = String(entry.event || "");
    if (event === "server_start") {
      activeServerStartId = String(entry.server_start_id || activeServerStartId || "");
      activeServerStartTs = String(entry.ts || activeServerStartTs || "");
      lastServerStart = { ts: entry.ts || "", server_start_id: activeServerStartId };
    }

    const serverStartId = String(entry.server_start_id || activeServerStartId || "");
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
      if (belongsToCurrent(serverStartId)) currentInitializeCount += 1;
    }

    if (event === "server_discover_received") {
      lastServerDiscover = {
        ...common,
        protocol_version: entry.protocol_version || "",
        client_name: entry.client_name || "",
        client_version: entry.client_version || "",
      };
      if (belongsToCurrent(serverStartId)) currentServerDiscoverCount += 1;
    }

    if (event === "rpc_received" && entry.method === "tools/list" && belongsToCurrent(serverStartId)) {
      currentToolsListRpcCount += 1;
    }

    if (event === "tool_call_start" && belongsToCurrent(serverStartId)) {
      currentToolsCallStartCount += 1;
    }
  }

  const initializeObservedForCurrentStart = Boolean(currentServerStartId && currentInitializeCount > 0);
  const serverDiscoverObservedForCurrentStart = Boolean(currentServerStartId && currentServerDiscoverCount > 0);

  let observedEntryPath = "no_current_entry_observed";
  if (!currentServerStartId) observedEntryPath = "current_server_start_unknown";
  else if (initializeObservedForCurrentStart && serverDiscoverObservedForCurrentStart) observedEntryPath = "mixed_initialize_and_server_discover";
  else if (initializeObservedForCurrentStart) observedEntryPath = "initialize_only";
  else if (serverDiscoverObservedForCurrentStart) observedEntryPath = "server_discover_only";

  return {
    status: observedEntryPath,
    current_server_start_id: currentServerStartId,
    latest_server_start: lastServerStart || { ts: activeServerStartTs, server_start_id: activeServerStartId },
    current_window_counts: {
      initialize_received: currentInitializeCount,
      server_discover_received: currentServerDiscoverCount,
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
    last_initialize: lastInitialize || null,
    last_server_discover: lastServerDiscover || null,
    note: observedEntryPath === "initialize_only"
      ? "Recent client traffic for the current server_start_id entered only through legacy initialize even though server/discover remains available."
      : observedEntryPath === "server_discover_only"
        ? "Recent client traffic for the current server_start_id entered through canonical server/discover without observed legacy initialize."
        : "Use this section to distinguish declared request-contract support from the entry path clients actually used in the inspected audit window.",
  };
}

module.exports = {
  buildClientEntryPathDiagnostics,
};

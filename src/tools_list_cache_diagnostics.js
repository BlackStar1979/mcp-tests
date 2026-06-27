"use strict";

function buildToolsListCacheDiagnostics(entries, runtimeStatus = {}) {
  const runtimeSurface = runtimeStatus.tool_surface || {};
  const currentServerStartId = String(runtimeStatus.server_start_id || "");
  const currentToolSurfaceFingerprint = String(runtimeSurface.combined_fingerprint || "");
  const currentToolNamesHash = String(runtimeSurface.tool_names_hash || "");
  let activeServerStartId = "";
  let activeServerStartTs = "";
  let lastServerStart = null;
  let lastInitialize = null;
  let lastToolsListRpc = null;
  let lastToolsListServed = null;
  let lastToolsListCacheDirective = null;
  let lastToolCallStart = null;
  let currentInitializeCount = 0;
  let currentToolsListRpcCount = 0;
  let currentToolsListServedCount = 0;
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
      lastInitialize = { ...common, auth_mode: entry.auth_mode || "", profile: entry.profile || "" };
      if (belongsToCurrent(serverStartId)) currentInitializeCount += 1;
    }
    if (event === "rpc_received" && entry.method === "tools/list") {
      lastToolsListRpc = common;
      if (belongsToCurrent(serverStartId)) currentToolsListRpcCount += 1;
    }
    if (event === "tools_list_served") {
      lastToolsListServed = { ...common, tool_count: Number.isInteger(entry.tool_count) ? entry.tool_count : null, fingerprint: entry.fingerprint || "", tool_names_hash: entry.tool_names_hash || "" };
      if (belongsToCurrent(serverStartId)) currentToolsListServedCount += 1;
    }
    if (event === "tools_list_cache_directive") {
      lastToolsListCacheDirective = { ...common, ttl_ms: Number.isInteger(entry.ttl_ms) ? entry.ttl_ms : null, cache_scope: entry.cache_scope || "", fingerprint: entry.fingerprint || "" };
    }
    if (event === "tool_call_start") {
      lastToolCallStart = { ...common, tool: entry.tool || "unknown" };
      if (belongsToCurrent(serverStartId)) currentToolsCallStartCount += 1;
    }
  }

  const toolsCallAfterInitializeWithoutToolsList = Boolean(currentServerStartId && currentInitializeCount > 0 && currentToolsCallStartCount > 0 && currentToolsListServedCount === 0);
  const toolsListObservedForCurrentStart = Boolean(currentServerStartId && currentToolsListServedCount > 0);
  const initializeObservedForCurrentStart = Boolean(currentServerStartId && currentInitializeCount > 0);

  let status = "no_current_session_observed";
  if (!currentServerStartId) status = "current_server_start_unknown";
  else if (toolsCallAfterInitializeWithoutToolsList) status = "tools_call_after_initialize_without_tools_list";
  else if (toolsListObservedForCurrentStart) status = "tools_list_observed_for_current_start";
  else if (initializeObservedForCurrentStart) status = "initialize_seen_no_tools_list_yet";

  return {
    status,
    current_server_start_id: currentServerStartId,
    latest_server_start: lastServerStart || { ts: activeServerStartTs, server_start_id: activeServerStartId },
    current_tool_surface_fingerprint: currentToolSurfaceFingerprint,
    current_tool_names_hash: currentToolNamesHash,
    current_window_counts: { initialize_received: currentInitializeCount, tools_list_rpc: currentToolsListRpcCount, tools_list_served: currentToolsListServedCount, tools_call_start: currentToolsCallStartCount },
    last_initialize: lastInitialize || null,
    last_tools_list_rpc: lastToolsListRpc || null,
    last_tools_list_served: lastToolsListServed || null,
    last_tools_list_cache_directive: lastToolsListCacheDirective || null,
    last_tool_call_start: lastToolCallStart || null,
    tools_call_after_initialize_without_tools_list: toolsCallAfterInitializeWithoutToolsList,
    tools_list_observed_for_current_start: toolsListObservedForCurrentStart,
    ttl_cache_directive_observed: Boolean(lastToolsListCacheDirective),
    note: toolsCallAfterInitializeWithoutToolsList
      ? "Client initialized and called tools without an observed tools/list in the inspected window for the current server_start_id."
      : "Use this section to distinguish server-side tools/list freshness from connector/client-side tool-map cache behavior.",
  };
}

module.exports = { buildToolsListCacheDiagnostics };

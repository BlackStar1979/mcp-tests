"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const readJson = (rel) => JSON.parse(read(rel));

const record = read("_workflow/operator_decisions/sep2549_list_read_cache_inventory.md");
const inventory = readJson("_workflow/sessionless_inventory.json");
const state = readJson("_workflow/state.json");
const canon = read("_workflow/WORKFLOW_CANON.md");
const index = read("_workflow/ACTIVE_WORKFLOW_INDEX.md");
const dispatcher = read("src/runtime/rpc_message_dispatcher.js");
const toolsListResponse = read("src/runtime/tools_list_response.js");
const toolsListHandler = read("src/runtime/tools_list_message_handler.js");
const toolsSpec = readJson("SERVER_TOOLS_SPEC.json");

assert.ok(record.includes("Status: GREEN / INVENTORY RECORDED / WORKFLOW-ONLY"));
assert.ok(record.includes("`ttlMs: 0`"));
assert.ok(record.includes('`cacheScope: "private"`'));
assert.ok(record.includes("there are no active `resources/list`, `resources/read`, `prompts/list`, or `prompts/get` handlers"));
assert.ok(record.includes("payloads behind `tools/call`, not shared MCP top-level result builders"));

assert.equal(state.active_target_direction.sep2549_list_read_cache_inventory_record, "_workflow/operator_decisions/sep2549_list_read_cache_inventory.md");
assert.equal(inventory.active_target_contract.sep2549_list_read_cache_inventory_record, "_workflow/operator_decisions/sep2549_list_read_cache_inventory.md");

const ttlLedger = inventory.deprecation_ledger.find((item) => item.feature_id === "list_results_ttl_cache_scope");
assert.equal(ttlLedger.implementation_status, "partial");
assert.equal(ttlLedger.checklist.find((item) => item.item === "inventory all list/read result builders").status, "done");
assert.equal(ttlLedger.checklist.find((item) => item.item === "inventory all list/read result builders").evidence, "_workflow/operator_decisions/sep2549_list_read_cache_inventory.md");

assert.ok(canon.includes("SEP-2549 cache-inventory clarification"));
assert.ok(index.includes("sep2549_list_read_cache_inventory.md"));
assert.ok(index.includes("Controlled OAuth21 `3008` restart and bounded live verification for the hidden-route retirement package."));

assert.ok(dispatcher.includes('case "tools/list"'));
assert.equal(dispatcher.includes('case "resources/list"'), false);
assert.equal(dispatcher.includes('case "resources/read"'), false);
assert.equal(dispatcher.includes('case "prompts/list"'), false);
assert.equal(dispatcher.includes('case "prompts/get"'), false);

assert.ok(toolsListResponse.includes("ttlMs: 0"));
assert.ok(toolsListResponse.includes('cacheScope: "private"'));
assert.ok(toolsListHandler.includes("tools_list_cache_directive"));

assert.ok(Object.hasOwn(toolsSpec.tool_catalog, "fs_list_public"));
assert.ok(Object.hasOwn(toolsSpec.tool_catalog, "plugin_registry_list"));
assert.ok(Object.hasOwn(toolsSpec.tool_catalog, "memory_get_tasks"));

console.log("smoke_sep2549_list_read_cache_inventory ok");

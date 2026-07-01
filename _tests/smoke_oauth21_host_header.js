"use strict";
const assert=require("node:assert/strict");
const {isAllowedHost}=require("../src/runtime/host_header_guard");
assert.equal(isAllowedHost({headers:{host:"mcp-tests-oauth21.romionologic.dev"}},{publicBaseUrl:"https://mcp-tests-oauth21.romionologic.dev"}),true);
assert.equal(isAllowedHost({headers:{host:"127.0.0.1:3008"}},{publicBaseUrl:"https://mcp-tests-oauth21.romionologic.dev"}),true);
assert.equal(isAllowedHost({headers:{host:"evil.example"}},{publicBaseUrl:"https://mcp-tests-oauth21.romionologic.dev"}),false);
console.log("smoke_oauth21_host_header ok");

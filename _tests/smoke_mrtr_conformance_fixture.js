"use strict";

const assert = require("node:assert/strict");
const {
  Client,
  StreamableHTTPClientTransport,
} = require("@modelcontextprotocol/client");
const { startMrtrConformanceFixture } = require("./helpers/mrtr_conformance_fixture");

(async () => {
  const fixture = await startMrtrConformanceFixture();
  const client = new Client(
    { name: "mcp-tests-mrtr-conformance", version: "1.0.0" },
    {
      capabilities: { elicitation: {} },
      versionNegotiation: { mode: { pin: "2026-07-28" } },
      inputRequired: { maxRounds: 3 },
    }
  );
  const transport = new StreamableHTTPClientTransport(new URL(fixture.url));

  let elicitationCount = 0;
  client.setRequestHandler("elicitation/create", async (request) => {
    elicitationCount += 1;
    assert.equal(request.params.mode, "form");
    assert.equal(request.params.message, "Confirm the MRTR fixture request");
    assert.deepEqual(request.params.requestedSchema, {
      type: "object",
      properties: {
        confirmed: { type: "boolean" },
      },
      required: ["confirmed"],
    });
    return {
      action: "accept",
      content: { confirmed: true },
    };
  });

  try {
    await client.connect(transport);
    assert.equal(client.getProtocolEra(), "modern");
    assert.equal(client.getNegotiatedProtocolVersion(), "2026-07-28");

    const result = await client.callTool({
      name: "mrtr_fixture",
      arguments: { topic: "boundary" },
    });

    assert.equal(elicitationCount, 1);
    // The modern wire requires resultType="complete"; Client.callTool() consumes it.
    assert.equal(result.resultType, undefined);
    assert.equal(result.isError, undefined);
    assert.equal(result.content?.[0]?.type, "text");
    assert.equal(result.content?.[0]?.text, "confirmed:boundary");

    const trace = fixture.trace();
    assert.equal(trace.toolCalls.length, 2, "exactly one retry");
    const [initialCall, retryCall] = trace.toolCalls;

    assert.notEqual(initialCall.id, retryCall.id, "retry uses a fresh JSON-RPC id");
    assert.deepEqual(initialCall.params.arguments, { topic: "boundary" });
    assert.deepEqual(retryCall.params.arguments, { topic: "boundary" });
    assert.equal(initialCall.params.inputResponses, undefined);
    assert.equal(initialCall.params.requestState, undefined);
    assert.equal(retryCall.params.requestState, fixture.requestState, "opaque state echoed byte-exact");
    assert.deepEqual(retryCall.params.inputResponses, {
      approval: {
        action: "accept",
        content: { confirmed: true },
      },
    });
  } finally {
    await client.close().catch(() => {});
    await fixture.close();
  }

  console.log("smoke_mrtr_conformance_fixture ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});

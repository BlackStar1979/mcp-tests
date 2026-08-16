"use strict";

const http = require("node:http");

const PROTOCOL_VERSION = "2026-07-28";
const REQUEST_STATE = "mrtr-state:v1:opaque/+/=:%7Bboundary%7D";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(body),
  });
  res.end(body);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let bytes = 0;
    req.on("data", (chunk) => {
      bytes += chunk.length;
      if (bytes > 64 * 1024) {
        reject(new Error("mrtr fixture request too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function discoverResult(id) {
  return {
    jsonrpc: "2.0",
    id,
    result: {
      supportedVersions: [PROTOCOL_VERSION],
      capabilities: {
        tools: {},
      },
      instructions: "Hermetic MRTR conformance fixture.",
    },
  };
}

function toolsListResult(id) {
  return {
    jsonrpc: "2.0",
    id,
    result: {
      tools: [
        {
          name: "mrtr_fixture",
          description: "Hermetic multi-round-trip conformance fixture.",
          inputSchema: {
            type: "object",
            properties: {
              topic: { type: "string" },
            },
            required: ["topic"],
            additionalProperties: false,
          },
        },
      ],
    },
  };
}

function inputRequiredResult(id) {
  return {
    jsonrpc: "2.0",
    id,
    result: {
      resultType: "input_required",
      inputRequests: {
        approval: {
          method: "elicitation/create",
          params: {
            mode: "form",
            message: "Confirm the MRTR fixture request",
            requestedSchema: {
              type: "object",
              properties: {
                confirmed: { type: "boolean" },
              },
              required: ["confirmed"],
            },
          },
        },
      },
      requestState: REQUEST_STATE,
    },
  };
}

function finalToolResult(id, topic) {
  return {
    jsonrpc: "2.0",
    id,
    result: {
      resultType: "complete",
      content: [
        {
          type: "text",
          text: `confirmed:${topic}`,
        },
      ],
      structuredContent: {
        success: true,
        topic,
      },
    },
  };
}

function methodNotFound(id, method) {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code: -32601,
      message: `Method not found: ${method}`,
    },
  };
}

async function startMrtrConformanceFixture() {
  const traceState = {
    messages: [],
    toolCalls: [],
  };

  const server = http.createServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/mcp") {
      sendJson(res, 404, {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32601, message: "Not found" },
      });
      return;
    }

    let message;
    try {
      message = await readJson(req);
    } catch (error) {
      sendJson(res, 400, {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error" },
      });
      return;
    }

    traceState.messages.push(clone(message));

    if (message.method === "server/discover") {
      sendJson(res, 200, discoverResult(message.id));
      return;
    }

    if (message.method === "tools/list") {
      sendJson(res, 200, toolsListResult(message.id));
      return;
    }

    if (message.method === "tools/call") {
      traceState.toolCalls.push(clone(message));
      const params = message.params || {};
      const responses = params.inputResponses;
      const state = params.requestState;

      if (responses === undefined && state === undefined) {
        sendJson(res, 200, inputRequiredResult(message.id));
        return;
      }

      if (
        state === REQUEST_STATE &&
        responses &&
        responses.approval &&
        responses.approval.action === "accept" &&
        responses.approval.content &&
        responses.approval.content.confirmed === true
      ) {
        sendJson(res, 200, finalToolResult(message.id, params.arguments?.topic));
        return;
      }

      sendJson(res, 200, {
        jsonrpc: "2.0",
        id: message.id,
        error: {
          code: -32602,
          message: "Invalid MRTR retry payload",
        },
      });
      return;
    }

    sendJson(res, 200, methodNotFound(message.id, message.method));
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  if (!address || typeof address !== "object") {
    await new Promise((resolve) => server.close(resolve));
    throw new Error("MRTR fixture did not bind a TCP address");
  }

  return {
    url: `http://127.0.0.1:${address.port}/mcp`,
    requestState: REQUEST_STATE,
    trace() {
      return clone(traceState);
    },
    close() {
      return new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    },
  };
}

module.exports = {
  PROTOCOL_VERSION,
  startMrtrConformanceFixture,
};

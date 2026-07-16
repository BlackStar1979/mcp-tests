"use strict";

const assert = require("node:assert/strict");
const { createOAuth21AuthorizationServer } = require("../src/auth/oauth21_authorization_server");

function makeResponseRecorder() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    writeHead(statusCode, headers = {}) {
      this.statusCode = statusCode;
      this.headers = { ...headers };
    },
    end(body = "") {
      this.body = String(body || "");
    },
  };
}

function makeRequest({ method = "GET", headers = {}, body = "", remoteAddress = "127.0.0.1" } = {}) {
  const listeners = new Map();
  return {
    method,
    headers,
    socket: { remoteAddress },
    on(event, handler) {
      const bucket = listeners.get(event) || [];
      bucket.push(handler);
      listeners.set(event, bucket);
    },
    removeListener(event, handler) {
      const bucket = listeners.get(event) || [];
      listeners.set(event, bucket.filter((item) => item !== handler));
    },
    emit(event, value) {
      for (const handler of listeners.get(event) || []) handler(value);
    },
    start() {
      if (body) this.emit("data", body);
      this.emit("end");
    },
  };
}

async function invoke(server, { pathname, method = "GET", headers = {}, body = "" }) {
  const req = makeRequest({ method, headers, body });
  const res = makeResponseRecorder();
  const handled = server.handleRoute({
    req,
    res,
    url: new URL(`https://example.test${pathname}`),
  });
  req.start();
  await handled;
  return {
    status: res.statusCode,
    headers: res.headers,
    body: res.body ? JSON.parse(res.body) : null,
  };
}

(async () => {
  const redirectUri = "https://client.example/callback";
  const resource = "https://example.test/mcp";
  const server = createOAuth21AuthorizationServer({
    issuer: "https://example.test",
    operatorSecret: "stage12-oauth21-operator-secret",
    publicRouteLimit: 2,
    publicRouteWindowMs: 60_000,
  });

  const registerBody = JSON.stringify({
    redirect_uris: [redirectUri],
    token_endpoint_auth_method: "none",
  });

  const first = await invoke(server, {
    pathname: "/register",
    method: "POST",
    headers: { "content-type": "application/json" },
    body: registerBody,
  });
  const second = await invoke(server, {
    pathname: "/register",
    method: "POST",
    headers: { "content-type": "application/json" },
    body: registerBody,
  });
  const third = await invoke(server, {
    pathname: "/register",
    method: "POST",
    headers: { "content-type": "application/json" },
    body: registerBody,
  });

  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  assert.equal(third.status, 429);
  assert.equal(third.body.error, "slow_down");
  assert.equal(third.body.error_description, "rate_limit_exceeded");

  const authorizeServer = createOAuth21AuthorizationServer({
    issuer: "https://example.test",
    operatorSecret: "stage12-oauth21-operator-secret",
    publicRouteLimit: 2,
    publicRouteWindowMs: 60_000,
  });
  const registration = authorizeServer.registerClient({
    redirect_uris: [redirectUri],
    token_endpoint_auth_method: "none",
  });
  assert.equal(registration.status, 201);
  const authorizePath = `/authorize?client_id=${encodeURIComponent(registration.body.client_id)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&code_challenge_method=S256&code_challenge=${"a".repeat(43)}&state=abc&scope=mcp:tools&resource=${encodeURIComponent(resource)}`;
  const authorizeFirst = await invoke(authorizeServer, { pathname: authorizePath });
  const authorizeSecond = await invoke(authorizeServer, { pathname: authorizePath });
  const authorizeThird = await invoke(authorizeServer, { pathname: authorizePath });
  assert.equal(authorizeFirst.status, 302);
  assert.equal(authorizeSecond.status, 302);
  assert.equal(authorizeThird.status, 429);

  const tokenServer = createOAuth21AuthorizationServer({
    issuer: "https://example.test",
    operatorSecret: "stage12-oauth21-operator-secret",
    publicRouteLimit: 2,
    publicRouteWindowMs: 60_000,
  });
  const tokenBody = "grant_type=refresh_token&client_id=nope&refresh_token=missing&resource=https%3A%2F%2Fexample.test%2Fmcp";
  const tokenFirst = await invoke(tokenServer, {
    pathname: "/token",
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: tokenBody,
  });
  const tokenSecond = await invoke(tokenServer, {
    pathname: "/token",
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: tokenBody,
  });
  const tokenThird = await invoke(tokenServer, {
    pathname: "/token",
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: tokenBody,
  });
  assert.equal(tokenFirst.status, 400);
  assert.equal(tokenSecond.status, 400);
  assert.equal(tokenThird.status, 429);

  console.log("smoke_oauth21_public_route_throttle ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});

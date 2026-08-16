"use strict";

const assert = require("node:assert/strict");
const {
  CIMD_MAX_BYTES,
  createClientIdMetadataResolver,
  isSpecialUseIp,
  validateClientIdUrl,
  validateClientMetadata,
} = require("../src/auth/oauth_cimd_resolver");

function expectInvalid(value, code) {
  assert.throws(() => validateClientIdUrl(value), (error) => error && error.code === code);
}

const clientId = "https://client.example/oauth/client.json?profile=desktop";
const valid = validateClientIdUrl(clientId);
assert.equal(valid.clientId, clientId);
assert.equal(valid.url.hostname, "client.example");

expectInvalid("http://client.example/oauth/client.json", "cimd_https_required");
expectInvalid("https://client.example", "cimd_path_required");
expectInvalid("https://user@client.example/oauth/client.json", "cimd_userinfo_forbidden");
expectInvalid("https://client.example/oauth/client.json#fragment", "cimd_fragment_forbidden");
expectInvalid("https://client.example/oauth/../client.json", "cimd_dot_segment_forbidden");
expectInvalid("https://client.example/oauth/%2e%2e/client.json", "cimd_dot_segment_forbidden");

for (const ip of [
  "100.64.0.1",
  "192.0.2.1",
  "198.18.0.1",
  "203.0.113.1",
  "2001:db8::1",
  "64:ff9b:1::1",
  "fc00::1",
]) {
  assert.equal(isSpecialUseIp(ip), true, ip);
}
assert.equal(isSpecialUseIp("93.184.216.34"), false);
assert.equal(isSpecialUseIp("2606:2800:220:1:248:1893:25c8:1946"), false);

const metadataClientId = "https://client.example/oauth/client.json";
const baseMetadata = {
  client_id: metadataClientId,
  client_name: "Example Client",
  redirect_uris: ["https://client.example/callback"],
  token_endpoint_auth_method: "none",
};
assert.throws(
  () => validateClientMetadata(metadataClientId, { ...baseMetadata, client_secret: "forbidden" }),
  (error) => error && error.code === "cimd_shared_secret_forbidden"
);
assert.throws(
  () => validateClientMetadata(metadataClientId, { ...baseMetadata, token_endpoint_auth_method: "client_secret_basic" }),
  (error) => error && error.code === "cimd_token_auth_method_unsupported"
);
assert.throws(
  () => validateClientMetadata(metadataClientId, {
    ...baseMetadata,
    jwks: { keys: [{ kty: "RSA", n: "public-modulus", e: "AQAB", d: "private-exponent" }] },
  }),
  (error) => error && error.code === "cimd_private_key_material_forbidden"
);
assert.throws(
  () => validateClientMetadata(metadataClientId, { ...baseMetadata, redirect_uris: ["file:///tmp/callback"] }, (value) => ({ ok: value.startsWith("https://"), value })),
  (error) => error && error.code === "cimd_redirect_uri_invalid"
);

(async () => {
  let fetches = 0;
  const blocked = createClientIdMetadataResolver({
    lookup: async () => [{ address: "100.64.0.7", family: 4 }],
    fetchDocument: async () => {
      fetches += 1;
      throw new Error("must not fetch");
    },
  });
  await assert.rejects(
    blocked.resolve("https://client.example/oauth/client.json"),
    (error) => error && error.code === "cimd_special_use_ip"
  );
  assert.equal(fetches, 0);

  const redirecting = createClientIdMetadataResolver({
    lookup: async () => [{ address: "93.184.216.34", family: 4 }],
    fetchDocument: async () => ({
      status: 302,
      headers: { location: "https://other.example/client.json" },
      body: Buffer.alloc(0),
    }),
  });
  await assert.rejects(
    redirecting.resolve("https://client.example/oauth/client.json"),
    (error) => error && error.code === "cimd_http_status"
  );

  const oversized = createClientIdMetadataResolver({
    lookup: async () => [{ address: "93.184.216.34", family: 4 }],
    fetchDocument: async () => ({
      status: 200,
      headers: { "content-type": "application/json" },
      body: Buffer.alloc(CIMD_MAX_BYTES + 1),
    }),
  });
  await assert.rejects(
    oversized.resolve("https://client.example/oauth/client.json"),
    (error) => error && error.code === "cimd_response_too_large"
  );

  let nowMs = 1_000;
  let fetchCount = 0;
  const cachedClientId = "https://client.example/oauth/client.json";
  const goodBody = Buffer.from(JSON.stringify({
    client_id: cachedClientId,
    client_name: "Example Client",
    redirect_uris: ["http://127.0.0.1:3210/callback"],
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
  }));
  const cached = createClientIdMetadataResolver({
    now: () => nowMs,
    lookup: async () => [{ address: "93.184.216.34", family: 4 }],
    fetchDocument: async (_url, options) => {
      fetchCount += 1;
      assert.deepEqual(options.resolvedAddresses, [{ address: "93.184.216.34", family: 4 }]);
      return {
        status: 200,
        headers: { "content-type": "application/json", "cache-control": "public, max-age=60" },
        body: goodBody,
      };
    },
  });
  const first = await cached.resolve(cachedClientId);
  assert.equal(first.client.client_id, cachedClientId);
  assert.equal(first.cacheHit, false);
  assert.equal((await cached.resolve(cachedClientId)).cacheHit, true);
  assert.equal(fetchCount, 1);
  nowMs += 61_000;
  assert.equal((await cached.resolve(cachedClientId)).cacheHit, false);
  assert.equal(fetchCount, 2);

  let agedNowMs = 10_000;
  let agedFetches = 0;
  const aged = createClientIdMetadataResolver({
    now: () => agedNowMs,
    lookup: async () => [{ address: "93.184.216.34", family: 4 }],
    fetchDocument: async () => {
      agedFetches += 1;
      return {
        status: 200,
        headers: { "content-type": "application/json", "cache-control": "max-age=60", age: "59" },
        body: goodBody,
      };
    },
  });
  assert.equal((await aged.resolve(cachedClientId)).cacheHit, false);
  assert.equal((await aged.resolve(cachedClientId)).cacheHit, true);
  agedNowMs += 1_500;
  assert.equal((await aged.resolve(cachedClientId)).cacheHit, false, "Age must reduce remaining max-age lifetime");
  assert.equal(agedFetches, 2);

  let noStoreFetches = 0;
  const noStore = createClientIdMetadataResolver({
    lookup: async () => [{ address: "93.184.216.34", family: 4 }],
    fetchDocument: async () => {
      noStoreFetches += 1;
      return {
        status: 200,
        headers: { "content-type": "application/json", "cache-control": "no-store, max-age=60" },
        body: goodBody,
      };
    },
  });
  assert.equal((await noStore.resolve(cachedClientId)).cacheHit, false);
  assert.equal((await noStore.resolve(cachedClientId)).cacheHit, false);
  assert.equal(noStoreFetches, 2, "no-store responses must never enter the cache");

  let mismatchFetches = 0;
  const mismatch = createClientIdMetadataResolver({
    lookup: async () => [{ address: "93.184.216.34", family: 4 }],
    fetchDocument: async () => {
      mismatchFetches += 1;
      return {
        status: 200,
        headers: { "content-type": "application/json", "cache-control": "max-age=60" },
        body: Buffer.from(JSON.stringify({
          client_id: "https://attacker.example/client.json",
          client_name: "Wrong",
          redirect_uris: ["https://client.example/callback"],
          token_endpoint_auth_method: "none",
        })),
      };
    },
  });
  for (let i = 0; i < 2; i += 1) {
    await assert.rejects(
      mismatch.resolve(cachedClientId),
      (error) => error && error.code === "cimd_client_id_mismatch"
    );
  }
  assert.equal(mismatchFetches, 2, "invalid documents must not be cached");

  console.log("smoke_oauth_cimd_resolver ok");
})().catch((error) => {
  console.error(error?.stack || error);
  process.exit(1);
});

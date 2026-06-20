"use strict";
const assert=require("node:assert/strict");
const m=require("../src/auth/oauth_jwks_cache");
function jwk(kid){return {kty:"RSA",kid,use:"sig",alg:"RS256",n:"abc",e:"AQAB"};}
assert.equal(m.parseCacheControlMaxAge("public, max-age=60"),60);
assert.equal(m.parseCacheControlMaxAge("no-store"),null);
assert.equal(m.ttlFromCacheControl("max-age=30",{defaultTtlMs:100000,maxTtlMs:10000}),10000);
assert.equal(m.ttlFromCacheControl("max-age=3",{defaultTtlMs:100000,maxTtlMs:10000}),3000);
let now=0;let loads=0;let version=0;
const cache=m.createJwksCache({cacheControlHeader:"public, max-age=1",ttlMs:10000,maxTtlMs:5000,now:()=>now,loader:()=>{loads++;return {keys:[jwk(version===0?"a":"b")]};}});
assert.equal(cache.get().keys[0].kid,"a");assert.equal(loads,1);
now=900;assert.equal(cache.get().keys[0].kid,"a");assert.equal(loads,1);
version=1;now=1100;assert.equal(cache.get().keys[0].kid,"b");assert.equal(loads,2);
const status=cache.status();
assert.equal(status.ttl_ms,1000);assert.equal(status.configured_ttl_ms,10000);assert.equal(status.max_ttl_ms,5000);assert.equal(status.cache_control_max_age_seconds,1);
console.log("jwks_ttl_guard ok");

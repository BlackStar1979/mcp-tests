"use strict";
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const {createJwksCache}=require("../src/auth/oauth_jwks_cache");
const {verifyRs256}=require("../src/auth/oauth_jwt_verify");
function key(kid){const pair=crypto.generateKeyPairSync("rsa",{modulusLength:2048});const jwk=pair.publicKey.export({format:"jwk"});jwk.kid=kid;jwk.alg="RS256";jwk.use="sig";return {kid,publicKey:jwk,privateKey:pair.privateKey};}
function b64(o){return Buffer.from(JSON.stringify(o)).toString("base64url");}
function token(k,claims={}){const h=b64({alg:"RS256",typ:"JWT",kid:k.kid});const p=b64({iss:"https://as",aud:"https://mcp",scope:"mcp:tools",exp:Math.floor(Date.now()/1000)+60,...claims});const input=h+"."+p;const sig=crypto.sign("RSA-SHA256",Buffer.from(input),k.privateKey).toString("base64url");return {input,sig,compact:input+"."+sig};}
let t=0;
const old=key("old");const next=key("next");const future=key("future");
let version=0;
let loads=0;
function loader(){loads++;if(version===0)return {keys:[old.publicKey]};if(version===1)return {keys:[next.publicKey]};return {keys:[next.publicKey,future.publicKey]};}
const cache=createJwksCache({loader,now:()=>t,ttlMs:1000,unknownKidRefreshIntervalMs:100,previousKeyOverlapMs:500,issuer:"https://as",jwksUri:"https://as/jwks"});
assert.equal(cache.findKey("old").ok,true);
assert.equal(loads,1);
version=1;
let found=cache.findKey("next");
assert.equal(found.ok,true);
assert.equal(found.source,"refreshed");
assert.equal(loads,2);
assert.equal(cache.status().previous_key_count,1);
const oldFound=cache.findKey("old",{allowRefresh:false});
assert.equal(oldFound.ok,true);
assert.equal(oldFound.source,"previous_overlap");
const signedOld=token(old);
assert.equal(verifyRs256({signingInput:signedOld.input,signature:signedOld.sig,jwk:oldFound.key}),true);
assert.equal(cache.findKey("missing").ok,false);
const afterFirstMissingLoads=loads;
assert.equal(cache.findKey("othermissing").ok,false);
assert.equal(loads,afterFirstMissingLoads);
assert.ok(cache.status().recent_refresh_events.some((event)=>event.reason==="unknown_kid_refresh_suppressed"));
t=150;
version=2;
found=cache.findKey("future");
assert.equal(found.ok,true);
assert.equal(found.source,"refreshed");
assert.ok(loads>afterFirstMissingLoads);
t=700;
assert.equal(cache.findKey("old",{allowRefresh:false}).ok,false);
const status=cache.status();
assert.equal(status.issuer,"https://as");
assert.equal(status.jwks_uri,"https://as/jwks");
assert.equal(status.unknown_kid_refresh_interval_ms,100);
assert.equal(status.previous_key_overlap_ms,500);
console.log("smoke_oauth_key_rotation ok");

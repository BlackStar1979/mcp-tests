"use strict";
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {createAuthPolicy}=require("../src/auth/auth_policy");
function b64(o){return Buffer.from(JSON.stringify(o)).toString("base64url");}
function signRs(payload,privateKey,{kid="kid1",alg="RS256"}={}){const h=b64(kid?{alg,typ:"JWT",kid}:{alg,typ:"JWT"});const p=b64(payload);const input=h+"."+p;const sig=crypto.sign("RSA-SHA256",Buffer.from(input),privateKey).toString("base64url");return input+"."+sig;}
function signHs(payload,secret){const h=b64({alg:"HS256",typ:"JWT",kid:"kid1"});const p=b64(payload);const sig=crypto.createHmac("sha256",secret).update(h+"."+p).digest("base64url");return h+"."+p+"."+sig;}
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"mcp-jwks-"));
try{
 const {publicKey,privateKey}=crypto.generateKeyPairSync("rsa",{modulusLength:2048});
 const jwk=publicKey.export({format:"jwk"});jwk.kid="kid1";jwk.alg="RS256";jwk.use="sig";
 const jwksFile=path.join(tmp,"jwks.json");fs.writeFileSync(jwksFile,JSON.stringify({keys:[jwk]}));
 const issuer="https://as.example";const audience="https://mcp.example/mcp";const now=Math.floor(Date.now()/1000);
 const policy=createAuthPolicy({mode:"oauth",publicBaseUrl:audience,oauthIssuer:issuer,oauthAudience:audience,oauthJwksFile:jwksFile});
 assert.deepEqual(policy.status().supported_algs,["RS256"]);
 assert.equal(policy.status().token_validation_mode,"jwks_rs256");
 const good=signRs({iss:issuer,aud:audience,sub:"u",scope:"mcp:tools",exp:now+60},privateKey);
 assert.equal(policy.authenticate({headers:{authorization:"Bearer "+good},url:"/mcp"}).ok,true);
 const noKid=signRs({iss:issuer,aud:audience,scope:"mcp:tools",exp:now+60},privateKey,{kid:""});
 assert.equal(policy.authenticate({headers:{authorization:"Bearer "+noKid},url:"/mcp"}).error,"missing_jwt_kid");
 const unknownKid=signRs({iss:issuer,aud:audience,scope:"mcp:tools",exp:now+60},privateKey,{kid:"missing"});
 assert.equal(policy.authenticate({headers:{authorization:"Bearer "+unknownKid},url:"/mcp"}).error,"unknown_kid");
 const badAud=signRs({iss:issuer,aud:"https://other.example",scope:"mcp:tools",exp:now+60},privateKey);
 assert.equal(policy.authenticate({headers:{authorization:"Bearer "+badAud},url:"/mcp"}).error,"invalid_audience");
 const hs=signHs({iss:issuer,aud:audience,scope:"mcp:tools",exp:now+60},"x".repeat(48));
 assert.equal(policy.authenticate({headers:{authorization:"Bearer "+hs},url:"/mcp"}).error,"unsupported_jwt_alg");
 const tampered=good.slice(0,-2)+"xx";
 assert.equal(policy.authenticate({headers:{authorization:"Bearer "+tampered},url:"/mcp"}).error,"invalid_jwt_signature");
 console.log("smoke_oauth_jwks_rs256_validation ok");
}finally{fs.rmSync(tmp,{recursive:true,force:true});}

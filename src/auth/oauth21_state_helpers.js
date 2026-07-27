"use strict";

function choosePreferredRefreshToken(currentItem, candidateItem) {
  if (!currentItem) return candidateItem;
  if (!candidateItem) return currentItem;
  const currentExpiry = Number(currentItem.expiresAt || 0);
  const candidateExpiry = Number(candidateItem.expiresAt || 0);
  if (candidateExpiry !== currentExpiry) return candidateExpiry > currentExpiry ? candidateItem : currentItem;
  return String(candidateItem.token || "") > String(currentItem.token || "") ? candidateItem : currentItem;
}

function parseOAuthStateBody(body = {}, nowMs = Date.now()) {
  const access = new Map();
  const refresh = new Map();
  const usedRefresh = new Map();
  let expiredAccess = 0;
  let expiredRefresh = 0;
  let expiredUsedRefresh = 0;
  for (const item of Array.isArray(body.access) ? body.access : []) {
    if (item && item.token && item.expiresAt > nowMs) access.set(String(item.token), item);
    else expiredAccess += 1;
  }
  for (const item of Array.isArray(body.refresh) ? body.refresh : []) {
    if (item && item.token && item.expiresAt > nowMs) refresh.set(String(item.token), item);
    else expiredRefresh += 1;
  }
  for (const item of Array.isArray(body.used_refresh) ? body.used_refresh : []) {
    if (item && item.token && item.expiresAt > nowMs && item.grantId) usedRefresh.set(String(item.token), item);
    else expiredUsedRefresh += 1;
  }
  return {
    access,
    refresh,
    usedRefresh,
    expiredAccess,
    expiredRefresh,
    expiredUsedRefresh,
  };
}

module.exports = {
  choosePreferredRefreshToken,
  parseOAuthStateBody,
};

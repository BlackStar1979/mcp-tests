"use strict";

function addTax(netAmount, taxRate) {
  if (!Number.isFinite(netAmount) || !Number.isFinite(taxRate)) {
    throw new TypeError("netAmount and taxRate must be finite numbers");
  }
  return netAmount + netAmount * taxRate;
}

function roundCurrency(amount) {
  if (!Number.isFinite(amount)) throw new TypeError("amount must be finite");
  return Math.round(amount * 100) / 100;
}

module.exports = { addTax, roundCurrency };

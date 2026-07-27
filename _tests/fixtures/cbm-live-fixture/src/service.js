"use strict";

const { addTax, roundCurrency } = require("./math");

function formatInvoice(invoice) {
  return `${invoice.id}:${invoice.customer}:${invoice.gross.toFixed(2)}`;
}

function buildInvoice({ id, customer, netAmount, taxRate }) {
  const gross = roundCurrency(addTax(netAmount, taxRate));
  return {
    id,
    customer,
    net: roundCurrency(netAmount),
    taxRate,
    gross,
  };
}

function buildAndFormatInvoice(input) {
  return formatInvoice(buildInvoice(input));
}

module.exports = { buildAndFormatInvoice, buildInvoice, formatInvoice };

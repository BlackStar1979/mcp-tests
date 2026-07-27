"use strict";

const { buildAndFormatInvoice } = require("./service");

function main() {
  return buildAndFormatInvoice({
    id: "fixture-001",
    customer: "Test Customer",
    netAmount: 100,
    taxRate: 0.23,
  });
}

if (require.main === module) {
  process.stdout.write(`${main()}\n`);
}

module.exports = { main };

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

const { inventoryTreeTool } = require("../tools/inventory_tree");
const { tableProfileTool } = require("../tools/table_profile");
const { fitsInfoTool } = require("../tools/fits_info");
const { hdf5InfoTool } = require("../tools/hdf5_info");

const ROOT = path.resolve(__dirname, "..");
const TMP_ROOT = path.join(ROOT, "_control", "smoke_science_tools");

async function prepareFixtures() {
  await fs.rm(TMP_ROOT, { recursive: true, force: true });
  await fs.mkdir(path.join(TMP_ROOT, "nested"), { recursive: true });
  await fs.writeFile(
    path.join(TMP_ROOT, "sample.csv"),
    "name,value\nalpha,1\nbeta,2\n",
    "utf8"
  );
  await fs.writeFile(path.join(TMP_ROOT, "nested", "notes.txt"), "hello\nworld\n", "utf8");
  await fs.writeFile(path.join(TMP_ROOT, "broken.fits"), "not a fits file", "utf8");
  await fs.writeFile(path.join(TMP_ROOT, "broken.h5"), "not an hdf5 file", "utf8");
}

async function main() {
  await prepareFixtures();

  const inventory = await inventoryTreeTool.execute({
    path: "mcp-tests/_control/smoke_science_tools",
    top_n_largest: 5,
  });
  assert.equal(inventory.success, true);
  assert.equal(inventory.root_alias, "work");
  assert.ok(inventory.files >= 4);
  assert.ok(inventory.directories >= 1);
  assert.ok(inventory.by_extension[".csv"]);
  assert.ok(inventory.by_kind.table_or_text);
  assert.ok(inventory.largest.some((entry) => entry.path.endsWith("sample.csv")));

  const table = await tableProfileTool.execute({
    path: "mcp-tests/_control/smoke_science_tools/sample.csv",
    sample_rows: 5,
  });
  assert.equal(table.success, true);
  assert.equal(table.root_alias, "work");
  assert.equal(table.delimiter, ",");
  assert.deepEqual(table.columns, ["name", "value"]);
  assert.deepEqual(table.sample_rows[0], ["alpha", "1"]);

  const fits = await fitsInfoTool.execute({
    path: "mcp-tests/_control/smoke_science_tools/broken.fits",
  });
  assert.equal(fits.success, false);
  assert.match(fits.error, /fits|python|astropy|no such file|invalid|error/i);

  const hdf5 = await hdf5InfoTool.execute({
    path: "mcp-tests/_control/smoke_science_tools/broken.h5",
  });
  assert.equal(hdf5.success, false);
  assert.match(hdf5.error, /hdf5|python|h5py|unable|invalid|error/i);

  await fs.rm(TMP_ROOT, { recursive: true, force: true });
  console.log("smoke_science_tools ok");
}

main().catch(async (error) => {
  try {
    await fs.rm(TMP_ROOT, { recursive: true, force: true });
  } catch {}
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});

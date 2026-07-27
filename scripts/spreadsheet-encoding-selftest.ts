/**
 * Regression tests for bulk-import spreadsheet encoding detection.
 *
 * The cp949 fixture is pinned as literal bytes rather than produced by an
 * encoder at run time, so the test still describes a real Korean-Excel CSV even
 * if the encoding library changes. Offline: no network, no DB.
 */
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import {
  decodeCp949,
  decodeSpreadsheetBytes,
  hasUtf8Bom,
  looksBinaryWorkbook,
  tryDecodeUtf8,
} from "../src/lib/admin/product-bulk/decodeSpreadsheetBytes";
import { parseProductBulkSpreadsheet } from "../src/lib/admin/product-bulk/parseSpreadsheet";

const HEADER = "brand,product_name";
const ROW_1 = "넘버즈인,원더밤 200ml";
const ROW_2 = "설화수,옥용팩";
const CSV_TEXT = `${HEADER}\n${ROW_1}\n${ROW_2}\n`;

/** The same CSV as written by Excel on a Korean Windows install (cp949). */
const CP949_CSV = Buffer.from(
  "6272616e642c70726f647563745f6e616d650a" +
    "b3d1b9f6c1eec0ce2cbff8b4f5b9e3203230306d6c0a" +
    "bcb3c8adbcf62cbfc1bfebc6d10a",
  "hex"
);

const UTF8_CSV = Buffer.from(CSV_TEXT, "utf8");
const UTF8_BOM_CSV = Buffer.concat([
  Buffer.from([0xef, 0xbb, 0xbf]),
  Buffer.from(CSV_TEXT, "utf8"),
]);
const ASCII_CSV = Buffer.from(`${HEADER}\nCOSRX,Snail Essence\n`, "utf8");

// --- the fixtures are what they claim to be ---------------------------------
assert.equal(
  decodeCp949(CP949_CSV),
  CSV_TEXT,
  "the cp949 fixture decodes to the expected Korean text"
);
assert.equal(
  tryDecodeUtf8(CP949_CSV),
  null,
  "the cp949 fixture is NOT valid UTF-8 — this is what makes detection possible"
);
assert.equal(tryDecodeUtf8(UTF8_CSV), CSV_TEXT, "the utf-8 fixture is valid UTF-8");

// --- BOM detection -----------------------------------------------------------
assert.equal(hasUtf8Bom(UTF8_BOM_CSV), true, "BOM detected");
assert.equal(hasUtf8Bom(UTF8_CSV), false, "no BOM on a plain utf-8 file");
assert.equal(hasUtf8Bom(CP949_CSV), false, "no BOM on a cp949 file");
assert.equal(hasUtf8Bom(Buffer.from([0xef])), false, "a truncated BOM is not a BOM");

// --- step 1: BOM settles it --------------------------------------------------
const bom = decodeSpreadsheetBytes(UTF8_BOM_CSV);
assert.equal(bom.kind, "text");
if (bom.kind === "text") {
  assert.equal(bom.encoding, "utf-8-bom", "BOM path chosen");
  assert.equal(bom.text, CSV_TEXT, "BOM decoded correctly");
  assert.ok(
    !bom.text.startsWith("﻿"),
    "the BOM itself is stripped — otherwise the first header becomes '\\ufeffbrand'"
  );
}

// --- step 2: no BOM, valid UTF-8 --------------------------------------------
const utf8 = decodeSpreadsheetBytes(UTF8_CSV);
assert.equal(utf8.kind, "text");
if (utf8.kind === "text") {
  assert.equal(utf8.encoding, "utf-8", "utf-8 chosen without a BOM");
  assert.equal(utf8.text, CSV_TEXT);
}

// --- step 3: invalid UTF-8 falls back to cp949 -------------------------------
const cp949 = decodeSpreadsheetBytes(CP949_CSV);
assert.equal(cp949.kind, "text");
if (cp949.kind === "text") {
  assert.equal(cp949.encoding, "cp949", "cp949 chosen after the strict utf-8 decode failed");
  assert.equal(cp949.text, CSV_TEXT, "cp949 decoded to the same Korean text");
}

// --- ascii is valid UTF-8 and must not be mistaken for cp949 -----------------
const ascii = decodeSpreadsheetBytes(ASCII_CSV);
assert.equal(ascii.kind, "text");
if (ascii.kind === "text") {
  assert.equal(ascii.encoding, "utf-8", "ascii reads as utf-8");
}

// --- binary workbooks are never text-decoded ---------------------------------
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(
  workbook,
  XLSX.utils.aoa_to_sheet([
    ["brand", "product_name"],
    ["넘버즈인", "원더밤 200ml"],
  ]),
  "Sheet1"
);
const xlsxBytes = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
assert.equal(looksBinaryWorkbook(xlsxBytes), true, "xlsx recognised as binary");
assert.equal(looksBinaryWorkbook(UTF8_CSV), false, "csv is not binary");
assert.equal(
  decodeSpreadsheetBytes(xlsxBytes).kind,
  "binary",
  "an xlsx is passed through, not text-decoded"
);

// --- end to end through the real parser --------------------------------------
function parseNames(bytes: Buffer, fileName: string) {
  return parseProductBulkSpreadsheet(bytes, fileName).map((row) => ({
    brand: row.brand,
    productName: row.productName,
    slug: row.slug,
  }));
}

for (const [label, bytes] of [
  ["utf-8", UTF8_CSV],
  ["utf-8 with BOM", UTF8_BOM_CSV],
  ["cp949", CP949_CSV],
] as const) {
  const rows = parseNames(bytes, "bulk.csv");
  assert.equal(rows.length, 2, `${label}: two data rows`);
  assert.equal(rows[0].brand, "넘버즈인", `${label}: brand survives the parse`);
  assert.equal(rows[0].productName, "원더밤 200ml", `${label}: name survives the parse`);
  assert.equal(rows[1].brand, "설화수", `${label}: second brand survives`);
  assert.equal(rows[1].productName, "옥용팩", `${label}: second name survives`);
  assert.equal(
    rows[0].slug,
    "neombeojeuin-wondeobam-200ml",
    `${label}: slug built from the correct name`
  );
  assert.equal(
    rows[1].slug,
    "seolhwasu-okyongpaek",
    `${label}: second slug built from the correct name`
  );
  assert.ok(
    !rows.some((row) => row.productName.includes("�") || /Ã|Â|ì|ë/.test(row.productName)),
    `${label}: no mojibake in any parsed name`
  );
}

// the xlsx path must keep working through the same entry point
const xlsxRows = parseNames(xlsxBytes, "bulk.xlsx");
assert.equal(xlsxRows.length, 1, "xlsx row parsed");
assert.equal(xlsxRows[0].productName, "원더밤 200ml", "xlsx Korean name intact");

console.log("[spreadsheet-encoding] self-test: ok");

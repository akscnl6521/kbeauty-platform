/**
 * Work out how an uploaded spreadsheet is encoded before parsing it.
 *
 * The bulk importer used to hand the raw buffer to SheetJS, which defaults a CSV
 * to codepage 1252. A UTF-8 CSV containing Korean therefore arrived as mojibake —
 * "원더밤 200ml" became "ìëë°¤ 200ml" — and every downstream field, including the
 * generated slug, was built from the corrupted text.
 *
 * Forcing UTF-8 instead would break the other common case: Korean Excel writes
 * CSV as cp949 by default. So the encoding is detected rather than assumed:
 *
 *   1. a UTF-8 BOM settles it
 *   2. otherwise try a strict UTF-8 decode — invalid byte sequences throw
 *   3. if that fails the bytes are legacy Korean, so decode as cp949
 *
 * Binary workbooks (.xlsx, .xls) are never text-decoded; they carry their own
 * encoding internally and are passed through untouched.
 *
 * Pure — no network, no DB.
 */

export type SpreadsheetEncoding = "utf-8-bom" | "utf-8" | "cp949";

export type DecodedSpreadsheet =
  | { kind: "text"; text: string; encoding: SpreadsheetEncoding }
  | { kind: "binary" };

const UTF8_BOM = [0xef, 0xbb, 0xbf];
/** PK.. — zip container used by .xlsx */
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];
/** OLE compound file — legacy .xls */
const OLE_MAGIC = [0xd0, 0xcf, 0x11, 0xe0];

function startsWith(bytes: Uint8Array, magic: number[]): boolean {
  if (bytes.length < magic.length) return false;
  return magic.every((byte, index) => bytes[index] === byte);
}

export function hasUtf8Bom(bytes: Uint8Array): boolean {
  return startsWith(bytes, UTF8_BOM);
}

/** A real workbook file rather than delimited text. */
export function looksBinaryWorkbook(bytes: Uint8Array): boolean {
  return startsWith(bytes, ZIP_MAGIC) || startsWith(bytes, OLE_MAGIC);
}

/** Strict UTF-8: returns null when the bytes are not valid UTF-8. */
export function tryDecodeUtf8(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/**
 * cp949 (Unified Hangul Code). WHATWG labels this "euc-kr", and Node's decoder
 * maps that label to the full cp949 range, which is what Korean Excel writes.
 */
export function decodeCp949(bytes: Uint8Array): string {
  return new TextDecoder("euc-kr").decode(bytes);
}

/**
 * Decide the encoding of an uploaded spreadsheet and decode it.
 * Binary workbooks are reported as such so the caller passes bytes straight to
 * the workbook reader.
 */
export function decodeSpreadsheetBytes(bytes: Uint8Array): DecodedSpreadsheet {
  if (looksBinaryWorkbook(bytes)) return { kind: "binary" };

  if (hasUtf8Bom(bytes)) {
    // The BOM is metadata, not content — leaving it in would make the first
    // header cell "﻿brand" and silently break the column mapping.
    const withoutBom = bytes.subarray(UTF8_BOM.length);
    return {
      kind: "text",
      text: tryDecodeUtf8(withoutBom) ?? decodeCp949(withoutBom),
      encoding: "utf-8-bom",
    };
  }

  const asUtf8 = tryDecodeUtf8(bytes);
  if (asUtf8 !== null) return { kind: "text", text: asUtf8, encoding: "utf-8" };

  return { kind: "text", text: decodeCp949(bytes), encoding: "cp949" };
}

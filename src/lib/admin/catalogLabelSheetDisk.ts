/**
 * Disk helpers for official INCI label sheet (no Supabase client).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import type {
  OfficialInciLabelEntry,
  OfficialInciLabelSheet,
} from "@/lib/catalog/labels";
import {
  resolveEntryTokens,
  validateOfficialInciLabelSheet,
} from "@/lib/catalog/labels";
import { AdminConfigurationError } from "@/lib/auth/errors";

const SHEET_PATH = "data/catalog/labels/official-inci-sheet.v1.json";

export function loadOfficialInciSheetFromDisk(): OfficialInciLabelSheet {
  const p = path.join(process.cwd(), SHEET_PATH);
  const sheet = JSON.parse(readFileSync(p, "utf8")) as OfficialInciLabelSheet;
  const v = validateOfficialInciLabelSheet(sheet);
  if (!v.ok) {
    throw new AdminConfigurationError(
      `Invalid label sheet: ${v.issues.map((i) => i.code).join(",")}`
    );
  }
  return sheet;
}

export function entryHasTokens(entry: OfficialInciLabelEntry): boolean {
  return resolveEntryTokens(entry).length >= 3;
}

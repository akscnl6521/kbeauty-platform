import { readFileSync } from "node:fs";
import path from "node:path";
import type { OfficialInciLabelSheet } from "./types";
import { validateOfficialInciLabelSheet } from "./validateLabelSheet";

export function loadOfficialInciLabelSheet(
  filePath?: string
): OfficialInciLabelSheet {
  const resolved =
    filePath ??
    path.join(process.cwd(), "data/catalog/labels/official-inci-sheet.v1.json");
  const raw = readFileSync(resolved, "utf8");
  const sheet = JSON.parse(raw) as OfficialInciLabelSheet;
  const v = validateOfficialInciLabelSheet(sheet);
  if (!v.ok) {
    const msg = v.issues.map((i) => `${i.externalProductId ?? "-"}:${i.code}`).join("; ");
    throw new Error(`INVALID_LABEL_SHEET: ${msg}`);
  }
  return sheet;
}

export { validateOfficialInciLabelSheet, resolveEntryTokens } from "./validateLabelSheet";
export type {
  OfficialInciLabelSheet,
  OfficialInciLabelEntry,
  LabelSheetValidationResult,
} from "./types";

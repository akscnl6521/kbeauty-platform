import type {
  OfficialInciLabelSheet,
  LabelSheetValidationResult,
  OfficialInciLabelEntry,
} from "./types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SOURCE_TYPES = new Set([
  "official_brand_page",
  "official_kr_mall",
  "official_label",
  "staging_products_verified",
  "open_beauty_facts",
]);

function hasTokens(entry: OfficialInciLabelEntry): boolean {
  if (Array.isArray(entry.fullIngredients) && entry.fullIngredients.length >= 3) {
    return true;
  }
  const raw = entry.fullIngredientsRaw?.trim() ?? "";
  if (!raw) return false;
  return raw.split(/[,;|]/).map((s) => s.trim()).filter(Boolean).length >= 3;
}

/**
 * Validate sheet structure. Empty ingredients → not inventable; applyReady must be false.
 */
export function validateOfficialInciLabelSheet(
  sheet: OfficialInciLabelSheet
): LabelSheetValidationResult {
  const issues: LabelSheetValidationResult["issues"] = [];
  if (!sheet?._meta || sheet._meta.sheetVersion < 1) {
    issues.push({ code: "meta", message: "sheetVersion required (>=1)" });
  }
  if (!Array.isArray(sheet.entries)) {
    issues.push({ code: "entries", message: "entries must be an array" });
    return { ok: false, issues, applyableCount: 0 };
  }

  const seen = new Set<string>();
  let applyableCount = 0;

  for (const entry of sheet.entries) {
    const id = entry.externalProductId?.trim();
    if (!id) {
      issues.push({ code: "missing_id", message: "externalProductId required" });
      continue;
    }
    if (seen.has(id)) {
      issues.push({
        externalProductId: id,
        code: "duplicate_id",
        message: "duplicate externalProductId",
      });
    }
    seen.add(id);

    if (!entry.brandCanonical?.trim()) {
      issues.push({
        externalProductId: id,
        code: "brand",
        message: "brandCanonical required",
      });
    }
    if (!SOURCE_TYPES.has(entry.sourceType)) {
      issues.push({
        externalProductId: id,
        code: "source_type",
        message: `invalid sourceType: ${entry.sourceType}`,
      });
    }
    if (!/^https:\/\//i.test(entry.sourceUrl ?? "")) {
      issues.push({
        externalProductId: id,
        code: "source_url",
        message: "sourceUrl must be https",
      });
    }
    if (!DATE_RE.test(entry.labelCheckedAt ?? "")) {
      issues.push({
        externalProductId: id,
        code: "checked_at",
        message: "labelCheckedAt must be YYYY-MM-DD",
      });
    }

    const tokensOk = hasTokens(entry);
    if (entry.applyReady) {
      if (!tokensOk) {
        issues.push({
          externalProductId: id,
          code: "empty_inci",
          message:
            "applyReady=true but ingredients missing/too short — refuse invent",
        });
      } else {
        applyableCount += 1;
      }
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    applyableCount,
  };
}

export function resolveEntryTokens(entry: OfficialInciLabelEntry): string[] {
  if (Array.isArray(entry.fullIngredients) && entry.fullIngredients.length > 0) {
    return entry.fullIngredients.map((s) => s.trim()).filter(Boolean);
  }
  return (entry.fullIngredientsRaw ?? "")
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

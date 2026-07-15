/**
 * Curated INCI label sheet selftest (no network / no Staging writes).
 */
import assert from "node:assert/strict";
import {
  validateOfficialInciLabelSheet,
  resolveEntryTokens,
  type OfficialInciLabelSheet,
} from "@/lib/catalog/labels";
import { evidenceSlugsFromIngredients } from "@/lib/catalog/labels/evidenceFromIngredients";

function main() {
  const emptyReady: OfficialInciLabelSheet = {
    _meta: {
      sheetVersion: 1,
      rule: "never invent",
      sprintTagDefault: "full-beauty-20260714",
    },
    entries: [
      {
        externalProductId: "x",
        brandCanonical: "COSRX",
        sourceType: "official_brand_page",
        sourceUrl: "https://www.cosrx.com/products/x",
        labelCheckedAt: "2026-07-15",
        labelLanguage: "en",
        fullIngredientsRaw: "",
        applyReady: true,
      },
    ],
  };
  const bad = validateOfficialInciLabelSheet(emptyReady);
  assert.equal(bad.ok, false);
  assert.ok(bad.issues.some((i) => i.code === "empty_inci"));

  const good: OfficialInciLabelSheet = {
    _meta: {
      sheetVersion: 1,
      rule: "never invent",
      sprintTagDefault: "full-beauty-20260714",
    },
    entries: [
      {
        externalProductId: "cosrx-advanced-snail-92-all-in-one-cream",
        brandCanonical: "COSRX",
        sourceType: "official_brand_page",
        sourceUrl: "https://www.cosrx.com/products/advanced-snail-92-all-in-one-cream",
        labelCheckedAt: "2026-07-14",
        labelLanguage: "en",
        fullIngredientsRaw:
          "Snail Secretion Filtrate, Betaine, Caprylic/Capric Triglyceride, Butylene Glycol",
        fullIngredients: [
          "Snail Secretion Filtrate",
          "Betaine",
          "Caprylic/Capric Triglyceride",
          "Butylene Glycol",
        ],
        applyReady: true,
      },
    ],
  };
  const ok = validateOfficialInciLabelSheet(good);
  assert.equal(ok.ok, true);
  assert.equal(ok.applyableCount, 1);
  assert.ok(resolveEntryTokens(good.entries[0]!).length >= 3);
  assert.ok(
    evidenceSlugsFromIngredients(good.entries[0]!.fullIngredients!).includes(
      "snail-mucin"
    )
  );

  console.log(JSON.stringify({ ok: true }));
}

main();

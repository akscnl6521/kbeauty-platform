/**
 * Curated official INCI label sheet — paste only verified label/PDP lists.
 * Never invent ingredients.
 */

export type OfficialInciLabelEntry = {
  externalProductId: string;
  brandCanonical: string;
  productNameEn?: string;
  sourceType:
    | "official_brand_page"
    | "official_kr_mall"
    | "official_label"
    | "staging_products_verified"
    | "open_beauty_facts";
  sourceUrl: string;
  labelCheckedAt: string; // YYYY-MM-DD
  labelLanguage: "en" | "ko" | "mixed";
  /** Verbatim full list as copied from source */
  fullIngredientsRaw: string;
  /** Optional pre-split tokens; if empty, parser splits raw */
  fullIngredients?: string[];
  notes?: string;
  applyReady: boolean;
};

export type OfficialInciLabelSheet = {
  _meta: {
    sheetVersion: number;
    rule: string;
    sprintTagDefault: string;
    builtAt?: string;
    sourcesNote?: string;
  };
  entries: OfficialInciLabelEntry[];
};

export type LabelSheetValidationIssue = {
  externalProductId?: string;
  code: string;
  message: string;
};

export type LabelSheetValidationResult = {
  ok: boolean;
  issues: LabelSheetValidationIssue[];
  applyableCount: number;
};

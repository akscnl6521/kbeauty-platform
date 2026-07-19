export type CatalogRefreshInput = {
  disposition: "auto_register" | "needs_review" | "duplicate" | "failed";
  officialSourceConfirmed: boolean;
  hasFullInci: boolean;
  hasImage: boolean;
  hasRetailer: boolean;
};

export type CatalogRefreshPlan = {
  intervalDays: number;
  nextCheckAt: string;
  priority: "urgent" | "high" | "normal" | "low";
  checks: Array<"official_page" | "image" | "full_inci" | "retailer" | "stock_price">;
  reasons: string[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function getCatalogRefreshPlan(
  input: CatalogRefreshInput,
  now = new Date()
): CatalogRefreshPlan {
  const checks: CatalogRefreshPlan["checks"] = ["official_page"];
  const reasons: string[] = [];

  if (!input.hasImage) {
    checks.push("image");
    reasons.push("image_missing");
  }
  if (!input.hasFullInci) {
    checks.push("full_inci");
    reasons.push("full_inci_missing");
  }
  if (!input.hasRetailer) {
    checks.push("retailer");
    reasons.push("retailer_missing");
  } else {
    checks.push("stock_price");
  }
  if (!input.officialSourceConfirmed) {
    reasons.push("official_source_unconfirmed");
  }

  let intervalDays = 30;
  let priority: CatalogRefreshPlan["priority"] = "normal";

  if (input.disposition === "failed") {
    intervalDays = 1;
    priority = "urgent";
    reasons.push("processing_failed");
  } else if (
    input.disposition === "needs_review" ||
    !input.officialSourceConfirmed
  ) {
    intervalDays = 3;
    priority = "high";
  } else if (!input.hasFullInci || !input.hasImage || !input.hasRetailer) {
    intervalDays = 7;
    priority = "high";
  } else if (input.disposition === "duplicate") {
    intervalDays = 90;
    priority = "low";
    reasons.push("duplicate_watch_only");
  }

  return {
    intervalDays,
    nextCheckAt: new Date(now.getTime() + intervalDays * DAY_MS).toISOString(),
    priority,
    checks: [...new Set(checks)],
    reasons: [...new Set(reasons)],
  };
}

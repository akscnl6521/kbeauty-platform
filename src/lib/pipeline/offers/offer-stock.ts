/**
 * Stock status mapping to product_offers CHECK values.
 */

export type SchemaStockStatus = "in_stock" | "out_of_stock" | "unknown";

export type StockParseResult = {
  stockStatus: SchemaStockStatus;
  logicalStatus:
    | "in_stock"
    | "out_of_stock"
    | "preorder"
    | "backorder"
    | "limited"
    | "unknown"
    | "discontinued";
  confidence: number;
  reasons: string[];
};

export function parseStockStatus(input: {
  availability?: string | null;
  buttonText?: string | null;
  pageText?: string | null;
}): StockParseResult {
  const text = [
    input.availability,
    input.buttonText,
    input.pageText?.slice(0, 2000),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const reasons: string[] = [];

  if (/discontinued|단종|販売終了/i.test(text)) {
    reasons.push("discontinued_signal");
    return {
      stockStatus: "out_of_stock",
      logicalStatus: "discontinued",
      confidence: 0.8,
      reasons,
    };
  }
  if (
    /outofstock|out.?of.?stock|sold\s*out|품절|재고\s*없음|instock.?false/i.test(
      text
    )
  ) {
    reasons.push("out_of_stock_signal");
    return {
      stockStatus: "out_of_stock",
      logicalStatus: "out_of_stock",
      confidence: 0.85,
      reasons,
    };
  }
  if (/preorder|pre-order|예약\s*판매/i.test(text)) {
    reasons.push("preorder_signal");
    // Schema has no preorder — store as unknown (not verified in_stock)
    return {
      stockStatus: "unknown",
      logicalStatus: "preorder",
      confidence: 0.7,
      reasons,
    };
  }
  if (/backorder|입고\s*대기/i.test(text)) {
    reasons.push("backorder_signal");
    return {
      stockStatus: "unknown",
      logicalStatus: "backorder",
      confidence: 0.65,
      reasons,
    };
  }
  if (
    /Instock|InStock|in.?stock|https?:\/\/schema\.org\/InStock/i.test(
      input.availability ?? ""
    ) ||
    /https?:\/\/schema\.org\/InStock/i.test(text)
  ) {
    reasons.push("schema_instock");
    return {
      stockStatus: "in_stock",
      logicalStatus: "in_stock",
      confidence: 0.9,
      reasons,
    };
  }
  // Button alone is NOT enough for in_stock
  if (/add\s*to\s*cart|buy\s*now|장바구니|구매하기/i.test(input.buttonText ?? "")) {
    reasons.push("button_only_insufficient");
    return {
      stockStatus: "unknown",
      logicalStatus: "unknown",
      confidence: 0.35,
      reasons,
    };
  }

  reasons.push("stock_unknown");
  return {
    stockStatus: "unknown",
    logicalStatus: "unknown",
    confidence: 0.2,
    reasons,
  };
}

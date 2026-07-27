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

/**
 * Cafe24(국내 쇼핑몰 다수가 쓰는 플랫폼)가 서버에서 렌더링하는 품절 상태를 읽는다.
 *
 * Cafe24 는 품절 배지와 구매 버튼을 **둘 다 항상 마크업에 넣고**, 어느 쪽을
 * 숨길지 `displaynone` 클래스로 표시한다. 그래서 «sold out» 이라는 낱말이
 * 페이지에 있다는 사실만으로는 품절인지 알 수 없다 — 판매 중인 상품에도
 * 그 낱말은 들어 있다. 반대로 낱말이 없다고 재고가 있는 것도 아니다.
 *
 * 2026-07-27 lador.co.kr 에서 판매중/품절 상품을 직접 대조해 확인한 형태:
 *
 *   판매중 (id 414): <span class="button sold-out displaynone">Soldout</span>
 *   품절   (id 104): <span class="button sold-out">Soldout</span>   + 구매 버튼 숨김
 *
 * 버튼이 있다는 것만으로 재고를 단정하지 않는 기존 방침(§5-3)은 그대로다.
 * 여기서 읽는 것은 버튼의 존재가 아니라 **플랫폼이 명시한 품절 플래그**다.
 */
export function parseCafe24StockSignal(html: string | null | undefined): {
  stockStatus: SchemaStockStatus;
  confidence: number;
  reasons: string[];
} | null {
  if (!html) return null;

  const soldOutClasses = [
    ...html.matchAll(
      /<(?:span|div|button)[^>]*\bclass="([^"]*(?:sold-?out|sub_sold)[^"]*)"[^>]*>/gi
    ),
  ].map((m) => m[1]!);

  // Cafe24 특유의 마크업이 없으면 이 판독기가 할 말은 없다.
  if (soldOutClasses.length === 0) return null;

  const visibleSoldOut = soldOutClasses.filter((c) => !/\bdisplaynone\b/.test(c));
  if (visibleSoldOut.length > 0) {
    return {
      stockStatus: "out_of_stock",
      confidence: 0.85,
      reasons: ["cafe24_soldout_badge_visible"],
    };
  }

  // 품절 배지가 전부 숨겨져 있다 = 플랫폼이 «품절 아님» 을 렌더링한 것.
  return {
    stockStatus: "in_stock",
    confidence: 0.8,
    reasons: ["cafe24_soldout_badge_hidden"],
  };
}

export function parseStockStatus(input: {
  availability?: string | null;
  buttonText?: string | null;
  pageText?: string | null;
  /** Cafe24 상세 페이지 원문. 있으면 스키마 다음가는 근거로 쓴다. */
  pageHtml?: string | null;
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
  // 원문 HTML 이 있으면 낱말 검색보다 먼저 구조를 읽는다. Cafe24 는 판매중인
  // 상품에도 «sold out» 문자열을 숨겨서 넣어두기 때문에, 아래 낱말 검사보다
  // 이쪽이 먼저 와야 판매중인 상품을 품절로 오판하지 않는다.
  const cafe24 = parseCafe24StockSignal(input.pageHtml);
  if (cafe24) {
    return {
      stockStatus: cafe24.stockStatus,
      logicalStatus: cafe24.stockStatus === "in_stock" ? "in_stock" : "out_of_stock",
      confidence: cafe24.confidence,
      reasons: [...reasons, ...cafe24.reasons],
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

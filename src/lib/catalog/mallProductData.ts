/**
 * 국내 공식몰 제품 페이지의 **JSON-LD 파싱**과 그 값에 대한 판단.
 *
 * 수집 스크립트 안에 있던 것을 옮겼다. 여기 담긴 규칙들이 «틀린 값이 화면에 나가는
 * 것»을 막는 마지막 방어선인데 테스트가 없었다. 스크립트 안에 있으면
 * `tsconfig` 가 `scripts/` 를 제외하므로 타입 검사도 회귀 테스트도 못 받는다.
 *
 * 2026-08-04 실측에서 몰마다 다른 함정이 나왔다:
 *
 *   라네즈      모든 제품 가격이 `100` — 자리표시다
 *   Abib       이름에 HTML 이 섞여 온다 (`크림<br /> <strong>워터 튜브</strong>`)
 *   Round Lab  `availability` 필드를 아예 안 준다
 */

/** 화장품 소매가로 말이 되는 최소값 (원). 이보다 싸면 자리표시로 본다. */
export const MIN_PLAUSIBLE_KRW = 1000;

/** 몰 전체를 버리는 기준 — 가격의 이 비율을 넘게 자리표시면 그 몰은 못 쓴다. */
export const PLACEHOLDER_RATIO_MAX = 0.5;

export type MallProduct = {
  name: string;
  price: number;
  currency: string;
  /** `availability` 가 명시적으로 InStock 일 때만 참 */
  inStock: boolean;
};

/**
 * JSON-LD `name` 에서 HTML 을 걷어낸다.
 *
 * 태그를 **공백으로** 바꾼다 — 빈 문자열로 지우면 `크림<br />워터` 가 `크림워터` 로
 * 붙어 낱말 경계가 사라진다.
 */
export function cleanMallProductName(raw: string | null | undefined): string {
  return String(raw ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 제품 페이지 HTML 에서 JSON-LD `Product` 를 찾아 이름·가격·재고를 뽑는다.
 *
 * **`availability` 가 없으면 재고 있음으로 보지 않는다.** 없는 정보를 유리하게
 * 해석하면 품절 제품에 구매 버튼이 붙는다.
 */
export function parseMallProductJsonLd(html: string): MallProduct | null {
  const blocks = [...String(html ?? "").matchAll(
    /<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi
  )].map((m) => m[1]);

  for (const raw of blocks) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    const nodes = Array.isArray(parsed) ? parsed : [parsed];
    for (const n of nodes) {
      const node = n as Record<string, unknown>;
      if (node["@type"] !== "Product") continue;

      const name = cleanMallProductName(String(node.name ?? ""));
      const offersRaw = node.offers;
      const offer = (Array.isArray(offersRaw) ? offersRaw[0] : offersRaw) as
        | Record<string, unknown>
        | undefined;
      if (!name || !offer) continue;

      const price = Number(offer.price);
      if (!Number.isFinite(price) || price <= 0) continue;

      const availability = String(offer.availability ?? "");
      return {
        name,
        price,
        currency: String(offer.priceCurrency ?? "").toUpperCase(),
        inStock: /InStock/i.test(availability) && !/OutOfStock/i.test(availability),
      };
    }
  }
  return null;
}

/**
 * 이 몰의 가격을 믿을 수 있는가.
 *
 * 라네즈 몰은 **모든** 제품 가격을 `100` 으로 준다. 한두 건만 걸러내면 나머지 틀린
 * 값이 그대로 들어가므로, 자리표시가 절반을 넘으면 **몰 전체를 버린다.**
 *
 * 표본이 너무 적으면 판단하지 않는다 — 제품 두세 개짜리 몰에서 하나가 싸다고
 * 몰 전체를 버릴 이유는 없다.
 */
export function mallPricesLookLikePlaceholders(items: readonly MallProduct[]): boolean {
  const krw = items.filter((i) => i.currency === "KRW");
  if (krw.length < 5) return false;
  const cheap = krw.filter((i) => i.price < MIN_PLAUSIBLE_KRW).length;
  return cheap / krw.length > PLACEHOLDER_RATIO_MAX;
}

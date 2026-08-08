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
  /** JSON-LD `image` 의 첫 장. 국내몰은 공식 제품 사진을 여기 싣는다. */
  imageUrl: string | null;
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
      const rawImage = node.image;
      const firstImage = Array.isArray(rawImage) ? rawImage[0] : rawImage;
      const imageUrl =
        typeof firstImage === "string" && /^https?:\/\//i.test(firstImage) ? firstImage : null;

      return {
        name,
        price,
        currency: String(offer.priceCurrency ?? "").toUpperCase(),
        inStock: /InStock/i.test(availability) && !/OutOfStock/i.test(availability),
        imageUrl,
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

/**
 * 제품 페이지의 **대표 이미지**를 뽑는다.
 *
 * JSON-LD 에 `image` 가 없는 몰이 있다 — 달바(고도몰)가 그렇다. 그런 곳도
 * `og:image` 는 제품별로 다르게 넣어 둔다(URL 에 상품번호가 들어간다).
 *
 * ## 여기서 판정하지 않는 것
 *
 * `og:image` 는 **사이트 공통 로고**일 수도 있다. 그건 이 함수만 보고는 알 수
 * 없다 — 여러 제품에서 같은 URL 이 나오는지 봐야 알 수 있고, 그 판정은
 * 부르는 쪽(`dropSiteWideImages`)이 한다. 여기서는 «이 페이지가 내세우는
 * 이미지» 만 돌려준다.
 */
export function extractProductImageUrl(html: string): string | null {
  const patterns: readonly RegExp[] = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /"image"\s*:\s*\[\s*"([^"]+)"/,
    /"image"\s*:\s*"([^"]+)"/,
  ];
  for (const re of patterns) {
    const m = String(html ?? "").match(re);
    const url = m?.[1]?.trim();
    if (url && /^https?:\/\//i.test(url)) return url;
  }
  return null;
}

/**
 * **여러 제품이 같은 이미지를 가리키면 전부 버린다.**
 *
 * 사이트 공통 로고나 «준비 중» 자리표시를 `og:image` 로 내는 몰이 있다. 그걸
 * 그대로 담으면 화면에서 서로 다른 제품이 같은 그림을 달고 나오고, 그건 없는
 * 것보다 나쁘다 — 사용자가 «이 사이트는 엉터리» 라고 판단하게 된다.
 *
 * 한 제품에만 쓰인 이미지는 그 제품 것으로 본다.
 */
export function dropSiteWideImages<T extends { imageUrl: string }>(items: readonly T[]): {
  kept: T[];
  dropped: Array<{ imageUrl: string; count: number }>;
} {
  const byUrl = new Map<string, T[]>();
  for (const it of items) {
    const bucket = byUrl.get(it.imageUrl) ?? [];
    bucket.push(it);
    byUrl.set(it.imageUrl, bucket);
  }
  const kept: T[] = [];
  const dropped: Array<{ imageUrl: string; count: number }> = [];
  for (const [url, bucket] of byUrl) {
    if (bucket.length === 1) kept.push(bucket[0]);
    else dropped.push({ imageUrl: url, count: bucket.length });
  }
  return { kept, dropped };
}

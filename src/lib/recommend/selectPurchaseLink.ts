import type { CandidateProduct } from "./types";

/** selectPurchaseLink 반환값 */
export type PurchaseLinkSelection = {
  url: string;
  /** 사용자에게 보여줄 마켓 이름 (URL 원문 비표시) */
  marketplace: string;
};

type LinkField =
  | "link_sephora"
  | "link_amazon_us"
  | "link_amazon_jp"
  | "link_qoo10"
  | "link_oliveyoung"
  | "link_coupang"
  | "link_yesstyle";

type PriorityEntry = {
  field: LinkField;
  marketplace: string;
};

/** 국가별 우선순위 (요청 스펙) */
const PRIORITY_BY_COUNTRY: Record<string, PriorityEntry[]> = {
  KR: [
    { field: "link_sephora", marketplace: "Sephora" },
    { field: "link_yesstyle", marketplace: "YesStyle" },
    { field: "link_amazon_us", marketplace: "Amazon US" },
    { field: "link_qoo10", marketplace: "Qoo10" },
  ],
  US: [
    { field: "link_amazon_us", marketplace: "Amazon US" },
    { field: "link_yesstyle", marketplace: "YesStyle" },
    { field: "link_sephora", marketplace: "Sephora" },
  ],
  JP: [
    { field: "link_amazon_jp", marketplace: "Amazon JP" },
    { field: "link_qoo10", marketplace: "Qoo10" },
    { field: "link_yesstyle", marketplace: "YesStyle" },
  ],
};

/** 알 수 없는 국가용 폴백 순서 */
const DEFAULT_PRIORITY: PriorityEntry[] = [
  { field: "link_amazon_us", marketplace: "Amazon US" },
  { field: "link_yesstyle", marketplace: "YesStyle" },
  { field: "link_sephora", marketplace: "Sephora" },
  { field: "link_amazon_jp", marketplace: "Amazon JP" },
  { field: "link_qoo10", marketplace: "Qoo10" },
  { field: "link_oliveyoung", marketplace: "Olive Young" },
  { field: "link_coupang", marketplace: "Coupang" },
];

function isValidHttpUrl(value: string | null | undefined): value is string {
  if (!value || typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    const u = new URL(trimmed);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * 국가 코드에 맞는 구매 링크를 고른다.
 * LocalStorage countryCode (KR/US/JP 등) 를 그대로 넘겨 사용한다.
 *
 * @returns { url, marketplace } 또는 유효 링크 없으면 null
 */
export function selectPurchaseLink(
  product: CandidateProduct,
  countryCode: string | null | undefined
): PurchaseLinkSelection | null {
  const code = (countryCode ?? "").trim().toUpperCase();
  const priority =
    code && PRIORITY_BY_COUNTRY[code]
      ? PRIORITY_BY_COUNTRY[code]
      : DEFAULT_PRIORITY;

  for (const entry of priority) {
    const raw = product[entry.field];
    if (isValidHttpUrl(raw)) {
      return { url: raw.trim(), marketplace: entry.marketplace };
    }
  }

  return null;
}

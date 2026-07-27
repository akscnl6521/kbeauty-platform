/**
 * 수익 원장 집계 — `commercial_click_events` 를 관리자 화면이 읽을 수 있는
 * 형태로 요약한다.
 *
 * 지금까지 `/admin/commerce` 는 메모리 픽스처만 봤고, 실제로 적재되는
 * `commercial_click_events` 는 아무도 읽지 않았다. 테이블에는 `revenue_amount`
 * 와 `currency` 가 이미 있는데 합산하는 곳이 없었다.
 *
 * 집계 규칙 — 없는 것을 만들지 않는다:
 *
 *   - **통화가 다르면 더하지 않는다.** KRW 와 USD 를 합친 숫자는 아무 의미가
 *     없다. 통화별로 나눠 보여주고, 환산은 하지 않는다(환율을 지어내는 셈이다).
 *   - **`revenue_amount` 가 비어 있으면 0 이 아니라 «미기록» 이다.** 전환은
 *     일어났는데 금액이 안 들어온 건과, 금액이 0 인 건은 다르다.
 *   - 비율은 분모가 0 이면 `null` 이다. 0% 로 보여주면 «전환이 없었다» 로
 *     읽히지만 실제로는 «노출 자체가 없었다» 이다.
 *   - Organic 은 여기에 없다. 이 표는 유료 레인(affiliate·sponsored)만 센다
 *     (§39.1 — 유료 관계가 Organic 점수에 들어가지 않는다).
 */

export type CommercialEventKind = "impression" | "click" | "lead" | "conversion";
export type CommercialLane = "affiliate" | "sponsored";

export type CommercialEventRow = {
  kind: string;
  lane: string;
  entityType: string;
  countryCode: string | null;
  revenueAmount: number | null;
  currency: string | null;
  createdAt: string;
};

export type LaneFunnel = {
  lane: CommercialLane;
  impressions: number;
  clicks: number;
  leads: number;
  conversions: number;
  /** 노출 대비 클릭. 노출이 0 이면 null (0% 가 아니다). */
  clickThroughRate: number | null;
  /** 클릭 대비 전환. 클릭이 0 이면 null. */
  conversionRate: number | null;
};

export type CurrencyTotal = {
  currency: string;
  amount: number;
  eventCount: number;
};

export type RevenueLedgerSummary = {
  totalEvents: number;
  byKind: Record<CommercialEventKind, number>;
  lanes: LaneFunnel[];
  /** 통화별 합계. 서로 다른 통화를 합치지 않는다. */
  revenueByCurrency: CurrencyTotal[];
  /** 금액이 기록되지 않은 전환·리드 수. 0 원과 구분한다. */
  amountMissingCount: number;
  byCountry: Array<{ countryCode: string; events: number; conversions: number }>;
  firstEventAt: string | null;
  lastEventAt: string | null;
};

const KINDS: CommercialEventKind[] = ["impression", "click", "lead", "conversion"];
const LANES: CommercialLane[] = ["affiliate", "sponsored"];

function isKind(v: string): v is CommercialEventKind {
  return (KINDS as string[]).includes(v);
}

function ratio(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return numerator / denominator;
}

export function summarizeRevenueLedger(
  rows: readonly CommercialEventRow[]
): RevenueLedgerSummary {
  const byKind: Record<CommercialEventKind, number> = {
    impression: 0,
    click: 0,
    lead: 0,
    conversion: 0,
  };
  const laneCounts = new Map<string, Record<CommercialEventKind, number>>();
  const currencyTotals = new Map<string, { amount: number; eventCount: number }>();
  const countryCounts = new Map<string, { events: number; conversions: number }>();

  let amountMissingCount = 0;
  let firstEventAt: string | null = null;
  let lastEventAt: string | null = null;

  for (const row of rows) {
    if (isKind(row.kind)) byKind[row.kind] += 1;

    if (!laneCounts.has(row.lane))
      laneCounts.set(row.lane, { impression: 0, click: 0, lead: 0, conversion: 0 });
    if (isKind(row.kind)) laneCounts.get(row.lane)![row.kind] += 1;

    // 금액은 통화가 함께 있을 때만 센다. 통화 없는 숫자는 어느 돈인지 모른다.
    if (row.revenueAmount != null && Number.isFinite(row.revenueAmount) && row.currency) {
      const cur = row.currency.toUpperCase();
      const prev = currencyTotals.get(cur) ?? { amount: 0, eventCount: 0 };
      currencyTotals.set(cur, {
        amount: prev.amount + row.revenueAmount,
        eventCount: prev.eventCount + 1,
      });
    } else if (row.kind === "conversion" || row.kind === "lead") {
      // 돈이 오갔어야 할 사건인데 금액이 없다. 0 으로 세면 «수익 0» 으로 읽힌다.
      amountMissingCount += 1;
    }

    const country = (row.countryCode ?? "").trim().toUpperCase();
    if (country) {
      const prev = countryCounts.get(country) ?? { events: 0, conversions: 0 };
      countryCounts.set(country, {
        events: prev.events + 1,
        conversions: prev.conversions + (row.kind === "conversion" ? 1 : 0),
      });
    }

    if (row.createdAt) {
      if (!firstEventAt || row.createdAt < firstEventAt) firstEventAt = row.createdAt;
      if (!lastEventAt || row.createdAt > lastEventAt) lastEventAt = row.createdAt;
    }
  }

  const lanes: LaneFunnel[] = LANES.map((lane) => {
    const c = laneCounts.get(lane) ?? { impression: 0, click: 0, lead: 0, conversion: 0 };
    return {
      lane,
      impressions: c.impression,
      clicks: c.click,
      leads: c.lead,
      conversions: c.conversion,
      clickThroughRate: ratio(c.click, c.impression),
      conversionRate: ratio(c.conversion, c.click),
    };
  });

  return {
    totalEvents: rows.length,
    byKind,
    lanes,
    revenueByCurrency: [...currencyTotals.entries()]
      .map(([currency, v]) => ({ currency, amount: v.amount, eventCount: v.eventCount }))
      .sort((a, b) => b.amount - a.amount),
    amountMissingCount,
    byCountry: [...countryCounts.entries()]
      .map(([countryCode, v]) => ({ countryCode, ...v }))
      .sort((a, b) => b.events - a.events),
    firstEventAt,
    lastEventAt,
  };
}

/** 화면 표기용. 통화를 섞어 «합계» 를 만들지 않는다. */
export function formatCurrencyTotal(total: CurrencyTotal): string {
  const n = new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: total.currency === "KRW" ? 0 : 2,
  }).format(total.amount);
  return `${n} ${total.currency}`;
}

export function formatRate(rate: number | null): string {
  // 분모가 없으면 «—». 0% 로 적으면 «시도했는데 전환이 없었다» 로 읽힌다.
  if (rate == null) return "—";
  return `${(rate * 100).toFixed(1)}%`;
}

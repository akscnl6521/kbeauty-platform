/**
 * 수익 원장 집계 규칙 고정.
 *
 * 돈을 다루는 표라서, 틀린 숫자보다 «모른다» 가 낫다. 여기서 고정하는 것은
 * 주로 **집계하지 않는 경우** 다 — 통화가 다르면 안 더하고, 금액이 없으면
 * 0 으로 세지 않고, 분모가 없으면 0% 라고 하지 않는다.
 */
import assert from "node:assert/strict";
import {
  formatRate,
  summarizeRevenueLedger,
  type CommercialEventRow,
} from "../src/lib/commercial/revenueLedger";

const row = (o: Partial<CommercialEventRow>): CommercialEventRow => ({
  kind: "click",
  lane: "affiliate",
  entityType: "product",
  countryCode: "KR",
  revenueAmount: null,
  currency: null,
  createdAt: "2026-07-27T00:00:00Z",
  ...o,
});

// --- 통화를 섞지 않는다 -------------------------------------------------

{
  const s = summarizeRevenueLedger([
    row({ kind: "conversion", revenueAmount: 10000, currency: "KRW" }),
    row({ kind: "conversion", revenueAmount: 5000, currency: "KRW" }),
    row({ kind: "conversion", revenueAmount: 12, currency: "USD" }),
  ]);
  assert.equal(s.revenueByCurrency.length, 2, "KRW 와 USD 는 따로 센다");
  const krw = s.revenueByCurrency.find((x) => x.currency === "KRW");
  const usd = s.revenueByCurrency.find((x) => x.currency === "USD");
  assert.equal(krw?.amount, 15000);
  assert.equal(usd?.amount, 12);
  // 15012 같은 «합계» 는 존재하면 안 된다.
  assert.equal(
    s.revenueByCurrency.some((x) => x.amount === 15012),
    false
  );
}

// --- 금액 없음은 0 원이 아니다 -------------------------------------------

{
  const s = summarizeRevenueLedger([
    row({ kind: "conversion", revenueAmount: null, currency: null }),
    row({ kind: "lead", revenueAmount: null, currency: null }),
    row({ kind: "conversion", revenueAmount: 0, currency: "KRW" }),
  ]);
  assert.equal(s.amountMissingCount, 2, "금액 미기록은 따로 센다");
  const krw = s.revenueByCurrency.find((x) => x.currency === "KRW");
  assert.equal(krw?.amount, 0, "0 원은 실제로 기록된 0 이다");
  assert.equal(krw?.eventCount, 1);
}

{
  // 통화 없는 금액은 어느 돈인지 모르므로 합계에 넣지 않는다.
  const s = summarizeRevenueLedger([row({ kind: "conversion", revenueAmount: 9999, currency: null })]);
  assert.equal(s.revenueByCurrency.length, 0);
  assert.equal(s.amountMissingCount, 1);
}

// --- 분모가 없으면 비율은 null ------------------------------------------

{
  const s = summarizeRevenueLedger([]);
  const affiliate = s.lanes.find((l) => l.lane === "affiliate")!;
  assert.equal(affiliate.clickThroughRate, null, "노출 0 이면 CTR 은 0% 가 아니라 «모름»");
  assert.equal(affiliate.conversionRate, null);
  assert.equal(formatRate(null), "—");
  assert.equal(s.totalEvents, 0);
}

{
  const s = summarizeRevenueLedger([
    row({ kind: "impression" }),
    row({ kind: "impression" }),
    row({ kind: "impression" }),
    row({ kind: "impression" }),
    row({ kind: "click" }),
  ]);
  const affiliate = s.lanes.find((l) => l.lane === "affiliate")!;
  assert.equal(affiliate.clickThroughRate, 0.25);
  assert.equal(formatRate(0.25), "25.0%");
  // 클릭이 있었는데 전환이 없었다면 0% 가 맞다 — «모름» 과 구분되는 사실이다.
  assert.equal(affiliate.conversionRate, 0);
  assert.equal(formatRate(0), "0.0%");
}

// --- 레인은 항상 둘 다 나온다 (없으면 «없다» 를 보여줘야 한다) -----------

{
  const s = summarizeRevenueLedger([row({ lane: "affiliate", kind: "click" })]);
  assert.deepEqual(
    s.lanes.map((l) => l.lane),
    ["affiliate", "sponsored"]
  );
  assert.equal(s.lanes.find((l) => l.lane === "sponsored")!.clicks, 0);
}

// --- 국가·기간 ----------------------------------------------------------

{
  const s = summarizeRevenueLedger([
    row({ countryCode: "kr", createdAt: "2026-07-01T00:00:00Z" }),
    row({ countryCode: "KR", kind: "conversion", createdAt: "2026-07-20T00:00:00Z" }),
    row({ countryCode: null, createdAt: "2026-07-10T00:00:00Z" }),
  ]);
  const kr = s.byCountry.find((c) => c.countryCode === "KR");
  assert.equal(kr?.events, 2, "대소문자가 달라도 같은 국가다");
  assert.equal(kr?.conversions, 1);
  assert.equal(s.byCountry.length, 1, "국가 없는 건은 국가별 표에 넣지 않는다");
  assert.equal(s.firstEventAt, "2026-07-01T00:00:00Z");
  assert.equal(s.lastEventAt, "2026-07-20T00:00:00Z");
}

// --- 알 수 없는 kind 는 조용히 세지 않는다 -------------------------------

{
  const s = summarizeRevenueLedger([row({ kind: "bogus" })]);
  assert.equal(s.totalEvents, 1);
  assert.equal(s.byKind.click + s.byKind.impression + s.byKind.lead + s.byKind.conversion, 0);
}

console.log("revenue ledger selftest: ok");

// --- §38.8 지표 커버리지 -----------------------------------------------

import {
  METRIC_SOURCES,
  resolveMetricCoverage,
  summarizeCoverage,
} from "../src/lib/commercial/revenueMetricCoverage";

{
  // 적재처가 없으면 «수집 안 함». 0 으로 세면 «측정했더니 0» 이 되어 거짓이다.
  const rows = resolveMetricCoverage(new Map([["commercial_click_events", 0]]));
  const clicks = rows.find((r) => r.metric === "제품 클릭률")!;
  assert.equal(clicks.status, "empty");
  assert.equal(clicks.count, 0);

  const clinic = rows.find((r) => r.metric === "병원 리드")!;
  assert.equal(clinic.status, "uninstrumented", "테이블이 없으면 0 이 아니라 «수집 안 함»");
  assert.equal(clinic.count, null, "건수를 0 으로 채우지 않는다");
}

{
  const rows = resolveMetricCoverage(
    new Map([
      ["commercial_click_events", 12],
      ["care_check_ins", 0],
    ])
  );
  assert.equal(rows.find((r) => r.metric === "구매 전환율")!.status, "collected");
  assert.equal(rows.find((r) => r.metric === "3·7·15·30일 응답률")!.status, "empty");
  const s = summarizeCoverage(rows);
  assert.equal(s.collected + s.empty + s.uninstrumented, METRIC_SOURCES.length);
  assert.ok(s.uninstrumented > 0, "아직 수집하지 않는 지표가 있다는 사실이 드러나야 한다");
}

console.log("metric coverage selftest: ok");

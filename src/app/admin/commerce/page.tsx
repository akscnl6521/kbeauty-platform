import Link from "next/link";
import { requireAdminUser } from "@/lib/auth/admin";
import { AdminSubnav } from "@/app/admin/AdminSubnav";
import { summarizeCommerceAnalytics } from "@/lib/commercial/commerceAnalytics";
import {
  buildAffiliateAdminSummary,
  listAffiliateLinks,
} from "@/lib/commercial/commerceStore";
import { resolveAdSlot } from "@/lib/commercial/adSlotPolicy";
import { COMMERCE_LANE_LABELS_KO } from "@/lib/commercial/commerceLabels";
import {
  loadMetricSourceCounts,
  loadRevenueLedgerSummary,
} from "@/lib/commercial/revenueLedgerStore";
import { formatCurrencyTotal, formatRate } from "@/lib/commercial/revenueLedger";
import {
  METRIC_STATUS_LABEL_KO,
  resolveMetricCoverage,
  summarizeCoverage,
} from "@/lib/commercial/revenueMetricCoverage";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "상업 분리 검수 | K-Beauty Match Admin",
};

export default async function AdminCommercePage() {
  await requireAdminUser();
  const summary = buildAffiliateAdminSummary();
  const links = listAffiliateLinks().slice(0, 30);
  const analytics = summarizeCommerceAnalytics();
  const organicSlot = resolveAdSlot("organic_recommendation");
  const sponsoredSlot = resolveAdSlot("sponsored_rail");
  const ledger = await loadRevenueLedgerSummary();
  const coverage = resolveMetricCoverage(await loadMetricSourceCounts());
  const coverageCounts = summarizeCoverage(coverage);

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-8 text-gray-900">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        Admin · Stage 7
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">
        Organic / 제휴 / 스폰서 검수
      </h1>
      <p className="mt-2 text-sm text-gray-600">
        유료 관계가 Organic 점수를 바꾸지 않는지, 광고 슬롯이 분리되는지, 건강정보
        타기팅이 금지되는지 확인합니다. Production 쓰기는 없습니다.
      </p>
      <AdminSubnav current="commerce" />

      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-semibold">제휴 링크 요약</h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-gray-500">전체</dt>
            <dd className="font-medium">{summary.total}</dd>
          </div>
          <div>
            <dt className="text-gray-500">publishable</dt>
            <dd className="font-medium">{summary.publishable}</dd>
          </div>
          <div>
            <dt className="text-gray-500">blocked</dt>
            <dd className="font-medium">{summary.blocked}</dd>
          </div>
          <div>
            <dt className="text-gray-500">affiliate</dt>
            <dd className="font-medium">{summary.affiliate}</dd>
          </div>
          <div>
            <dt className="text-gray-500">sponsored</dt>
            <dd className="font-medium">{summary.sponsored}</dd>
          </div>
          <div>
            <dt className="text-gray-500">databaseTouched</dt>
            <dd className="font-medium">{String(summary.databaseTouched)}</dd>
          </div>
        </dl>
      </section>

      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-semibold">광고 슬롯 정책</h2>
        <ul className="mt-3 space-y-2 text-sm text-gray-700">
          <li>
            {COMMERCE_LANE_LABELS_KO.organic}: sponsored=
            {String(organicSlot.allowSponsored)} · affiliate=
            {String(organicSlot.allowAffiliate)}
          </li>
          <li>
            {COMMERCE_LANE_LABELS_KO.sponsored}: organic=
            {String(sponsoredSlot.allowOrganic)} · sponsored=
            {String(sponsoredSlot.allowSponsored)}
          </li>
        </ul>
      </section>

      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-semibold">이벤트 집계 (in-memory)</h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-gray-500">click</dt>
            <dd className="font-medium">{analytics.clicks}</dd>
          </div>
          <div>
            <dt className="text-gray-500">lead</dt>
            <dd className="font-medium">{analytics.leads}</dd>
          </div>
          <div>
            <dt className="text-gray-500">conversion</dt>
            <dd className="font-medium">{analytics.conversions}</dd>
          </div>
          <div>
            <dt className="text-gray-500">revenue</dt>
            <dd className="font-medium">{analytics.revenueEvents}</dd>
          </div>
          <div>
            <dt className="text-gray-500">healthTargetingClaims</dt>
            <dd className="font-medium">{analytics.healthTargetingClaims}</dd>
          </div>
        </dl>
      </section>

      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-semibold">적재된 수익 이벤트</h2>
        <p className="mt-1 text-xs text-gray-600">
          `commercial_click_events` 실적재분입니다. 위 항목이 코드·fixture 기준인
          것과 달리 여기는 DB에서 읽습니다. 통화가 다르면 합치지 않고, 금액이
          기록되지 않은 건은 0원이 아니라 따로 셉니다.
        </p>

        {!ledger.ok ? (
          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {ledger.reason}
          </p>
        ) : ledger.summary.totalEvents === 0 ? (
          <p className="mt-4 text-sm text-gray-600">
            적재된 이벤트가 없습니다. 수치를 만들어 채우지 않습니다.
          </p>
        ) : (
          <>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              {(["impression", "click", "lead", "conversion"] as const).map((k) => (
                <div key={k}>
                  <dt className="text-gray-500">{k}</dt>
                  <dd className="font-medium">{ledger.summary.byKind[k]}</dd>
                </div>
              ))}
            </dl>

            <table className="mt-5 w-full text-left text-sm">
              <thead className="text-xs text-gray-500">
                <tr>
                  <th className="py-1">레인</th>
                  <th className="py-1">노출</th>
                  <th className="py-1">클릭</th>
                  <th className="py-1">전환</th>
                  <th className="py-1">클릭률</th>
                  <th className="py-1">전환율</th>
                </tr>
              </thead>
              <tbody>
                {ledger.summary.lanes.map((lane) => (
                  <tr key={lane.lane} className="border-t border-gray-100">
                    <td className="py-1.5">
                      {COMMERCE_LANE_LABELS_KO[lane.lane] ?? lane.lane}
                    </td>
                    <td className="py-1.5">{lane.impressions}</td>
                    <td className="py-1.5">{lane.clicks}</td>
                    <td className="py-1.5">{lane.conversions}</td>
                    <td className="py-1.5">{formatRate(lane.clickThroughRate)}</td>
                    <td className="py-1.5">{formatRate(lane.conversionRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-5">
              <h3 className="text-sm font-semibold">통화별 수익</h3>
              {ledger.summary.revenueByCurrency.length === 0 ? (
                <p className="mt-1 text-sm text-gray-600">
                  금액이 기록된 이벤트가 없습니다.
                </p>
              ) : (
                <ul className="mt-1 space-y-1 text-sm">
                  {ledger.summary.revenueByCurrency.map((t) => (
                    <li key={t.currency}>
                      <span className="font-medium">{formatCurrencyTotal(t)}</span>
                      <span className="ml-2 text-xs text-gray-600">
                        {t.eventCount}건
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {ledger.summary.amountMissingCount > 0 ? (
                <p className="mt-2 text-xs text-amber-900">
                  금액이 기록되지 않은 전환·리드 {ledger.summary.amountMissingCount}건이
                  있습니다. 0원이 아니라 <strong>미기록</strong>입니다 — 정산 전에
                  원인을 확인해야 합니다.
                </p>
              ) : null}
            </div>

            {ledger.summary.byCountry.length > 0 ? (
              <p className="mt-4 text-xs text-gray-600">
                국가별:{" "}
                {ledger.summary.byCountry
                  .map((c) => `${c.countryCode} ${c.events}건(전환 ${c.conversions})`)
                  .join(" · ")}
              </p>
            ) : null}

            <p className="mt-3 text-xs text-gray-500">
              기간 {ledger.summary.firstEventAt?.slice(0, 10) ?? "—"} ~{" "}
              {ledger.summary.lastEventAt?.slice(0, 10) ?? "—"}
              {ledger.truncated ? " · 일부만 집계됨(상한 도달)" : ""}
            </p>
          </>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-semibold">지표 수집 현황 (MASTER_PLAN §38.8)</h2>
        <p className="mt-1 text-xs text-gray-600">
          계획서가 요구하는 지표 중 <strong>지금 실제로 셀 수 있는 것</strong>만
          «수집 중»입니다. 적재처가 아예 없는 지표를 0으로 적으면 «측정했더니
          0»으로 읽히므로, <strong>«수집 안 함»</strong>과 구분해 표시합니다.
        </p>
        <p className="mt-3 text-sm">
          수집 중 <strong>{coverageCounts.collected}</strong> · 적재처만 있음{" "}
          <strong>{coverageCounts.empty}</strong> · 수집 안 함{" "}
          <strong>{coverageCounts.uninstrumented}</strong> / 전체 {coverage.length}
        </p>

        <table className="mt-4 w-full text-left text-sm">
          <thead className="text-xs text-gray-500">
            <tr>
              <th className="py-1">지표</th>
              <th className="py-1">상태</th>
              <th className="py-1">건수</th>
              <th className="py-1">적재처</th>
            </tr>
          </thead>
          <tbody>
            {coverage.map((c) => (
              <tr key={c.metric} className="border-t border-gray-100">
                <td className="py-1.5">{c.metric}</td>
                <td className="py-1.5">
                  <span
                    className={
                      c.status === "collected"
                        ? "text-emerald-800"
                        : c.status === "empty"
                          ? "text-gray-600"
                          : "text-amber-900"
                    }
                  >
                    {METRIC_STATUS_LABEL_KO[c.status]}
                  </span>
                </td>
                <td className="py-1.5">{c.count == null ? "—" : c.count}</td>
                <td className="py-1.5 font-mono text-xs text-gray-500">{c.source}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mt-4 text-xs text-gray-600">
          정산(지급·고지 로그·금액 집계)은 아직 없습니다. 해당 테이블이 없고 실제
          제휴 계약도 없어, 계약이 생기기 전까지 스키마를 만들지 않습니다.
        </p>
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="text-lg font-semibold">제휴 링크 목록</h2>
        {links.length === 0 ? (
          <p className="text-sm text-gray-600">
            아직 메모리에 등록된 제휴 링크가 없습니다. 코드/selftest fixture만
            존재하며 가짜 URL을 게시하지 않습니다.
          </p>
        ) : (
          links.map((link) => (
            <article
              key={link.id}
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm"
            >
              <p className="font-medium">
                {link.entityType}/{link.entityId} · {link.reviewStatus}
              </p>
              <p className="mt-1 text-xs text-gray-600">
                affiliate={String(link.isAffiliate)} · sponsored=
                {String(link.isSponsored)} · organicRank=
                {link.organicRank ?? "null"}
              </p>
              {link.disclosureLabel ? (
                <p className="mt-1 text-xs text-amber-900">{link.disclosureLabel}</p>
              ) : null}
            </article>
          ))
        )}
      </section>

      <p className="mt-8 text-sm text-gray-600">
        병원 Organic/제휴 분리는{" "}
        <Link href="/admin/clinics" className="underline">
          병원 검수
        </Link>
        에서 확인합니다.
      </p>
    </main>
  );
}

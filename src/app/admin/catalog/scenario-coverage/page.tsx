import { requireAdminUser } from "@/lib/auth/admin";
import { AdminSubnav } from "@/app/admin/AdminSubnav";
import { getScenarioCoverageReport } from "@/lib/recommend/scenarios/scenarioCoverageReport";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "시나리오 커버리지 | K-Beauty Match Admin",
};

export default async function AdminScenarioCoveragePage() {
  await requireAdminUser();
  const report = getScenarioCoverageReport();

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-8 text-gray-900">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        Admin · WQ-F Phase 2+
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">
        추천 시나리오 커버리지
      </h1>
      <p className="mt-2 text-sm text-gray-600">
        {report.generatedFrom} 기준 오프라인 격차 분석입니다. 실 DB·네트워크
        조회 없음 · 가짜 pool 채움 없음 — 실제 매칭된 제품이 이미지·오퍼
        증거까지 갖춰야만 &ldquo;준비됨&rdquo;으로 집계됩니다.
      </p>
      <AdminSubnav current="scenario-coverage" />

      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-semibold">요약</h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-gray-500">시나리오</dt>
            <dd className="font-medium">{report.summary.scenarioCount}</dd>
          </div>
          <div>
            <dt className="text-gray-500">준비된 시나리오</dt>
            <dd className="font-medium">
              {report.summary.readyScenarioCount}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">준비율</dt>
            <dd className="font-medium">
              {report.summary.readinessRatePercent}%
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">백업 제품 수</dt>
            <dd className="font-medium">{report.productCount}</dd>
          </div>
        </dl>
      </section>

      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-semibold">부위별 커버리지</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="text-gray-500">
                <th className="py-1 pr-4">부위</th>
                <th className="py-1 pr-4">시나리오</th>
                <th className="py-1 pr-4">준비됨</th>
                <th className="py-1 pr-4">매칭 제품 수</th>
                <th className="py-1">준비율</th>
              </tr>
            </thead>
            <tbody>
              {report.summary.byArea.map((area) => (
                <tr key={area.priorityArea} className="border-t border-gray-100">
                  <td className="py-1.5 pr-4 font-medium">
                    {area.priorityArea}
                  </td>
                  <td className="py-1.5 pr-4">{area.scenarioCount}</td>
                  <td className="py-1.5 pr-4">{area.readyScenarioCount}</td>
                  <td className="py-1.5 pr-4">{area.totalMatchedProducts}</td>
                  <td className="py-1.5">{area.readinessRatePercent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-semibold">시나리오별 격차</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {report.gaps.map((gap) => (
            <li
              key={gap.scenarioId}
              className="rounded-lg border border-gray-100 px-3 py-2"
            >
              <p className="font-medium">
                {gap.scenarioId}{" "}
                <span className="text-xs font-normal text-gray-500">
                  ({gap.priorityArea})
                </span>
              </p>
              <p className="text-xs text-gray-500">
                매칭 {gap.matchedProductIds.length}건 · 준비{" "}
                {gap.recommendationReadyCount}건
                {gap.evidenceGaps.length > 0
                  ? ` · 격차: ${gap.evidenceGaps.join(", ")}`
                  : ""}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-6 text-xs text-gray-500">
        갱신: <code>npm run analyze:scenario-catalog-gap</code> (오프라인,
        DB/Production 쓰기 없음)
      </p>
    </main>
  );
}

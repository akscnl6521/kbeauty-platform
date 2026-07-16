import Link from "next/link";
import { requireAdminUser } from "@/lib/auth/admin";
import { AdminConfigurationError } from "@/lib/auth/errors";
import { getOperationsHealthSnapshot } from "@/lib/admin/operations/health";
import { AdminLogoutButton } from "../AdminLogoutButton";
import { AdminSubnav } from "../AdminSubnav";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Operations | K-Beauty Match",
  robots: { index: false, follow: false },
};

function gradeLabel(grade: string): string {
  switch (grade) {
    case "healthy":
      return "정상";
    case "attention":
      return "주의";
    case "warning":
      return "경고";
    case "critical":
      return "심각";
    default:
      return "알 수 없음";
  }
}

function gradeClass(grade: string): string {
  switch (grade) {
    case "healthy":
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
    case "attention":
      return "border-sky-200 bg-sky-50 text-sky-900";
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-950";
    case "critical":
      return "border-red-200 bg-red-50 text-red-900";
    default:
      return "border-gray-200 bg-gray-50 text-gray-800";
  }
}

export default async function AdminOperationsPage() {
  await requireAdminUser();

  let snapshot;
  try {
    snapshot = await getOperationsHealthSnapshot({ persistAlerts: true });
  } catch (e) {
    if (e instanceof AdminConfigurationError) {
      return (
        <main className="mx-auto max-w-5xl px-4 py-10">
          <p className="text-red-800">{e.message}</p>
        </main>
      );
    }
    throw e;
  }

  const m = snapshot.metrics;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">운영센터</h1>
          <p className="mt-1 text-sm text-gray-600">
            장애·품질 저하·검토 적체만 표시합니다. 정상 상태는 개입 불필요.
          </p>
          <AdminSubnav current="operations" />
        </div>
        <AdminLogoutButton />
      </div>

      <section
        className={`mt-6 rounded-lg border px-4 py-4 ${gradeClass(snapshot.grade)}`}
      >
        <p className="text-sm font-medium">전체 상태</p>
        <p className="mt-1 text-2xl font-semibold">
          {gradeLabel(snapshot.grade)}
        </p>
        <p className="mt-1 text-xs opacity-80">
          확인 {snapshot.checkedAt} · critical {snapshot.openCritical} ·
          warning {snapshot.openWarning} · info {snapshot.openInfo}
        </p>
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
        {[
          ["마지막 배치", m.worker.lastBatchAt ?? "—"],
          ["실행 중", String(m.worker.runningBatches)],
          ["실패율", `${(m.worker.recentFailureRate * 100).toFixed(0)}%`],
          ["retry backlog", String(m.worker.retryWaitJobs)],
          ["candidates 24h", String(m.collection.candidates24h)],
          ["draft", String(m.quality.draftProducts)],
          ["verified active", String(m.quality.verifiedActiveProducts)],
          ["verified offers", String(m.quality.verifiedOffers)],
          ["recommend eligible", String(m.recommendation.eligibleKr)],
          ["needs_review", String(m.review.pending + m.review.needsReview)],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-lg border border-[#E8DFD8] bg-white px-3 py-3"
          >
            <p className="text-xs text-gray-500">{label}</p>
            <p className="mt-1 font-medium tabular-nums text-gray-900">{value}</p>
          </div>
        ))}
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">긴급 알림</h2>
          <Link
            href="/admin/operations/alerts"
            className="text-sm text-[#8B6914] underline"
          >
            전체 알림
          </Link>
        </div>
        {snapshot.alerts.length === 0 ? (
          <p className="mt-3 text-sm text-gray-600">열린 알림 없음</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {snapshot.alerts.slice(0, 8).map((a) => (
              <li
                key={a.fingerprint}
                className="rounded-lg border border-[#E8DFD8] bg-white px-3 py-3 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs uppercase">
                    {a.severity}
                  </span>
                  <Link
                    href={`/admin/operations/alerts/${a.code}`}
                    className="font-medium text-[#8B6914] underline"
                  >
                    {a.title}
                  </Link>
                </div>
                <p className="mt-1 text-gray-700">{a.message}</p>
                <p className="mt-1 text-xs text-gray-500">
                  {a.recommendedAction}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-[#E8DFD8] bg-white px-4 py-4 text-sm">
          <h2 className="font-semibold text-gray-900">오늘</h2>
          <ul className="mt-2 space-y-1 text-gray-700">
            <li>URL {m.today.urlsDiscovered}</li>
            <li>후보 {m.today.candidates}</li>
            <li>draft {m.today.drafts}</li>
            <li>활성화 {m.today.activated}</li>
            <li>verified offer {m.today.verifiedOffers}</li>
            <li>eligible {m.today.recommendationEligible}</li>
            <li>needs_review {m.today.needsReview}</li>
            <li>실패 {m.today.failures}</li>
          </ul>
        </div>
        <div className="rounded-lg border border-[#E8DFD8] bg-white px-4 py-4 text-sm">
          <h2 className="font-semibold text-gray-900">최근 7일</h2>
          <ul className="mt-2 space-y-1 text-gray-700">
            <li>성공률 {(m.last7d.successRate * 100).toFixed(0)}%</li>
            <li>평균 처리량 {m.last7d.avgThroughput.toFixed(1)} batch/일</li>
            <li>
              공식 사이트{" "}
              {(m.last7d.officialSiteResolutionRate * 100).toFixed(0)}%
            </li>
            <li>
              성분 매칭 {(m.last7d.ingredientMatchRate * 100).toFixed(0)}%
            </li>
            <li>
              offer 검증 {(m.last7d.offerVerificationRate * 100).toFixed(0)}%
            </li>
            <li>eligible Δ {m.last7d.eligibleDelta}</li>
            <li>검토 적체 {m.last7d.reviewBacklogDelta}</li>
          </ul>
        </div>
      </section>

      <section className="mt-8 rounded-lg border border-[#E8DFD8] bg-white px-4 py-4 text-sm">
        <h2 className="font-semibold text-gray-900">검토 적체</h2>
        <p className="mt-2 text-gray-700">
          pending {m.review.pending} · in_review {m.review.inReview} ·
          needs_review {m.review.needsReview} · safety {m.review.safetyPending}
        </p>
        <Link
          href="/admin/verification"
          className="mt-2 inline-block text-[#8B6914] underline"
        >
          Verification으로 이동
        </Link>
      </section>
    </main>
  );
}

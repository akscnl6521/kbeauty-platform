import Link from "next/link";
import { requireAdminUser } from "@/lib/auth/admin";
import { getFollowUpLifecycleAdminSummaryFromMemory } from "@/lib/admin/followUpLifecycleAdmin";
import { AdminSubnav } from "../../AdminSubnav";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Follow-up lifecycle | Care Ops",
  robots: { index: false, follow: false },
};

export default async function AdminFollowUpLifecyclePage() {
  await requireAdminUser();
  const summary = getFollowUpLifecycleAdminSummaryFromMemory();

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-sm">
      <h1 className="text-xl font-semibold">3·7·15·30 팔로업 라이프사이클</h1>
      <AdminSubnav current="care" />
      <p className="mt-2 text-xs text-gray-600">{summary.note}</p>
      <p className="mt-1 text-xs text-amber-900">
        실발송 주장 없음 · realDeliveryClaimed={String(summary.realDeliveryClaimed)}
      </p>

      <section className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-[#E8DFD8] bg-white px-3 py-3">
          <p className="text-xs text-gray-500">분석 세션</p>
          <p className="font-semibold tabular-nums">{summary.analysisSessions}</p>
        </div>
        <div className="rounded-lg border border-[#E8DFD8] bg-white px-3 py-3">
          <p className="text-xs text-gray-500">red-flag 에스컬레이션</p>
          <p className="font-semibold tabular-nums">{summary.redFlagEscalations}</p>
        </div>
        <div className="rounded-lg border border-[#E8DFD8] bg-white px-3 py-3">
          <p className="text-xs text-gray-500">루틴 조정 제안</p>
          <p className="font-semibold tabular-nums">
            {summary.routineAdjustmentsProposed}
          </p>
        </div>
        <div className="rounded-lg border border-[#E8DFD8] bg-white px-3 py-3">
          <p className="text-xs text-gray-500">persistence fallback</p>
          <p className="font-semibold tabular-nums">
            {summary.persistenceFallbackCount}
          </p>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="font-semibold">단계(phase)</h2>
        <ul className="mt-2 space-y-1">
          {Object.entries(summary.byPhase).map(([k, v]) => (
            <li key={k}>
              {k}: {v}
            </li>
          ))}
          {Object.keys(summary.byPhase).length === 0 ? (
            <li className="text-gray-500">아직 메모리 스냅샷 없음 (dry-run/selftest 후 표시)</li>
          ) : null}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="font-semibold">체크인 상태</h2>
        <ul className="mt-2 space-y-1">
          {Object.entries(summary.checkInsByStatus).map(([k, v]) => (
            <li key={k}>
              {k}: {v}
            </li>
          ))}
        </ul>
        <ul className="mt-2 space-y-1 text-xs text-gray-600">
          {Object.entries(summary.checkInsByDay).map(([k, v]) => (
            <li key={k}>
              {k}: {v}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="font-semibold">채널 배송 상태 레코드</h2>
        <p className="mt-1 text-xs text-gray-500">{summary.delivery.note}</p>
        <ul className="mt-2 space-y-1">
          {Object.entries(summary.delivery.byChannel).map(([k, v]) => (
            <li key={k}>
              {k}: {v}
            </li>
          ))}
        </ul>
        <ul className="mt-2 space-y-1 text-xs text-gray-600">
          {Object.entries(summary.delivery.byStatus).map(([k, v]) => (
            <li key={k}>
              {k}: {v}
            </li>
          ))}
        </ul>
      </section>

      <ul className="mt-8 space-y-2">
        <li>
          <Link
            href="/api/admin/care/follow-up-lifecycle"
            className="text-[#8B6914] underline"
          >
            라이프사이클 요약 API
          </Link>
        </li>
        <li>
          <Link href="/admin/care" className="text-[#8B6914] underline">
            ← Care
          </Link>
        </li>
      </ul>
    </main>
  );
}

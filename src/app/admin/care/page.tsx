import Link from "next/link";
import { requireAdminUser } from "@/lib/auth/admin";
import { AdminConfigurationError } from "@/lib/auth/errors";
import { getAdminCareOpsSummary } from "@/lib/admin/care-ops";
import { getCheckinEmailQueueStatusCounts } from "@/lib/admin/checkinEmailQueueStatus";
import { fmtCount, fmtRate } from "@/lib/admin/care-display";
import { AdminLogoutButton } from "../AdminLogoutButton";
import { AdminSubnav } from "../AdminSubnav";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Care Ops | K-Beauty Match",
  robots: { index: false, follow: false },
};

export default async function AdminCarePage() {
  await requireAdminUser();
  let data;
  try {
    data = await getAdminCareOpsSummary();
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
  let queueStatus;
  try {
    queueStatus = await getCheckinEmailQueueStatusCounts();
  } catch {
    queueStatus = {
      tablesReady: false,
      readinessStatus: "query_error" as const,
      note: "queue status unavailable",
      counts: {},
      total: 0,
    };
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Care 운영</h1>
          <p className="mt-1 text-sm text-gray-600">
            익명 집계만 표시합니다. 이메일·UID·메모·사진은 노출하지 않습니다.
          </p>
          <AdminSubnav current="care" />
        </div>
        <AdminLogoutButton />
      </div>

      <p className="mt-4 text-sm text-amber-900">{data.note}</p>
      {data.kAnonymityNotes.length ? (
        <p className="mt-2 text-xs text-gray-500">
          {data.kAnonymityNotes.join(" · ")}
        </p>
      ) : null}

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
        {[
          ["scheduled", fmtCount(data.scheduledCheckIns)],
          ["due", fmtCount(data.dueCheckIns)],
          ["completed", fmtCount(data.completedCheckIns)],
          ["expired", fmtCount(data.expiredCheckIns)],
          ["completion rate", fmtRate(data.completionRate)],
          ["referral promptly", fmtCount(data.referralPromptly)],
          ["referral emergency", fmtCount(data.referralEmergency)],
          ["routines", fmtCount(data.routinesSaved)],
        ].map(([k, v]) => (
          <div
            key={String(k)}
            className="rounded-lg border border-[#E8DFD8] bg-white px-3 py-3"
          >
            <p className="text-xs text-gray-500">{k}</p>
            <p className="font-semibold tabular-nums">{v}</p>
          </div>
        ))}
      </section>

      <section className="mt-8 rounded-lg border border-[#E8DFD8] bg-white px-4 py-4 text-sm">
        <h2 className="font-semibold">체크인 이메일 큐</h2>
        <p className="mt-1 text-xs text-gray-500">
          {queueStatus?.note ?? "status counts only — no PII"}
        </p>
        <p className="mt-2 text-xs text-gray-600">
          readiness: {queueStatus?.readinessStatus ?? "unknown"} · total:{" "}
          {queueStatus?.total ?? 0}
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {Object.entries(queueStatus?.counts ?? {}).map(([k, v]) => (
            <div key={k} className="rounded border border-[#E8DFD8] px-2 py-2">
              <p className="text-[11px] text-gray-500">{k}</p>
              <p className="font-semibold tabular-nums">{v}</p>
            </div>
          ))}
        </div>
        <ul className="mt-3 space-y-1 text-sm">
          <li>
            <Link
              href="/api/admin/care/checkin-email-queue-status"
              className="text-[#8B6914] underline"
            >
              큐 상태 API
            </Link>
          </li>
          <li>
            <Link
              href="/admin/care/checkin-email-worker"
              className="text-[#8B6914] underline"
            >
              Worker 관리 (dry-run only · 실발송 없음)
            </Link>
          </li>
          <li>
            <Link
              href="/admin/care/check-in-email-test"
              className="text-[#8B6914] underline"
            >
              Preview 체크인 이메일 테스트 (in-memory)
            </Link>
          </li>
        </ul>
      </section>

      <ul className="mt-8 space-y-2 text-sm">
        <li>
          <Link href="/admin/care/check-ins" className="text-[#8B6914] underline">
            체크인 집계
          </Link>
        </li>
        <li>
          <Link href="/admin/care/follow-up" className="text-[#8B6914] underline">
            3·7·15·30 팔로업 라이프사이클 (dry-run · 실발송 미주장)
          </Link>
        </li>
        <li>
          <Link href="/admin/care/alerts" className="text-[#8B6914] underline">
            위험 신호 집계
          </Link>
        </li>
        <li>
          <Link
            href="/admin/care/engagement"
            className="text-[#8B6914] underline"
          >
            유지율 집계
          </Link>
        </li>
      </ul>
    </main>
  );
}

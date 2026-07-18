import Link from "next/link";
import { requireAdminUser } from "@/lib/auth/admin";
import { getAdminCareCheckInsByDay } from "@/lib/admin/care-ops";
import { fmtCount } from "@/lib/admin/care-display";
import { AdminSubnav } from "../../AdminSubnav";

export const dynamic = "force-dynamic";

/**
 * Aggregated check-in ops view — no PII, no bulk Production actions.
 */
export default async function AdminCareCheckInsPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string; status?: string }>;
}) {
  await requireAdminUser();
  const sp = await searchParams;
  const dayFilter = sp.day ? Number(sp.day) : null;
  const statusFilter = sp.status || null;
  const data = await getAdminCareCheckInsByDay();

  const dayRows =
    dayFilter && [3, 7, 15, 30].includes(dayFilter)
      ? data.byDay.filter((r) => r.day === dayFilter)
      : data.byDay;

  const statusEntries = Object.entries(data.byStatus).filter(([status]) =>
    statusFilter ? status === statusFilter : true
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-sm">
      <h1 className="text-xl font-semibold">체크인 집계</h1>
      <AdminSubnav current="care" />
      <p className="mt-2 text-xs text-stone-500">
        사용자 식별·민감 메모는 표시하지 않습니다. Production 대량 조작 없음.
      </p>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        {[3, 7, 15, 30].map((d) => (
          <Link
            key={d}
            href={`/admin/care/check-ins?day=${d}`}
            className="rounded-full border border-stone-200 px-3 py-1"
          >
            Day {d}
          </Link>
        ))}
        {["scheduled", "due", "completed", "skipped", "expired"].map((s) => (
          <Link
            key={s}
            href={`/admin/care/check-ins?status=${s}`}
            className="rounded-full border border-stone-200 px-3 py-1"
          >
            {s}
          </Link>
        ))}
        <Link
          href="/admin/care/check-ins"
          className="rounded-full bg-stone-900 px-3 py-1 text-white"
        >
          전체
        </Link>
        <Link
          href="/admin/care/alerts"
          className="rounded-full border border-amber-300 px-3 py-1 text-amber-900"
        >
          위험 신호(알림)
        </Link>
      </div>

      <ul className="mt-4 space-y-1">
        {statusEntries.map(([status, count]) => (
          <li key={status}>
            {status}: {fmtCount(count)}
          </li>
        ))}
      </ul>
      <ul className="mt-4 space-y-1">
        {dayRows.map((row) => (
          <li key={row.day}>
            Day {row.day}: {fmtCount(row.count)}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-gray-500">{data.note}</p>
      <p className="mt-2 text-xs text-stone-500">
        이메일: provider 없으면 SKIPPED/dry-run. 실제 대량 발송·Production 스케줄 등록 없음.
      </p>
      <Link href="/admin/care" className="mt-4 inline-block text-[#8B6914] underline">
        ← Care
      </Link>
    </main>
  );
}

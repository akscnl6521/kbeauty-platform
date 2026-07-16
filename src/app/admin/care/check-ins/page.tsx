import Link from "next/link";
import { requireAdminUser } from "@/lib/auth/admin";
import { getAdminCareCheckInsByDay } from "@/lib/admin/care-ops";
import { fmtCount } from "@/lib/admin/care-display";
import { AdminSubnav } from "../../AdminSubnav";

export const dynamic = "force-dynamic";

export default async function AdminCareCheckInsPage() {
  await requireAdminUser();
  const data = await getAdminCareCheckInsByDay();
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-sm">
      <h1 className="text-xl font-semibold">체크인 집계</h1>
      <AdminSubnav current="care" />
      <ul className="mt-4 space-y-1">
        {Object.entries(data.byStatus).map(([status, count]) => (
          <li key={status}>
            {status}: {fmtCount(count)}
          </li>
        ))}
      </ul>
      <ul className="mt-4 space-y-1">
        {data.byDay.map((row) => (
          <li key={row.day}>
            Day {row.day}: {fmtCount(row.count)}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-gray-500">{data.note}</p>
      <Link href="/admin/care" className="mt-4 inline-block text-[#8B6914] underline">
        ← Care
      </Link>
    </main>
  );
}

import Link from "next/link";
import { requireAdminUser } from "@/lib/auth/admin";
import { getAdminCareOpsSummary } from "@/lib/admin/care-ops";
import { AdminSubnav } from "../../AdminSubnav";

export const dynamic = "force-dynamic";

export default async function AdminCareCheckInsPage() {
  await requireAdminUser();
  const data = await getAdminCareOpsSummary();
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-sm">
      <h1 className="text-xl font-semibold">체크인 집계</h1>
      <AdminSubnav current="care" />
      <p className="mt-4">due {data.dueCheckIns} · completed {data.completedCheckIns}</p>
      <Link href="/admin/care" className="mt-4 inline-block text-[#8B6914] underline">
        ← Care
      </Link>
    </main>
  );
}

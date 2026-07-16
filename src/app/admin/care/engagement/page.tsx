import Link from "next/link";
import { requireAdminUser } from "@/lib/auth/admin";
import { getAdminCareEngagement } from "@/lib/admin/care-ops";
import { fmtCount, fmtRate } from "@/lib/admin/care-display";
import { AdminSubnav } from "../../AdminSubnav";

export const dynamic = "force-dynamic";

export default async function AdminCareEngagementPage() {
  await requireAdminUser();
  const data = await getAdminCareEngagement();
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-sm">
      <h1 className="text-xl font-semibold">유지율 집계</h1>
      <AdminSubnav current="care" />
      <p className="mt-4">
        completion {fmtRate(data.completionRate)} · active routines{" "}
        {fmtCount(data.activeRoutines)} · feedback {fmtCount(data.feedbackCount)}
      </p>
      <p className="mt-2 text-xs text-gray-500">{data.note}</p>
      {data.kAnonymityNotes.length ? (
        <p className="mt-1 text-xs text-gray-500">
          {data.kAnonymityNotes.join(" · ")}
        </p>
      ) : null}
      <Link href="/admin/care" className="mt-4 inline-block text-[#8B6914] underline">
        ← Care
      </Link>
    </main>
  );
}

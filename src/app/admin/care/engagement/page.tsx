import Link from "next/link";
import { requireAdminUser } from "@/lib/auth/admin";
import { getAdminCareOpsSummary } from "@/lib/admin/care-ops";
import { AdminSubnav } from "../../AdminSubnav";

export const dynamic = "force-dynamic";

export default async function AdminCareEngagementPage() {
  await requireAdminUser();
  const data = await getAdminCareOpsSummary();
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-sm">
      <h1 className="text-xl font-semibold">유지율 집계</h1>
      <AdminSubnav current="care" />
      <p className="mt-4">
        completion {(data.completionRate * 100).toFixed(0)}% · routines{" "}
        {data.routinesSaved} · feedback {data.feedbackCount}
      </p>
      <Link href="/admin/care" className="mt-4 inline-block text-[#8B6914] underline">
        ← Care
      </Link>
    </main>
  );
}

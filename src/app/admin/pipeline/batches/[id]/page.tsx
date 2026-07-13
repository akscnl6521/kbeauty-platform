import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminUser } from "@/lib/auth/admin";
import { listJobs, loadBatch } from "@/lib/pipeline/checkpoint";
import { AdminLogoutButton } from "../../../AdminLogoutButton";
import { AdminSubnav } from "../../../AdminSubnav";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Admin Pipeline Batch | K-Beauty Match",
  robots: { index: false, follow: false },
};

export default async function AdminPipelineBatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminUser();
  const { id } = await params;
  const batch = await loadBatch(id);
  if (!batch) notFound();
  const jobs = await listJobs(id);
  const review = jobs.filter((j) => j.status === "needs_review");

  return (
    <main className="min-h-screen bg-[#FAF7F5] px-4 py-10 text-gray-900 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8B6914]">
              Admin
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight">
              배치 {batch.batchId.slice(0, 8)}…
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              {batch.mode} · {batch.status} · processed {batch.progress.processedItems}/
              {batch.progress.totalItems}
            </p>
            <AdminSubnav current="pipeline" />
          </div>
          <AdminLogoutButton className="shrink-0 rounded-lg border border-[#E8DFD8] bg-white px-3 py-1.5 text-sm font-medium text-gray-800" />
        </div>

        <p className="mt-4 text-sm">
          <Link href="/admin/pipeline" className="font-medium text-[#8B6914] underline">
            파이프라인 목록
          </Link>
        </p>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">needs_review ({review.length})</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {review.length === 0 ? (
              <li className="text-gray-500">검토 대기 항목 없음</li>
            ) : (
              review.map((j) => (
                <li
                  key={j.jobId}
                  className="rounded border border-amber-200 bg-amber-50 px-3 py-2"
                >
                  <div className="font-medium">{j.entityLabel}</div>
                  <div className="text-xs text-amber-900">
                    {j.safeFailureMessage ?? j.warnings.join(" · ") ?? j.stage}
                  </div>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold">jobs ({jobs.length})</h2>
          <div className="mt-3 overflow-x-auto rounded-lg border border-[#E8DFD8] bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[#E8DFD8] bg-[#F7F1EC] text-xs uppercase text-gray-600">
                <tr>
                  <th className="px-3 py-2">label</th>
                  <th className="px-3 py-2">stage</th>
                  <th className="px-3 py-2">status</th>
                  <th className="px-3 py-2">summary</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.jobId} className="border-b border-[#F0E8E2]">
                    <td className="px-3 py-2">{j.entityLabel}</td>
                    <td className="px-3 py-2">{j.stage}</td>
                    <td className="px-3 py-2">{j.status}</td>
                    <td className="px-3 py-2 text-xs text-gray-600">
                      {j.resultSummary
                        ? JSON.stringify(j.resultSummary)
                        : j.safeFailureMessage ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

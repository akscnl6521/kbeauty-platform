import { requireAdminUser } from "@/lib/auth/admin";
import { AdminConfigurationError } from "@/lib/auth/errors";
import { listCatalogJobs } from "@/lib/admin/catalog-automation";
import { CatalogAutomationShell } from "../CatalogAutomationShell";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Catalog Jobs | K-Beauty Match",
  robots: { index: false, follow: false },
};

export default async function CatalogJobsPage() {
  await requireAdminUser();
  let rows: Awaited<ReturnType<typeof listCatalogJobs>> = [];
  let errorMsg: string | null = null;
  try {
    rows = await listCatalogJobs();
  } catch (e) {
    errorMsg =
      e instanceof AdminConfigurationError ? e.message : "Jobs unavailable";
  }

  return (
    <CatalogAutomationShell
      title="Jobs"
      description="Discovery → fetch → parse → stage 작업 기록입니다. Preview에서는 대량 cron이 비활성입니다."
    >
      {errorMsg ? <p className="text-sm text-red-700">{errorMsg}</p> : null}
      {!errorMsg && rows.length === 0 ? (
        <p className="text-sm text-gray-600">
          아직 crawl job이 없습니다. dry-run은 메모리 스테이징으로 실행되며 DB
          job 기록은 승인 후 활성화됩니다.
        </p>
      ) : null}
      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-[#E8DFD8] bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[#E8DFD8] bg-[#F7F1EC] text-xs uppercase text-gray-600">
              <tr>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Discovered</th>
                <th className="px-3 py-2">Staged</th>
                <th className="px-3 py-2">Needs review</th>
                <th className="px-3 py-2">Dry-run</th>
                <th className="px-3 py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={String(r.id)} className="border-b border-[#F0E8E2]">
                  <td className="px-3 py-2">{String(r.job_type)}</td>
                  <td className="px-3 py-2">{String(r.status)}</td>
                  <td className="px-3 py-2">{String(r.discovered_count)}</td>
                  <td className="px-3 py-2">{String(r.staged_count)}</td>
                  <td className="px-3 py-2">{String(r.needs_review_count)}</td>
                  <td className="px-3 py-2">{r.dry_run ? "yes" : "no"}</td>
                  <td className="px-3 py-2">{String(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </CatalogAutomationShell>
  );
}

import { requireAdminUser } from "@/lib/auth/admin";
import { AdminConfigurationError } from "@/lib/auth/errors";
import { listReviewQueue } from "@/lib/admin/catalog-automation";
import { CatalogAutomationShell } from "../CatalogAutomationShell";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Catalog Review | K-Beauty Match",
  robots: { index: false, follow: false },
};

export default async function CatalogReviewAutomationPage() {
  await requireAdminUser();
  let rows: Awaited<ReturnType<typeof listReviewQueue>> = [];
  let errorMsg: string | null = null;
  try {
    rows = await listReviewQueue();
  } catch (e) {
    errorMsg =
      e instanceof AdminConfigurationError ? e.message : "Review queue unavailable";
  }

  return (
    <CatalogAutomationShell
      title="Review queue"
      description="제품·성분·offer 승인 대기열입니다. AUTO_PROMOTE=false · 이 화면에서 대량 products/product_offers 승격을 실행하지 않습니다. 최초 50건은 수동 승인 정책입니다."
    >
      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        승인/거절 버튼은 준비 중이며, 현재는 읽기 전용 검수입니다. 쿠팡·올리브영은
        MANUAL_AUTHORIZATION_REQUIRED 상태입니다.
      </div>
      {errorMsg ? <p className="text-sm text-red-700">{errorMsg}</p> : null}
      {!errorMsg && rows.length === 0 ? (
        <p className="text-sm text-gray-600">검토 대기 스테이징 항목이 없습니다.</p>
      ) : null}
      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-[#E8DFD8] bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[#E8DFD8] bg-[#F7F1EC] text-xs uppercase text-gray-600">
              <tr>
                <th className="px-3 py-2">Brand</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Product status</th>
                <th className="px-3 py-2">Ingredients</th>
                <th className="px-3 py-2">Errors</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={String(r.id)} className="border-b border-[#F0E8E2]">
                  <td className="px-3 py-2">
                    {String(r.brand_canonical ?? "—")}
                  </td>
                  <td className="px-3 py-2">{String(r.product_name_raw)}</td>
                  <td className="px-3 py-2">
                    {String(r.category_canonical ?? "—")}
                  </td>
                  <td className="px-3 py-2">{String(r.product_status)}</td>
                  <td className="px-3 py-2">{String(r.ingredients_status)}</td>
                  <td className="px-3 py-2 text-xs">
                    {JSON.stringify(r.validation_errors ?? [])}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </CatalogAutomationShell>
  );
}

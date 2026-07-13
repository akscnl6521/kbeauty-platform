import { requireAdminUser } from "@/lib/auth/admin";
import { AdminConfigurationError } from "@/lib/auth/errors";
import { listStagingProducts } from "@/lib/admin/catalog-automation";
import { CatalogAutomationShell } from "../CatalogAutomationShell";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Catalog Staging | K-Beauty Match",
  robots: { index: false, follow: false },
};

export default async function CatalogStagingPage() {
  await requireAdminUser();
  let rows: Awaited<ReturnType<typeof listStagingProducts>> = [];
  let errorMsg: string | null = null;
  try {
    rows = await listStagingProducts();
  } catch (e) {
    errorMsg =
      e instanceof AdminConfigurationError ? e.message : "Staging unavailable";
  }

  return (
    <CatalogAutomationShell
      title="Staging products"
      description="검증 전 스테이징 제품입니다. products 테이블로 자동 승격하지 않습니다."
    >
      {errorMsg ? <p className="text-sm text-red-700">{errorMsg}</p> : null}
      {!errorMsg && rows.length === 0 ? (
        <p className="text-sm text-gray-600">
          스테이징 행이 없습니다. 로컬 dry-run 결과는 reports/catalog-automation-dry-run.json
          을 확인하세요.
        </p>
      ) : null}
      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-[#E8DFD8] bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[#E8DFD8] bg-[#F7F1EC] text-xs uppercase text-gray-600">
              <tr>
                <th className="px-3 py-2">Brand</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Size</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Ingredients</th>
                <th className="px-3 py-2">Official URL</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={String(r.id)} className="border-b border-[#F0E8E2] align-top">
                  <td className="px-3 py-2">
                    {String(r.brand_canonical ?? r.brand_raw)}
                  </td>
                  <td className="px-3 py-2">{String(r.product_name_raw)}</td>
                  <td className="px-3 py-2">
                    {String(r.category_canonical ?? "—")}
                  </td>
                  <td className="px-3 py-2">
                    {r.size_value != null
                      ? `${r.size_value} ${r.size_unit ?? ""}`
                      : "—"}
                  </td>
                  <td className="px-3 py-2">{String(r.product_status)}</td>
                  <td className="px-3 py-2">{String(r.ingredients_status)}</td>
                  <td className="max-w-xs truncate px-3 py-2 text-xs">
                    {String(r.official_product_url ?? "—")}
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

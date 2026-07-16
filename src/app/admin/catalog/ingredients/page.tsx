import { requireAdminUser } from "@/lib/auth/admin";
import { AdminConfigurationError } from "@/lib/auth/errors";
import { listStagingIngredients } from "@/lib/admin/catalog-automation";
import { CatalogAutomationShell } from "../CatalogAutomationShell";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Catalog Ingredients Staging | K-Beauty Match",
  robots: { index: false, follow: false },
};

export default async function CatalogIngredientsPage() {
  await requireAdminUser();
  let rows: Awaited<ReturnType<typeof listStagingIngredients>> = [];
  let errorMsg: string | null = null;
  try {
    rows = await listStagingIngredients();
  } catch (e) {
    errorMsg =
      e instanceof AdminConfigurationError
        ? e.message
        : "Ingredients unavailable";
  }

  return (
    <CatalogAutomationShell
      title="Staging ingredients"
      description="원본 전성분 토큰·정규화·unknown 보존 상태입니다. AI로 빠진 INCI를 채우지 않습니다."
    >
      {errorMsg ? <p className="text-sm text-red-700">{errorMsg}</p> : null}
      {!errorMsg && rows.length === 0 ? (
        <p className="text-sm text-gray-600">스테이징 성분이 없습니다.</p>
      ) : null}
      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-[#E8DFD8] bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[#E8DFD8] bg-[#F7F1EC] text-xs uppercase text-gray-600">
              <tr>
                <th className="px-3 py-2">Order</th>
                <th className="px-3 py-2">Raw</th>
                <th className="px-3 py-2">INCI</th>
                <th className="px-3 py-2">Canonical</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Confidence</th>
                <th className="px-3 py-2">Verified</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={String(r.id)} className="border-b border-[#F0E8E2]">
                  <td className="px-3 py-2">{String(r.display_order)}</td>
                  <td className="px-3 py-2">{String(r.ingredient_raw)}</td>
                  <td className="px-3 py-2">{String(r.inci_name ?? "—")}</td>
                  <td className="px-3 py-2">{String(r.canonical_key ?? "—")}</td>
                  <td className="px-3 py-2">
                    {String(r.normalization_status)}
                  </td>
                  <td className="px-3 py-2">{String(r.confidence)}</td>
                  <td className="px-3 py-2">
                    {r.source_verified ? "yes" : "no"}
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

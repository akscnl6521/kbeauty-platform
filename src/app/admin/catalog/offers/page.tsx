import { requireAdminUser } from "@/lib/auth/admin";
import { AdminConfigurationError } from "@/lib/auth/errors";
import { listStagingOffers } from "@/lib/admin/catalog-automation";
import { CatalogAutomationShell } from "../CatalogAutomationShell";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Catalog Offers Staging | K-Beauty Match",
  robots: { index: false, follow: false },
};

export default async function CatalogOffersStagingPage() {
  await requireAdminUser();
  let rows: Awaited<ReturnType<typeof listStagingOffers>> = [];
  let errorMsg: string | null = null;
  try {
    rows = await listStagingOffers();
  } catch (e) {
    errorMsg =
      e instanceof AdminConfigurationError ? e.message : "Offers unavailable";
  }

  return (
    <CatalogAutomationShell
      title="Staging offers"
      description="판매처·판매자·공식 여부·가격·재고를 분리 표시합니다. 검색/카테고리 URL은 invalid입니다. 자동 product_offers 승격은 비활성입니다."
    >
      {errorMsg ? <p className="text-sm text-red-700">{errorMsg}</p> : null}
      {!errorMsg && rows.length === 0 ? (
        <p className="text-sm text-gray-600">스테이징 offer가 없습니다.</p>
      ) : null}
      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-[#E8DFD8] bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[#E8DFD8] bg-[#F7F1EC] text-xs uppercase text-gray-600">
              <tr>
                <th className="px-3 py-2">Retailer</th>
                <th className="px-3 py-2">Seller</th>
                <th className="px-3 py-2">Official</th>
                <th className="px-3 py-2">Price</th>
                <th className="px-3 py-2">Stock</th>
                <th className="px-3 py-2">Country</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">URL</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={String(r.id)} className="border-b border-[#F0E8E2] align-top">
                  <td className="px-3 py-2">{String(r.retailer_name_raw)}</td>
                  <td className="px-3 py-2">{String(r.seller_name ?? "—")}</td>
                  <td className="px-3 py-2">
                    {r.is_official_store ? "yes" : "no"}
                  </td>
                  <td className="px-3 py-2">
                    {r.price != null
                      ? `${r.currency ?? ""} ${r.price}`
                      : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {r.in_stock == null ? "unknown" : r.in_stock ? "in" : "out"}
                  </td>
                  <td className="px-3 py-2">{String(r.country_code)}</td>
                  <td className="px-3 py-2">{String(r.offer_status)}</td>
                  <td className="max-w-xs truncate px-3 py-2 text-xs">
                    {String(r.purchase_url)}
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

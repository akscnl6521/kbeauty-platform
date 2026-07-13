import { requireAdminUser } from "@/lib/auth/admin";
import { AdminConfigurationError } from "@/lib/auth/errors";
import { listCatalogSources } from "@/lib/admin/catalog-automation";
import { CatalogAutomationShell } from "../CatalogAutomationShell";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Catalog Sources | K-Beauty Match",
  robots: { index: false, follow: false },
};

export default async function CatalogSourcesPage() {
  await requireAdminUser();
  let rows: Awaited<ReturnType<typeof listCatalogSources>> = [];
  let errorMsg: string | null = null;
  try {
    rows = await listCatalogSources();
  } catch (e) {
    errorMsg =
      e instanceof AdminConfigurationError
        ? e.message
        : "Sources unavailable";
  }

  return (
    <CatalogAutomationShell
      title="Sources"
      description="쿠팡·올리브영·브랜드 공식몰·공개 데이터 소스의 승인·robots·terms·automation 상태입니다. 승인 전에는 live fetch를 실행하지 않습니다."
    >
      {errorMsg ? (
        <p className="text-sm text-red-700">{errorMsg}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#E8DFD8] bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[#E8DFD8] bg-[#F7F1EC] text-xs uppercase text-gray-600">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Tier</th>
                <th className="px-3 py-2">Authorization</th>
                <th className="px-3 py-2">Automation</th>
                <th className="px-3 py-2">Robots</th>
                <th className="px-3 py-2">Terms</th>
                <th className="px-3 py-2">Country</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[#F0E8E2]">
                  <td className="px-3 py-2 font-medium">{r.name}</td>
                  <td className="px-3 py-2">{r.sourceType}</td>
                  <td className="px-3 py-2">{r.sourceTier}</td>
                  <td className="px-3 py-2">{r.authorizationStatus}</td>
                  <td className="px-3 py-2">
                    {r.automationAllowed ? "on" : "off"}
                  </td>
                  <td className="px-3 py-2">{r.robotsStatus}</td>
                  <td className="px-3 py-2">{r.termsStatus}</td>
                  <td className="px-3 py-2">{r.countryCode ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </CatalogAutomationShell>
  );
}

import Link from "next/link";
import { requireAdminUser } from "@/lib/auth/admin";
import { seedBrandsFromCatalog } from "@/lib/pipeline/brand-discovery";
import { AdminLogoutButton } from "../AdminLogoutButton";
import { AdminSubnav } from "../AdminSubnav";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Admin Brands | K-Beauty Match",
  robots: { index: false, follow: false },
};

export default async function AdminBrandsPage() {
  await requireAdminUser();
  const brands = await seedBrandsFromCatalog(100);

  return (
    <main className="min-h-screen bg-[#FAF7F5] px-4 py-10 text-gray-900 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8B6914]">
              Admin
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">브랜드 seed</h1>
            <p className="mt-2 text-sm text-gray-600">
              기존 products/brands에서 자동 수집합니다. 코드에 브랜드를 하드코딩하지
              않습니다.
            </p>
            <AdminSubnav current="brands" />
          </div>
          <AdminLogoutButton className="shrink-0 rounded-lg border border-[#E8DFD8] bg-white px-3 py-1.5 text-sm font-medium text-gray-800" />
        </div>
        <p className="mt-4 text-sm">
          <Link href="/admin/pipeline" className="font-medium text-[#8B6914] underline">
            파이프라인
          </Link>
        </p>
        <div className="mt-6 overflow-x-auto rounded-lg border border-[#E8DFD8] bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[#E8DFD8] bg-[#F7F1EC] text-xs uppercase text-gray-600">
              <tr>
                <th className="px-3 py-2">brand</th>
                <th className="px-3 py-2">source</th>
                <th className="px-3 py-2">products</th>
                <th className="px-3 py-2">official site</th>
                <th className="px-3 py-2">confidence</th>
              </tr>
            </thead>
            <tbody>
              {brands.map((b) => (
                <tr key={b.brandKey} className="border-b border-[#F0E8E2]">
                  <td className="px-3 py-2 font-medium">
                    <Link
                      href={`/admin/brands/${encodeURIComponent(b.brandKey)}`}
                      className="text-[#8B6914] underline"
                    >
                      {b.canonicalName}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{b.source}</td>
                  <td className="px-3 py-2 tabular-nums">{b.productCount}</td>
                  <td className="px-3 py-2 text-xs">
                    {b.officialWebsite ?? (
                      <span className="text-amber-800">미확인 → needs_review</span>
                    )}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {b.confidence.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminUser } from "@/lib/auth/admin";
import { seedBrandsFromCatalog } from "@/lib/pipeline/brand-discovery";
import { AdminLogoutButton } from "../../AdminLogoutButton";
import { AdminSubnav } from "../../AdminSubnav";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Admin Brand Detail | K-Beauty Match",
  robots: { index: false, follow: false },
};

export default async function AdminBrandDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminUser();
  const { id } = await params;
  const brandKey = decodeURIComponent(id);
  const brands = await seedBrandsFromCatalog(200);
  const brand = brands.find((b) => b.brandKey === brandKey);
  if (!brand) notFound();

  return (
    <main className="min-h-screen bg-[#FAF7F5] px-4 py-10 text-gray-900 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8B6914]">
              Admin
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              {brand.canonicalName}
            </h1>
            <AdminSubnav current="brands" />
          </div>
          <AdminLogoutButton className="shrink-0 rounded-lg border border-[#E8DFD8] bg-white px-3 py-1.5 text-sm font-medium text-gray-800" />
        </div>
        <p className="mt-4 text-sm">
          <Link href="/admin/brands" className="font-medium text-[#8B6914] underline">
            ← 브랜드 목록
          </Link>
        </p>
        <dl className="mt-6 space-y-3 rounded-lg border border-[#E8DFD8] bg-white px-4 py-4 text-sm">
          <div>
            <dt className="text-xs text-gray-500">brandKey</dt>
            <dd className="font-mono text-xs">{brand.brandKey}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">source</dt>
            <dd>{brand.source}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">productCount</dt>
            <dd className="tabular-nums">{brand.productCount}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">officialWebsite</dt>
            <dd>
              {brand.officialWebsite ?? (
                <span className="text-amber-800">미확인 → crawl 전 needs_review</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">confidence</dt>
            <dd className="tabular-nums">{brand.confidence.toFixed(2)}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">country</dt>
            <dd>{brand.countryCode ?? "—"}</dd>
          </div>
        </dl>
      </div>
    </main>
  );
}

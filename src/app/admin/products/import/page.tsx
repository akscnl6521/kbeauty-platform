import Link from "next/link";
import { requireAdminUser } from "@/lib/auth/admin";
import { AdminLogoutButton } from "../../AdminLogoutButton";
import { AdminSubnav } from "../../AdminSubnav";
import { ProductBulkImportClient } from "./ProductBulkImportClient";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "제품 일괄등록 | K-Beauty Match",
  robots: { index: false, follow: false },
};

export default async function AdminProductBulkImportPage() {
  await requireAdminUser();

  return (
    <main className="min-h-screen bg-[#FAF7F5] px-4 py-8 text-gray-900 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B6914]">
              관리자 · 제품 관리
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">
              제품 일괄등록
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-600">
              CSV 또는 Excel 파일로 여러 제품을 한 번에 등록합니다. 이미지는 ZIP
              으로 함께 올리거나, 파일의 image_url 칸에 안전한 HTTPS 주소를 넣을
              수 있습니다.
            </p>
          </div>
          <AdminLogoutButton />
        </div>
        <AdminSubnav current="products" />
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link href="/admin/products" className="text-[#8B6914] underline">
            ← 제품 목록
          </Link>
          <Link href="/admin/products/new" className="text-[#8B6914] underline">
            제품 1건 등록
          </Link>
        </div>
        <div className="mt-6">
          <ProductBulkImportClient />
        </div>
      </div>
    </main>
  );
}

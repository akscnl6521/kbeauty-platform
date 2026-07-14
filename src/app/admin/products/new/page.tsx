import Link from "next/link";
import { requireAdminUser } from "@/lib/auth/admin";
import { getAdminProducts } from "@/lib/admin/products";
import { AdminLogoutButton } from "../../AdminLogoutButton";
import { AdminSubnav } from "../../AdminSubnav";
import { CreateProductForm } from "./CreateProductForm";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "제품 등록 | K-Beauty Match",
  robots: { index: false, follow: false },
};

export default async function AdminCreateProductPage() {
  await requireAdminUser();

  let brands: string[] = [];
  try {
    const list = await getAdminProducts({
      page: 1,
      pageSize: 1,
      sort: "id_desc",
    });
    brands = list.filters.brands;
  } catch {
    brands = [];
  }

  return (
    <main className="min-h-screen bg-[#FAF7F5] px-4 py-8 text-gray-900 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B6914]">
              관리자
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">제품 등록</h1>
            <p className="mt-2 text-sm text-gray-600">
              브랜드·제품명·전성분·대표 이미지를 한 화면에서 입력하면 등록이
              완료됩니다. 주요 성분은 전성분에서 자동으로 골라집니다.
            </p>
          </div>
          <AdminLogoutButton />
        </div>
        <AdminSubnav current="products" />
        <div className="mt-4">
          <Link
            href="/admin/products"
            className="text-sm text-[#8B6914] underline"
          >
            ← 제품 목록
          </Link>
        </div>
        <div className="mt-6">
          <CreateProductForm existingBrands={brands} />
        </div>
      </div>
    </main>
  );
}

import Link from "next/link";
import { requireAdminUser } from "@/lib/auth/admin";
import { AdminConfigurationError } from "@/lib/auth/errors";
import {
  getAdminProducts,
  parseAdminProductListParams,
  type AdminProductListItem,
  type AdminProductListResult,
  type AdminProductSort,
} from "@/lib/admin/products";
import { AdminLogoutButton } from "../AdminLogoutButton";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Admin Products | K-Beauty Match",
  robots: { index: false, follow: false },
};

function buildProductsHref(
  filters: AdminProductListResult["filters"],
  page: number
): string {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.brand) params.set("brand", filters.brand);
  if (filters.category) params.set("category", filters.category);
  if (filters.active) params.set("active", filters.active);
  if (filters.verified) params.set("verified", filters.verified);
  if (filters.sort && filters.sort !== "id_desc") {
    params.set("sort", filters.sort);
  }
  if (page > 1) params.set("page", String(page));

  const qs = params.toString();
  return qs ? `/admin/products?${qs}` : "/admin/products";
}

function formatVerifiedAt(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toISOString().slice(0, 10);
}

function StatusCell({ item }: { item: AdminProductListItem }) {
  const activeLabel = item.active === false ? "inactive" : "active";
  const verifiedLabel = item.verifiedAt ? "verified" : "unverified";
  const offerLabel = item.offerCount > 0 ? "offer 있음" : "offer 없음";

  return (
    <div className="space-y-1 text-xs text-gray-700">
      <div>
        <span className="font-medium">{activeLabel}</span>
        {" · "}
        <span>{verifiedLabel}</span>
      </div>
      <div className="text-gray-500">{offerLabel}</div>
    </div>
  );
}

function ProductsTable({ items }: { items: AdminProductListItem[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[#E8DFD8] bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-[#E8DFD8] bg-[#F7F1EC] text-xs uppercase tracking-wide text-gray-600">
          <tr>
            <th className="px-3 py-2 font-medium">ID</th>
            <th className="px-3 py-2 font-medium">제품명</th>
            <th className="px-3 py-2 font-medium">브랜드</th>
            <th className="px-3 py-2 font-medium">카테고리</th>
            <th className="px-3 py-2 font-medium">상태</th>
            <th className="px-3 py-2 font-medium">검증일</th>
            <th className="px-3 py-2 font-medium">신뢰도</th>
            <th className="px-3 py-2 font-medium">성분 수</th>
            <th className="px-3 py-2 font-medium">offer 수</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-[#F0E8E2] last:border-0">
              <td className="px-3 py-2 tabular-nums text-gray-700">
                <Link
                  href={`/admin/products/${item.id}`}
                  className="font-medium text-[#8B6914] underline"
                >
                  {item.id}
                </Link>
              </td>
              <td className="px-3 py-2">
                <Link
                  href={`/admin/products/${item.id}`}
                  className="font-medium text-gray-900 underline decoration-[#E8DFD8] underline-offset-2 hover:text-[#8B6914]"
                >
                  {item.name}
                </Link>
              </td>
              <td className="px-3 py-2 text-gray-800">{item.brand}</td>
              <td className="px-3 py-2 text-gray-700">{item.category ?? "—"}</td>
              <td className="px-3 py-2">
                <StatusCell item={item} />
              </td>
              <td className="px-3 py-2 tabular-nums text-gray-700">
                {formatVerifiedAt(item.verifiedAt)}
              </td>
              <td className="px-3 py-2 text-gray-700">
                {item.dataConfidence ?? "—"}
              </td>
              <td className="px-3 py-2 tabular-nums text-gray-700">
                key {item.keyIngredientsCount}
                <span className="text-gray-400"> / </span>
                full {item.fullIngredientsCount}
              </td>
              <td className="px-3 py-2 tabular-nums text-gray-700">
                {item.offerCount}
                {item.verifiedOfferCount > 0 ? (
                  <span className="text-xs text-gray-500">
                    {" "}
                    (verified {item.verifiedOfferCount})
                  </span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FilterForm({
  filters,
}: {
  filters: AdminProductListResult["filters"];
}) {
  const sortOptions: Array<{ value: AdminProductSort; label: string }> = [
    { value: "id_desc", label: "ID 내림차순" },
    { value: "id_asc", label: "ID 오름차순" },
    { value: "name_asc", label: "이름 A→Z" },
    { value: "name_desc", label: "이름 Z→A" },
    { value: "verified_desc", label: "검증일 최신" },
  ];

  return (
    <form method="get" action="/admin/products" className="mt-6 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block text-sm">
          <span className="text-gray-600">검색</span>
          <input
            name="search"
            type="search"
            defaultValue={filters.search}
            placeholder="name / brand / slug"
            className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2 text-sm outline-none focus:border-[#8B6914]"
          />
        </label>
        <label className="block text-sm">
          <span className="text-gray-600">브랜드</span>
          <select
            name="brand"
            defaultValue={filters.brand}
            className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2 text-sm outline-none focus:border-[#8B6914]"
          >
            <option value="">전체</option>
            {filters.brands.map((brand) => (
              <option key={brand} value={brand}>
                {brand}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-gray-600">카테고리</span>
          <select
            name="category"
            defaultValue={filters.category}
            className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2 text-sm outline-none focus:border-[#8B6914]"
          >
            <option value="">전체</option>
            {filters.categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-gray-600">active</span>
          <select
            name="active"
            defaultValue={filters.active}
            className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2 text-sm outline-none focus:border-[#8B6914]"
          >
            <option value="">전체</option>
            <option value="true">active</option>
            <option value="false">inactive</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-gray-600">verified</span>
          <select
            name="verified"
            defaultValue={filters.verified}
            className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2 text-sm outline-none focus:border-[#8B6914]"
          >
            <option value="">전체</option>
            <option value="true">verified</option>
            <option value="false">unverified</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-gray-600">정렬</span>
          <select
            name="sort"
            defaultValue={filters.sort}
            className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2 text-sm outline-none focus:border-[#8B6914]"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="rounded-lg bg-[#8B6914] px-4 py-2 text-sm font-semibold text-white"
        >
          적용
        </button>
        <Link
          href="/admin/products"
          className="text-sm font-medium text-[#8B6914] underline"
        >
          필터 초기화
        </Link>
      </div>
    </form>
  );
}

function Pagination({
  result,
}: {
  result: AdminProductListResult;
}) {
  if (result.totalPages <= 1) return null;

  const prevPage = result.page > 1 ? result.page - 1 : null;
  const nextPage =
    result.page < result.totalPages ? result.page + 1 : null;

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-gray-600">
        {result.page} / {result.totalPages} 페이지
        <span className="text-gray-400">
          {" "}
          · 총 {result.total.toLocaleString("ko-KR")}건
        </span>
      </p>
      <div className="flex gap-3">
        {prevPage ? (
          <Link
            href={buildProductsHref(result.filters, prevPage)}
            className="font-medium text-[#8B6914] underline"
          >
            이전
          </Link>
        ) : (
          <span className="text-gray-400">이전</span>
        )}
        {nextPage ? (
          <Link
            href={buildProductsHref(result.filters, nextPage)}
            className="font-medium text-[#8B6914] underline"
          >
            다음
          </Link>
        ) : (
          <span className="text-gray-400">다음</span>
        )}
      </div>
    </div>
  );
}

/**
 * Read-only admin products list. No detail links yet (avoid 404).
 */
export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminUser();

  const params = parseAdminProductListParams(await searchParams);

  let result: AdminProductListResult | null = null;
  let loadFailed = false;

  try {
    result = await getAdminProducts(params);
  } catch (error) {
    loadFailed = true;
    if (!(error instanceof AdminConfigurationError)) {
      loadFailed = true;
    }
  }

  return (
    <main className="min-h-screen bg-[#FAF7F5] px-4 py-10 text-gray-900 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8B6914]">
              Admin
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">제품 관리</h1>
              <span className="rounded border border-[#E8DFD8] bg-white px-2 py-0.5 text-xs font-medium text-gray-700">
                읽기 전용
              </span>
            </div>
            <p className="mt-2 text-sm text-gray-600">
              기존 products를 검색·필터로 확인합니다. 자동 published 하지
              않습니다.
            </p>
          </div>
          <AdminLogoutButton className="shrink-0 rounded-lg border border-[#E8DFD8] bg-white px-3 py-1.5 text-sm font-medium text-gray-800" />
        </div>

        <p className="mt-4 text-sm">
          <Link href="/admin" className="font-medium text-[#8B6914] underline">
            대시보드로 돌아가기
          </Link>
        </p>

        {loadFailed || !result ? (
          <div
            className="mt-8 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            제품 목록을 불러오지 못했습니다.{" "}
            <Link href="/admin" className="font-medium underline">
              대시보드로 이동
            </Link>
          </div>
        ) : (
          <>
            <p className="mt-6 text-sm text-gray-700">
              총{" "}
              <span className="font-semibold tabular-nums">
                {result.total.toLocaleString("ko-KR")}
              </span>
              개
              {result.filters.search ||
              result.filters.brand ||
              result.filters.category ||
              result.filters.active ||
              result.filters.verified
                ? " (필터 적용)"
                : null}
            </p>

            <FilterForm filters={result.filters} />

            {result.items.length === 0 ? (
              <div className="mt-8 rounded-lg border border-[#E8DFD8] bg-white px-4 py-6 text-sm text-gray-600">
                조건에 맞는 제품이 없습니다.{" "}
                <Link
                  href="/admin/products"
                  className="font-medium text-[#8B6914] underline"
                >
                  필터 초기화
                </Link>
              </div>
            ) : (
              <div className="mt-6">
                <ProductsTable items={result.items} />
                <Pagination result={result} />
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

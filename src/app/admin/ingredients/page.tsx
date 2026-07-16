import Link from "next/link";
import { requireAdminUser } from "@/lib/auth/admin";
import { AdminConfigurationError } from "@/lib/auth/errors";
import {
  getAdminIngredients,
  parseAdminIngredientListParams,
  type AdminIngredientListItem,
  type AdminIngredientListResult,
  type AdminIngredientSort,
} from "@/lib/admin/ingredients";
import { AdminLogoutButton } from "../AdminLogoutButton";
import { AdminSubnav } from "../AdminSubnav";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Admin Ingredients | K-Beauty Match",
  robots: { index: false, follow: false },
};

function buildIngredientsHref(
  filters: AdminIngredientListResult["filters"],
  page: number
): string {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.active) params.set("active", filters.active);
  if (filters.verified) params.set("verified", filters.verified);
  if (filters.hasAlias) params.set("hasAlias", filters.hasAlias);
  if (filters.hasEvidence) params.set("hasEvidence", filters.hasEvidence);
  if (filters.hasCaution) params.set("hasCaution", filters.hasCaution);
  if (filters.linkedToProduct) {
    params.set("linkedToProduct", filters.linkedToProduct);
  }
  if (filters.sort && filters.sort !== "id_desc") {
    params.set("sort", filters.sort);
  }
  if (page > 1) params.set("page", String(page));

  const qs = params.toString();
  return qs ? `/admin/ingredients?${qs}` : "/admin/ingredients";
}

function StatusCell({ item }: { item: AdminIngredientListItem }) {
  return (
    <div className="space-y-1 text-xs text-gray-700">
      <div>
        active: <span className="text-gray-400">컬럼 없음</span>
      </div>
      <div>
        verified: <span className="font-medium">unverified</span>
        <span className="text-gray-400"> (verified_at 없음)</span>
      </div>
      <div className="text-gray-500">
        evidence {item.evidenceCount > 0 ? "있음" : "없음"}
        {" · "}
        caution {item.cautionCount > 0 ? "있음" : "없음"}
        {" · "}
        linked {item.linkedProductCount > 0 ? "있음" : "없음"}
      </div>
    </div>
  );
}

function IngredientsTable({ items }: { items: AdminIngredientListItem[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[#E8DFD8] bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-[#E8DFD8] bg-[#F7F1EC] text-xs uppercase tracking-wide text-gray-600">
          <tr>
            <th className="px-3 py-2 font-medium">ID</th>
            <th className="px-3 py-2 font-medium">영문명</th>
            <th className="px-3 py-2 font-medium">한글명</th>
            <th className="px-3 py-2 font-medium">INCI</th>
            <th className="px-3 py-2 font-medium">상태</th>
            <th className="px-3 py-2 font-medium">검증일</th>
            <th className="px-3 py-2 font-medium">alias</th>
            <th className="px-3 py-2 font-medium">evidence</th>
            <th className="px-3 py-2 font-medium">caution</th>
            <th className="px-3 py-2 font-medium">연결 제품</th>
            <th className="px-3 py-2 font-medium">상세</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-[#F0E8E2] last:border-0">
              <td className="px-3 py-2 tabular-nums text-gray-700">{item.id}</td>
              <td className="px-3 py-2">
                <div className="font-medium text-gray-900">{item.nameEn}</div>
                <div className="mt-0.5 text-xs text-gray-500">{item.slug}</div>
              </td>
              <td className="px-3 py-2 text-gray-800">{item.nameKo ?? "—"}</td>
              <td className="px-3 py-2 text-gray-700">{item.inciName ?? "—"}</td>
              <td className="px-3 py-2">
                <StatusCell item={item} />
              </td>
              <td className="px-3 py-2 text-gray-400">—</td>
              <td className="px-3 py-2 tabular-nums">{item.aliasCount}</td>
              <td className="px-3 py-2 tabular-nums">
                {item.evidenceCount}
                {item.evidenceLevel ? (
                  <span className="ml-1 text-xs text-gray-500">
                    ({item.evidenceLevel})
                  </span>
                ) : null}
              </td>
              <td className="px-3 py-2 tabular-nums">{item.cautionCount}</td>
              <td className="px-3 py-2 tabular-nums">
                {item.linkedProductCount}
              </td>
              <td className="px-3 py-2">
                <Link
                  href={`/admin/ingredients/${item.id}`}
                  className="font-medium text-[#8B6914] underline"
                >
                  보기
                </Link>
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
  filters: AdminIngredientListResult["filters"];
}) {
  const sortOptions: Array<{ value: AdminIngredientSort; label: string }> = [
    { value: "id_desc", label: "ID 내림차순" },
    { value: "id_asc", label: "ID 오름차순" },
    { value: "name_en_asc", label: "영문 A→Z" },
    { value: "name_en_desc", label: "영문 Z→A" },
    { value: "name_ko_asc", label: "한글 A→Z" },
    { value: "verified_desc", label: "검증일(컬럼 없음→ID)" },
  ];

  return (
    <form method="get" action="/admin/ingredients" className="mt-6 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block text-sm">
          <span className="text-gray-600">검색</span>
          <input
            name="search"
            type="search"
            defaultValue={filters.search}
            placeholder="name_en / name_ko / slug / alias"
            className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2 text-sm outline-none focus:border-[#8B6914]"
          />
        </label>
        <label className="block text-sm">
          <span className="text-gray-600">active</span>
          <select
            name="active"
            defaultValue={filters.active}
            className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2 text-sm outline-none focus:border-[#8B6914]"
          >
            <option value="">전체</option>
            <option value="true">active (컬럼 없음→전체)</option>
            <option value="false">inactive (컬럼 없음→0건)</option>
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
            <option value="true">verified (컬럼 없음→0건)</option>
            <option value="false">unverified</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-gray-600">alias</span>
          <select
            name="hasAlias"
            defaultValue={filters.hasAlias}
            className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2 text-sm outline-none focus:border-[#8B6914]"
          >
            <option value="">전체</option>
            <option value="true">있음</option>
            <option value="false">없음</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-gray-600">evidence</span>
          <select
            name="hasEvidence"
            defaultValue={filters.hasEvidence}
            className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2 text-sm outline-none focus:border-[#8B6914]"
          >
            <option value="">전체</option>
            <option value="true">있음</option>
            <option value="false">없음</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-gray-600">caution</span>
          <select
            name="hasCaution"
            defaultValue={filters.hasCaution}
            className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2 text-sm outline-none focus:border-[#8B6914]"
          >
            <option value="">전체</option>
            <option value="true">있음</option>
            <option value="false">없음</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-gray-600">제품 연결</span>
          <select
            name="linkedToProduct"
            defaultValue={filters.linkedToProduct}
            className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2 text-sm outline-none focus:border-[#8B6914]"
          >
            <option value="">전체</option>
            <option value="true">있음</option>
            <option value="false">없음</option>
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
          href="/admin/ingredients"
          className="text-sm font-medium text-[#8B6914] underline"
        >
          필터 초기화
        </Link>
      </div>
      <p className="text-xs text-gray-500">
        참고: ingredients 테이블에 active / verified_at / inci_name 컬럼이
        없습니다. INCI는 alias_type=inci 별칭만 표시합니다. evidence 존재 ≠
        ingredient verified.
      </p>
    </form>
  );
}

function Pagination({ result }: { result: AdminIngredientListResult }) {
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
            href={buildIngredientsHref(result.filters, prevPage)}
            className="font-medium text-[#8B6914] underline"
          >
            이전
          </Link>
        ) : (
          <span className="text-gray-400">이전</span>
        )}
        {nextPage ? (
          <Link
            href={buildIngredientsHref(result.filters, nextPage)}
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
 * Read-only ingredients list.
 */
export default async function AdminIngredientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminUser();

  const params = parseAdminIngredientListParams(await searchParams);

  let result: AdminIngredientListResult | null = null;
  let loadFailed = false;

  try {
    result = await getAdminIngredients(params);
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
              <h1 className="text-3xl font-bold tracking-tight">성분 관리</h1>
              <span className="rounded border border-[#E8DFD8] bg-white px-2 py-0.5 text-xs font-medium text-gray-700">
                읽기 전용
              </span>
            </div>
            <p className="mt-2 text-sm text-gray-600">
              ingredients와 alias·evidence·caution·제품 연결 수를 확인합니다.
              생성·수정·검증 버튼은 없습니다.
            </p>
            <AdminSubnav current="ingredients" />
          </div>
          <AdminLogoutButton className="shrink-0 rounded-lg border border-[#E8DFD8] bg-white px-3 py-1.5 text-sm font-medium text-gray-800" />
        </div>

        {loadFailed || !result ? (
          <div
            className="mt-8 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            성분 목록을 불러오지 못했습니다.{" "}
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
            </p>

            <FilterForm filters={result.filters} />

            {result.items.length === 0 ? (
              <div className="mt-8 rounded-lg border border-[#E8DFD8] bg-white px-4 py-6 text-sm text-gray-600">
                {result.filters.search ||
                result.filters.active ||
                result.filters.verified ||
                result.filters.hasAlias ||
                result.filters.hasEvidence ||
                result.filters.hasCaution ||
                result.filters.linkedToProduct ? (
                  <>
                    <p className="font-medium text-gray-800">
                      조건에 맞는 성분이 없습니다.
                    </p>
                    <p className="mt-3">
                      <Link
                        href="/admin/ingredients"
                        className="font-medium text-[#8B6914] underline"
                      >
                        필터 초기화
                      </Link>
                    </p>
                  </>
                ) : (
                  <p className="font-medium text-gray-800">
                    등록된 성분 데이터가 없습니다.
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-6">
                <IngredientsTable items={result.items} />
                <Pagination result={result} />
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

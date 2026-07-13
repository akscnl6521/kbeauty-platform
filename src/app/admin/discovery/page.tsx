import Link from "next/link";
import { requireAdminUser } from "@/lib/auth/admin";
import { AdminConfigurationError } from "@/lib/auth/errors";
import {
  getAdminDiscoveryCandidates,
  parseAdminDiscoveryListParams,
  type AdminDiscoveryListItem,
  type AdminDiscoveryListResult,
  type AdminDiscoverySort,
  type DiscoveryWorkflowStatus,
} from "@/lib/admin/discovery";
import { AdminLogoutButton } from "../AdminLogoutButton";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Admin Discovery | K-Beauty Match",
  robots: { index: false, follow: false },
};

function buildDiscoveryHref(
  filters: AdminDiscoveryListResult["filters"],
  page: number
): string {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.workflowStatus) {
    params.set("workflowStatus", filters.workflowStatus);
  }
  if (filters.country) params.set("country", filters.country);
  if (filters.sourceType) params.set("sourceType", filters.sourceType);
  if (filters.linked) params.set("linked", filters.linked);
  if (filters.assigned) params.set("assigned", filters.assigned);
  if (filters.sort && filters.sort !== "newest") {
    params.set("sort", filters.sort);
  }
  if (page > 1) params.set("page", String(page));

  const qs = params.toString();
  return qs ? `/admin/discovery?${qs}` : "/admin/discovery";
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toISOString().slice(0, 10);
}

function workflowBadgeClass(status: string): string {
  switch (status as DiscoveryWorkflowStatus) {
    case "published":
      return "bg-emerald-50 text-emerald-800 border-emerald-200";
    case "verified":
      return "bg-violet-50 text-violet-800 border-violet-200";
    case "needs_review":
      return "bg-amber-50 text-amber-900 border-amber-200";
    case "rejected":
      return "bg-red-50 text-red-800 border-red-200";
    case "discovered":
      return "bg-gray-50 text-gray-700 border-gray-200";
    default:
      return "bg-sky-50 text-sky-800 border-sky-200";
  }
}

function SourceCell({ item }: { item: AdminDiscoveryListItem }) {
  return (
    <div className="space-y-1 text-xs">
      <div className="text-gray-700">{item.sourceType ?? "—"}</div>
      {item.sourceUrlSafeHttps && item.sourceUrl ? (
        <a
          href={item.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-[#8B6914] underline"
        >
          출처 열기
        </a>
      ) : (
        <span className="text-gray-400">링크 비활성</span>
      )}
    </div>
  );
}

function DiscoveryTable({ items }: { items: AdminDiscoveryListItem[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[#E8DFD8] bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-[#E8DFD8] bg-[#F7F1EC] text-xs uppercase tracking-wide text-gray-600">
          <tr>
            <th className="px-3 py-2 font-medium">후보명</th>
            <th className="px-3 py-2 font-medium">브랜드</th>
            <th className="px-3 py-2 font-medium">국가</th>
            <th className="px-3 py-2 font-medium">출처</th>
            <th className="px-3 py-2 font-medium">workflow</th>
            <th className="px-3 py-2 font-medium">제품 연결</th>
            <th className="px-3 py-2 font-medium">검토 큐</th>
            <th className="px-3 py-2 font-medium">생성일</th>
            <th className="px-3 py-2 font-medium">상세</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-[#F0E8E2] last:border-0">
              <td className="px-3 py-2">
                <div className="font-medium text-gray-900">
                  {item.candidateName}
                </div>
                <div className="mt-0.5 text-xs text-gray-500">
                  duplicate: {item.duplicateStatus}
                  {item.isAssigned ? " · assigned" : ""}
                </div>
              </td>
              <td className="px-3 py-2 text-gray-800">
                {item.brandName ?? "—"}
              </td>
              <td className="px-3 py-2 text-gray-700">
                {item.country ?? "—"}
              </td>
              <td className="px-3 py-2">
                <SourceCell item={item} />
              </td>
              <td className="px-3 py-2">
                <span
                  className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${workflowBadgeClass(item.workflowStatus)}`}
                >
                  {item.workflowStatus}
                </span>
              </td>
              <td className="px-3 py-2 text-sm text-gray-700">
                {item.isLinked && item.linkedProductId != null ? (
                  <Link
                    href={`/admin/products/${item.linkedProductId}`}
                    className="font-medium text-[#8B6914] underline"
                  >
                    #{item.linkedProductId}
                  </Link>
                ) : (
                  <span className="text-gray-400">미연결</span>
                )}
              </td>
              <td className="px-3 py-2 tabular-nums text-gray-700">
                {item.queueCount}
                {item.openQueueCount > 0 ? (
                  <span className="text-xs text-amber-800">
                    {" "}
                    (open {item.openQueueCount})
                  </span>
                ) : null}
              </td>
              <td className="px-3 py-2 tabular-nums text-gray-700">
                {formatDate(item.createdAt)}
              </td>
              <td className="px-3 py-2">
                <span className="text-xs text-gray-400">상세 준비 중</span>
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
  filters: AdminDiscoveryListResult["filters"];
}) {
  const sortOptions: Array<{ value: AdminDiscoverySort; label: string }> = [
    { value: "newest", label: "최신순" },
    { value: "oldest", label: "오래된순" },
    { value: "name_asc", label: "이름 A→Z" },
    { value: "name_desc", label: "이름 Z→A" },
    { value: "status_asc", label: "status A→Z" },
    { value: "status_desc", label: "status Z→A" },
  ];

  return (
    <form method="get" action="/admin/discovery" className="mt-6 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block text-sm">
          <span className="text-gray-600">검색</span>
          <input
            name="search"
            type="search"
            defaultValue={filters.search}
            placeholder="name / brand / url"
            className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2 text-sm outline-none focus:border-[#8B6914]"
          />
        </label>
        <label className="block text-sm">
          <span className="text-gray-600">workflow status</span>
          <select
            name="workflowStatus"
            defaultValue={filters.workflowStatus}
            className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2 text-sm outline-none focus:border-[#8B6914]"
          >
            <option value="">전체</option>
            {filters.workflowStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-gray-600">국가</span>
          <select
            name="country"
            defaultValue={filters.country}
            className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2 text-sm outline-none focus:border-[#8B6914]"
          >
            <option value="">전체</option>
            {filters.countries.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-gray-600">source type</span>
          <select
            name="sourceType"
            defaultValue={filters.sourceType}
            className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2 text-sm outline-none focus:border-[#8B6914]"
          >
            <option value="">전체</option>
            {filters.sourceTypes.map((sourceType) => (
              <option key={sourceType} value={sourceType}>
                {sourceType}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-gray-600">linked</span>
          <select
            name="linked"
            defaultValue={filters.linked}
            className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2 text-sm outline-none focus:border-[#8B6914]"
          >
            <option value="">전체</option>
            <option value="true">연결됨</option>
            <option value="false">미연결</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-gray-600">담당</span>
          <select
            name="assigned"
            defaultValue={filters.assigned}
            className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2 text-sm outline-none focus:border-[#8B6914]"
          >
            <option value="">전체</option>
            <option value="true">assigned</option>
            <option value="false">unassigned</option>
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
          href="/admin/discovery"
          className="text-sm font-medium text-[#8B6914] underline"
        >
          필터 초기화
        </Link>
      </div>
    </form>
  );
}

function Pagination({ result }: { result: AdminDiscoveryListResult }) {
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
            href={buildDiscoveryHref(result.filters, prevPage)}
            className="font-medium text-[#8B6914] underline"
          >
            이전
          </Link>
        ) : (
          <span className="text-gray-400">이전</span>
        )}
        {nextPage ? (
          <Link
            href={buildDiscoveryHref(result.filters, nextPage)}
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
 * Read-only discovery candidates list. Detail route not implemented yet.
 */
export default async function AdminDiscoveryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminUser();

  const params = parseAdminDiscoveryListParams(await searchParams);

  let result: AdminDiscoveryListResult | null = null;
  let loadFailed = false;

  try {
    result = await getAdminDiscoveryCandidates(params);
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
              <h1 className="text-3xl font-bold tracking-tight">
                제품 발견 후보
              </h1>
              <span className="rounded border border-[#E8DFD8] bg-white px-2 py-0.5 text-xs font-medium text-gray-700">
                읽기 전용
              </span>
            </div>
            <p className="mt-2 text-sm text-gray-600">
              product_discovery_candidates와 검토 큐 현황을 확인합니다. 상태
              변경·승인·publish는 이 화면에서 하지 않습니다.
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
            발견 후보 목록을 불러오지 못했습니다.{" "}
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
                <p className="font-medium text-gray-800">
                  등록된 제품 발견 후보가 없습니다.
                </p>
                <p className="mt-2">
                  검색·검증 파이프라인이 시작되면 후보가 여기에 표시됩니다.
                </p>
                {(result.filters.search ||
                  result.filters.workflowStatus ||
                  result.filters.country ||
                  result.filters.sourceType ||
                  result.filters.linked ||
                  result.filters.assigned) && (
                  <p className="mt-3">
                    <Link
                      href="/admin/discovery"
                      className="font-medium text-[#8B6914] underline"
                    >
                      필터 초기화
                    </Link>
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-6">
                <DiscoveryTable items={result.items} />
                <Pagination result={result} />
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

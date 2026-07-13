import Link from "next/link";
import { requireAdminUser } from "@/lib/auth/admin";
import { AdminConfigurationError } from "@/lib/auth/errors";
import {
  getAdminVerificationQueue,
  parseAdminVerificationListParams,
  type AdminVerificationListItem,
  type AdminVerificationListResult,
  type AdminVerificationSort,
} from "@/lib/admin/verification";
import { AdminLogoutButton } from "../AdminLogoutButton";
import { AdminSubnav } from "../AdminSubnav";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Admin Verification | K-Beauty Match",
  robots: { index: false, follow: false },
};

function buildHref(
  filters: AdminVerificationListResult["filters"],
  page: number
): string {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.entityType) params.set("entityType", filters.entityType);
  if (filters.reviewType) params.set("reviewType", filters.reviewType);
  if (filters.status) params.set("status", filters.status);
  if (filters.assigned) params.set("assigned", filters.assigned);
  if (filters.sort && filters.sort !== "newest") {
    params.set("sort", filters.sort);
  }
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/admin/verification?${qs}` : "/admin/verification";
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toISOString().slice(0, 10);
}

function VerificationTable({ items }: { items: AdminVerificationListItem[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[#E8DFD8] bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-[#E8DFD8] bg-[#F7F1EC] text-xs uppercase tracking-wide text-gray-600">
          <tr>
            <th className="px-3 py-2 font-medium">entity</th>
            <th className="px-3 py-2 font-medium">review</th>
            <th className="px-3 py-2 font-medium">status</th>
            <th className="px-3 py-2 font-medium">priority</th>
            <th className="px-3 py-2 font-medium">assigned</th>
            <th className="px-3 py-2 font-medium">created</th>
            <th className="px-3 py-2 font-medium">상세</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-[#F0E8E2] last:border-0">
              <td className="px-3 py-2">
                <div className="font-medium text-gray-900">{item.entityType}</div>
                <div className="mt-0.5 max-w-[14rem] truncate text-xs text-gray-500">
                  {item.entityId}
                </div>
              </td>
              <td className="px-3 py-2">{item.reviewType}</td>
              <td className="px-3 py-2">{item.status}</td>
              <td className="px-3 py-2 tabular-nums">{item.priority}</td>
              <td className="px-3 py-2">
                {item.isAssigned ? "yes" : "no"}
              </td>
              <td className="px-3 py-2 tabular-nums">
                {formatDate(item.createdAt)}
              </td>
              <td className="px-3 py-2">
                <Link
                  href={`/admin/verification/${item.id}`}
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
  filters: AdminVerificationListResult["filters"];
}) {
  const sortOptions: Array<{ value: AdminVerificationSort; label: string }> = [
    { value: "newest", label: "최신순" },
    { value: "oldest", label: "오래된순" },
    { value: "priority_desc", label: "우선순위 높음" },
    { value: "priority_asc", label: "우선순위 낮음" },
    { value: "status_asc", label: "status A→Z" },
    { value: "status_desc", label: "status Z→A" },
  ];

  return (
    <form method="get" action="/admin/verification" className="mt-6 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block text-sm">
          <span className="text-gray-600">검색</span>
          <input
            type="search"
            name="search"
            defaultValue={filters.search}
            placeholder="entity_id / reason / notes"
            className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="text-gray-600">entity_type</span>
          <select
            name="entityType"
            defaultValue={filters.entityType}
            className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2"
          >
            <option value="">전체</option>
            {filters.entityTypes.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-gray-600">review_type</span>
          <select
            name="reviewType"
            defaultValue={filters.reviewType}
            className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2"
          >
            <option value="">전체</option>
            {filters.reviewTypes.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-gray-600">status</span>
          <select
            name="status"
            defaultValue={filters.status}
            className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2"
          >
            <option value="">전체</option>
            {filters.statuses.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-gray-600">assigned</span>
          <select
            name="assigned"
            defaultValue={filters.assigned}
            className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2"
          >
            <option value="">전체</option>
            <option value="true">yes</option>
            <option value="false">no</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-gray-600">정렬</span>
          <select
            name="sort"
            defaultValue={filters.sort}
            className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          className="rounded-lg bg-[#8B6914] px-4 py-2 text-sm font-medium text-white"
        >
          적용
        </button>
        <Link
          href="/admin/verification"
          className="rounded-lg border border-[#E8DFD8] bg-white px-4 py-2 text-sm font-medium text-gray-800"
        >
          초기화
        </Link>
      </div>
    </form>
  );
}

function Pagination({ result }: { result: AdminVerificationListResult }) {
  if (result.totalPages <= 1) return null;
  const prev = result.page > 1 ? buildHref(result.filters, result.page - 1) : null;
  const next =
    result.page < result.totalPages
      ? buildHref(result.filters, result.page + 1)
      : null;

  return (
    <div className="mt-4 flex items-center justify-between gap-3 text-sm">
      <p className="text-gray-600">
        {result.page} / {result.totalPages} 페이지
      </p>
      <div className="flex gap-2">
        {prev ? (
          <Link
            href={prev}
            className="rounded-lg border border-[#E8DFD8] bg-white px-3 py-1.5 font-medium text-gray-800"
          >
            이전
          </Link>
        ) : (
          <span className="rounded-lg border border-transparent px-3 py-1.5 text-gray-400">
            이전
          </span>
        )}
        {next ? (
          <Link
            href={next}
            className="rounded-lg border border-[#E8DFD8] bg-white px-3 py-1.5 font-medium text-gray-800"
          >
            다음
          </Link>
        ) : (
          <span className="rounded-lg border border-transparent px-3 py-1.5 text-gray-400">
            다음
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Read-only verification queue list. No approve/reject actions.
 */
export default async function AdminVerificationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminUser();

  const params = parseAdminVerificationListParams(await searchParams);

  let result: AdminVerificationListResult | null = null;
  let loadFailed = false;

  try {
    result = await getAdminVerificationQueue(params);
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
              <h1 className="text-3xl font-bold tracking-tight">검증 큐</h1>
              <span className="rounded border border-[#E8DFD8] bg-white px-2 py-0.5 text-xs font-medium text-gray-700">
                읽기 전용
              </span>
            </div>
            <p className="mt-2 text-sm text-gray-600">
              verification_queue를 확인합니다. 승인·반려·상태변경은 없습니다.
            </p>
            <AdminSubnav current="verification" />
          </div>
          <AdminLogoutButton className="shrink-0 rounded-lg border border-[#E8DFD8] bg-white px-3 py-1.5 text-sm font-medium text-gray-800" />
        </div>

        {loadFailed || !result ? (
          <div
            className="mt-8 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            검증 큐를 불러오지 못했습니다.{" "}
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
                result.filters.entityType ||
                result.filters.reviewType ||
                result.filters.status ||
                result.filters.assigned ? (
                  <>
                    <p className="font-medium text-gray-800">
                      조건에 맞는 큐 항목이 없습니다.
                    </p>
                    <p className="mt-3">
                      <Link
                        href="/admin/verification"
                        className="font-medium text-[#8B6914] underline"
                      >
                        필터 초기화
                      </Link>
                    </p>
                  </>
                ) : (
                  <p className="font-medium text-gray-800">
                    검증 큐가 비어 있습니다. (0건 · seed 금지)
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-6">
                <VerificationTable items={result.items} />
                <Pagination result={result} />
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

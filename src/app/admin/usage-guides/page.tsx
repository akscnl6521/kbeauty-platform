import Link from "next/link";
import { requireAdminUser } from "@/lib/auth/admin";
import { AdminConfigurationError } from "@/lib/auth/errors";
import {
  getUsageGuideQueue,
  type UsageGuideReviewItem,
} from "@/lib/admin/usageGuideReview";
import { AdminLogoutButton } from "../AdminLogoutButton";
import { AdminSubnav } from "../AdminSubnav";
import { StatusText } from "@/components/admin/StatusMark";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Admin 사용 가이드 검수 | K-Beauty Match",
  robots: { index: false, follow: false },
};

const STATUS_LABEL: Record<string, string> = {
  draft: "작성 중",
  needs_review: "검수 대기",
  approved: "승인",
  rejected: "반려",
  expired: "만료",
  superseded: "대체됨",
};

const REASON_LABEL: Record<string, string> = {
  method_steps_missing: "사용 단계 없음",
  medical_claim_present: "의학적 표현 포함",
  source_missing: "출처 없음",
  source_excerpt_missing: "원문 발췌 없음",
  patch_test_steps_missing: "패치테스트 단계 없음",
};

const FREQUENCY_LABEL: Record<string, string> = {
  morning: "아침",
  evening: "저녁",
  weekly: "주간",
  as_needed: "필요할 때",
};

function Row({ item }: { item: UsageGuideReviewItem }) {
  const { guide } = item;
  return (
    <tr className="border-b border-[#F0E8E2] align-top last:border-0">
      <td className="px-3 py-3">
        <div className="font-medium text-gray-900">
          {guide.productName ?? `제품 #${guide.productId}`}
        </div>
        <div className="mt-0.5 text-xs text-gray-500">
          {guide.brand ?? "—"} · {guide.locale}
        </div>
        {guide.sourceDomain ? (
          <div className="mt-1 text-xs text-gray-500">{guide.sourceDomain}</div>
        ) : null}
      </td>
      <td className="px-3 py-3 text-sm">
        <div>{guide.amountLabel ?? <span className="text-gray-400">—</span>}</div>
      </td>
      <td className="px-3 py-3 text-sm">
        {guide.applicationArea.length > 0 ? (
          guide.applicationArea.join(", ")
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </td>
      <td className="px-3 py-3 text-sm">
        {guide.frequency ? (
          (FREQUENCY_LABEL[guide.frequency] ?? guide.frequency)
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </td>
      <td className="px-3 py-3 text-sm tabular-nums">{guide.methodSteps.length}</td>
      <td className="px-3 py-3 text-sm">
        <div>
          {guide.cautionText.length > 0 ? (
            `제품 ${guide.cautionText.length}`
          ) : (
            <span className="text-gray-400">제품 0</span>
          )}
        </div>
        <div className="text-xs text-gray-500">법정 {guide.statutoryNotices.length}</div>
      </td>
      <td className="px-3 py-3 text-sm">
        {STATUS_LABEL[guide.verificationStatus] ?? guide.verificationStatus}
        {item.blockingReasons.length > 0 ? (
          <div className="mt-1 text-xs">
            <StatusText state="fail">
              {item.blockingReasons
                .map((code) => REASON_LABEL[code] ?? code)
                .join(" · ")}
            </StatusText>
          </div>
        ) : null}
        {item.unmatchedFields.length > 0 ? (
          <div className="mt-1 text-xs">
            <StatusText state="warn">원문 대조 불일치</StatusText>
          </div>
        ) : null}
      </td>
      <td className="px-3 py-3">
        <Link
          href={`/admin/usage-guides/${guide.id}`}
          className="font-medium text-[#8B6914] underline"
        >
          검수
        </Link>
      </td>
    </tr>
  );
}

/**
 * §36.5 usage guidance review queue. Standalone screen — no public surface reads
 * these rows, and approving one does not put it on any page.
 */
export default async function AdminUsageGuidesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminUser();
  const params = await searchParams;

  let result: Awaited<ReturnType<typeof getUsageGuideQueue>> | null = null;
  let loadFailed = false;
  try {
    result = await getUsageGuideQueue(params);
  } catch (error) {
    loadFailed = true;
    if (!(error instanceof AdminConfigurationError)) loadFailed = true;
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
              <h1 className="text-3xl font-bold tracking-tight">사용 가이드 검수</h1>
              <span className="rounded border border-[#E8DFD8] bg-white px-2 py-0.5 text-xs font-medium text-gray-700">
                사용자 화면 미노출
              </span>
            </div>
            <p className="mt-2 text-sm text-gray-600">
              공식 제품 페이지에서 추출한 도포량·사용 순서·사용 부위·주의사항을
              원문과 대조해 확인합니다. 승인해도 사용자 화면에는 나타나지 않습니다.
            </p>
            <AdminSubnav current="usage-guides" />
          </div>
          <AdminLogoutButton className="shrink-0 rounded-lg border border-[#E8DFD8] bg-white px-3 py-1.5 text-sm font-medium text-gray-800" />
        </div>

        {loadFailed || !result ? (
          <div
            className="mt-8 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            사용 가이드 큐를 불러오지 못했습니다.{" "}
            <Link href="/admin" className="font-medium underline">
              대시보드로 이동
            </Link>
          </div>
        ) : !result.schemaReady ? (
          <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 px-4 py-5 text-sm text-amber-900">
            <p className="font-semibold">사용 가이드 스키마가 아직 없습니다.</p>
            <p className="mt-2">
              Supabase Dashboard의 SQL Editor(Staging)에서 아래 파일을 실행한 뒤
              이 화면을 새로고침하세요.
            </p>
            <p className="mt-2 font-mono text-xs">{result.migrationPath}</p>
            <p className="mt-2 text-xs">
              실행 후 확인:{" "}
              <span className="font-mono">npm run verify:usage-guides-staging</span>
              , 적재: <span className="font-mono">npm run usage:ingest-guides -- --write</span>
            </p>
          </div>
        ) : (
          <>
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-700">
              <span>
                전체{" "}
                <span className="font-semibold tabular-nums">
                  {result.total.toLocaleString("ko-KR")}
                </span>
                건
              </span>
              {Object.entries(result.counts).map(([status, count]) => (
                <span key={status}>
                  {STATUS_LABEL[status] ?? status}{" "}
                  <span className="font-semibold tabular-nums">{count}</span>
                </span>
              ))}
            </div>

            <form method="get" action="/admin/usage-guides" className="mt-6 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <label className="block text-sm">
                  <span className="text-gray-600">검수 상태</span>
                  <select
                    name="status"
                    defaultValue={result.filters.status}
                    className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2"
                  >
                    <option value="">전체</option>
                    {Object.entries(STATUS_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="text-gray-600">언어</span>
                  <select
                    name="locale"
                    defaultValue={result.filters.locale}
                    className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2"
                  >
                    <option value="">전체</option>
                    <option value="ko">한국어</option>
                    <option value="en">English</option>
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
                  href="/admin/usage-guides"
                  className="rounded-lg border border-[#E8DFD8] bg-white px-4 py-2 text-sm font-medium text-gray-800"
                >
                  초기화
                </Link>
              </div>
            </form>

            {result.items.length === 0 ? (
              <div className="mt-8 rounded-lg border border-[#E8DFD8] bg-white px-4 py-6 text-sm text-gray-600">
                <p className="font-medium text-gray-800">
                  검수할 사용 가이드가 없습니다. (0건 · 임의 생성 금지)
                </p>
                <p className="mt-2">
                  수집: <span className="font-mono text-xs">npm run usage:collect-guides</span>{" "}
                  → 적재:{" "}
                  <span className="font-mono text-xs">
                    npm run usage:ingest-guides -- --write
                  </span>
                </p>
              </div>
            ) : (
              <div
                role="region"
                aria-label="사용 가이드 검수 목록"
                tabIndex={0}
                className="mt-6 overflow-x-auto rounded-lg border border-[#E8DFD8] bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B6914]"
              >
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-[#E8DFD8] bg-[#F7F1EC] text-xs uppercase tracking-wide text-gray-600">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-medium">제품</th>
                      <th scope="col" className="px-3 py-2 font-medium">도포량</th>
                      <th scope="col" className="px-3 py-2 font-medium">부위</th>
                      <th scope="col" className="px-3 py-2 font-medium">시점</th>
                      <th scope="col" className="px-3 py-2 font-medium">단계</th>
                      <th scope="col" className="px-3 py-2 font-medium">주의</th>
                      <th scope="col" className="px-3 py-2 font-medium">상태</th>
                      <th scope="col" className="px-3 py-2 font-medium">이동</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.items.map((item) => (
                      <Row key={item.guide.id} item={item} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

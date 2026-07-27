import Link from "next/link";
import { requireAdminUser } from "@/lib/auth/admin";
import { AdminConfigurationError } from "@/lib/auth/errors";
import {
  getMediaReviewQueue,
  type MediaReviewItem,
  type MediaReviewListResult,
} from "@/lib/admin/mediaReview";
import { AdminLogoutButton } from "../AdminLogoutButton";
import { AdminSubnav } from "../AdminSubnav";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Admin 영상 검수 | K-Beauty Match",
  robots: { index: false, follow: false },
};

const STATUS_LABEL: Record<string, string> = {
  draft: "작성 중",
  needs_review: "검수 대기",
  approved: "승인",
  rejected: "반려",
  expired: "권리 만료",
  revoked: "권리 철회",
};

const SCOPE_LABEL: Record<string, string> = {
  category_common: "카테고리 공통",
  product_specific: "제품 전용",
  brand_general: "브랜드 일반",
};

const REASON_LABEL: Record<string, string> = {
  media_source_missing: "영상 주소 없음",
  https_required: "https 아님",
  unauthorized_copy: "무단 복제본",
  copy_not_permitted: "복제 권리 없음",
  embed_id_missing: "임베드 id 없음",
  media_not_approved: "아직 승인 전",
  verified_at_missing: "승인일 없음",
  media_unreachable: "영상 접속 불가",
  medical_claim_forbidden: "의학적 표현 포함",
  before_after_manual_review: "전후 비교 — 수동 확인 필요",
  category_common_must_not_name_product: "공통 영상인데 제품명 노출",
  ai_disclosure_missing: "AI 생성 고지 없음",
  rights_record_missing: "권리 기록 없음",
  rights_expired: "권리 만료",
  rights_not_started: "권리 시작 전",
  rights_not_publishable: "공개 불가 권리",
  embed_not_permitted: "임베드 불가",
  territory_not_covered: "지역 범위 밖",
  disclosure_missing: "고지 문구 없음",
  disclosure_type_mismatch: "고지 유형 불일치",
  sponsorship_disclosure_missing: "협찬 고지 없음",
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toISOString().slice(0, 10);
}

function Pill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={
        ok
          ? "inline-flex items-center rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-800"
          : "inline-flex items-center rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-800"
      }
    >
      {ok ? "✓" : "✕"} {label}
    </span>
  );
}

function ReviewRow({ item }: { item: MediaReviewItem }) {
  const { asset, checklist } = item;
  return (
    <tr className="border-b border-[#F0E8E2] align-top last:border-0">
      <td className="px-3 py-3">
        <div className="font-medium text-gray-900">{asset.title}</div>
        <div className="mt-0.5 text-xs text-gray-500">
          {SCOPE_LABEL[asset.scope] ?? asset.scope} · {asset.assetType}
          {asset.categorySlug ? ` · ${asset.categorySlug}` : ""}
        </div>
        {asset.sourceUrl ? (
          <div className="mt-1 max-w-[22rem] truncate text-xs text-gray-500">
            {asset.sourceUrl}
          </div>
        ) : null}
      </td>
      <td className="px-3 py-3 text-sm">
        <div>{asset.sourceType}</div>
        <div className="mt-0.5 text-xs text-gray-500">
          {item.rights.length > 0 ? item.rights[0].rightsStatus : "권리 기록 없음"}
        </div>
      </td>
      <td className="px-3 py-3 text-sm">
        {STATUS_LABEL[asset.verificationStatus] ?? asset.verificationStatus}
      </td>
      <td className="px-3 py-3">
        <div className="flex flex-wrap gap-1">
          <Pill ok={checklist.officialSource} label="공식 출처" />
          <Pill ok={checklist.rightsRecorded} label="권리 기록" />
          <Pill ok={checklist.rightsWindowActive} label="권리 유효" />
          <Pill ok={checklist.copyLegal} label="복제 없음" />
          <Pill ok={checklist.disclosureSatisfied} label="고지" />
          <Pill ok={checklist.reachable} label="접속" />
        </div>
        {item.blockingReasons.length > 0 ? (
          <div className="mt-1.5 text-xs text-red-800">
            {item.blockingReasons
              .map((code) => REASON_LABEL[code] ?? code)
              .join(" · ")}
          </div>
        ) : (
          <div className="mt-1.5 text-xs text-emerald-800">공개 조건 충족</div>
        )}
      </td>
      <td className="px-3 py-3 text-sm tabular-nums">
        {item.rights.length > 0 ? formatDate(item.rights[0].rightsEndAt) : "—"}
      </td>
      <td className="px-3 py-3">
        <Link
          href={`/admin/media-review/${asset.id}`}
          className="font-medium text-[#8B6914] underline"
        >
          검수
        </Link>
      </td>
    </tr>
  );
}

function FilterForm({ filters }: { filters: MediaReviewListResult["filters"] }) {
  return (
    <form method="get" action="/admin/media-review" className="mt-6 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block text-sm">
          <span className="text-gray-600">검수 상태</span>
          <select
            name="status"
            defaultValue={filters.status}
            className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2"
          >
            <option value="">전체</option>
            {filters.statuses.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABEL[value] ?? value}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-gray-600">영상 범위</span>
          <select
            name="scope"
            defaultValue={filters.scope}
            className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2"
          >
            <option value="">전체</option>
            <option value="category_common">카테고리 공통</option>
            <option value="product_specific">제품 전용</option>
            <option value="brand_general">브랜드 일반</option>
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
          href="/admin/media-review"
          className="rounded-lg border border-[#E8DFD8] bg-white px-4 py-2 text-sm font-medium text-gray-800"
        >
          초기화
        </Link>
      </div>
    </form>
  );
}

/**
 * Usage-video review queue (§36). Standalone screen — it does not touch
 * /routine or /results, and no user-facing surface reads these assets yet.
 */
export default async function AdminMediaReviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminUser();

  const params = await searchParams;
  let result: Awaited<ReturnType<typeof getMediaReviewQueue>> | null = null;
  let loadFailed = false;

  try {
    result = await getMediaReviewQueue({
      page: params.page ?? null,
      status: params.status ?? null,
      scope: params.scope ?? null,
    });
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
              <h1 className="text-3xl font-bold tracking-tight">영상 검수</h1>
              <span className="rounded border border-[#E8DFD8] bg-white px-2 py-0.5 text-xs font-medium text-gray-700">
                사용자 화면 미노출
              </span>
            </div>
            <p className="mt-2 text-sm text-gray-600">
              제품 사용 영상의 출처·권리·고지를 확인합니다. 승인해도 아직 사용자
              화면에는 나타나지 않습니다.
            </p>
            <AdminSubnav current="media-review" />
          </div>
          <AdminLogoutButton className="shrink-0 rounded-lg border border-[#E8DFD8] bg-white px-3 py-1.5 text-sm font-medium text-gray-800" />
        </div>

        {loadFailed || !result ? (
          <div
            className="mt-8 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            영상 검수 큐를 불러오지 못했습니다.{" "}
            <Link href="/admin" className="font-medium underline">
              대시보드로 이동
            </Link>
          </div>
        ) : !result.schemaReady ? (
          <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 px-4 py-5 text-sm text-amber-900">
            <p className="font-semibold">미디어 라이브러리 스키마가 아직 없습니다.</p>
            <p className="mt-2">
              Supabase Dashboard의 SQL Editor(Staging)에서 아래 파일을 실행한 뒤
              이 화면을 새로고침하세요.
            </p>
            <p className="mt-2 font-mono text-xs">{result.migrationPath}</p>
            <p className="mt-2 text-xs">
              실행 후 확인: <span className="font-mono">npm run verify:media-library-staging</span>
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

            <FilterForm filters={result.filters} />

            {result.items.length === 0 ? (
              <div className="mt-8 rounded-lg border border-[#E8DFD8] bg-white px-4 py-6 text-sm text-gray-600">
                <p className="font-medium text-gray-800">
                  검수할 영상이 없습니다. (0건 · 임의 생성 금지)
                </p>
                <p className="mt-2">
                  카테고리 공통 영상 확보 결과는{" "}
                  <span className="font-mono text-xs">
                    docs/media-category-common-sourcing.md
                  </span>{" "}
                  에 기록되어 있습니다.
                </p>
              </div>
            ) : (
              <div className="mt-6 overflow-x-auto rounded-lg border border-[#E8DFD8] bg-white">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-[#E8DFD8] bg-[#F7F1EC] text-xs uppercase tracking-wide text-gray-600">
                    <tr>
                      <th className="px-3 py-2 font-medium">영상</th>
                      <th className="px-3 py-2 font-medium">출처 / 권리</th>
                      <th className="px-3 py-2 font-medium">상태</th>
                      <th className="px-3 py-2 font-medium">검수 항목</th>
                      <th className="px-3 py-2 font-medium">권리 만료</th>
                      <th className="px-3 py-2 font-medium">이동</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.items.map((item) => (
                      <ReviewRow key={item.asset.id} item={item} />
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

import { requireAdminUser } from "@/lib/auth/admin";
import {
  getUnifiedReviewManifest,
  type ManifestDeliverySource,
  type ReviewPriority,
  type ReviewSource,
  type UnifiedReviewItem,
} from "@/lib/admin/unified-review";
import { AdminSubnav } from "../AdminSubnav";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "통합 검수 | K-Beauty Match Admin",
  robots: { index: false, follow: false },
};

const SOURCE_LABELS: Record<ReviewSource, string> = {
  catalog_refresh: "제품 정보 갱신",
  catalog_exception: "제품 예외",
  clinic_review: "피부과 후보",
};
const PRIORITY_LABELS: Record<ReviewPriority, string> = {
  critical: "긴급",
  high: "높음",
  medium: "보통",
  low: "낮음",
};
const DELIVERY_LABELS: Record<ManifestDeliverySource, string> = {
  remote_preview: "Preview 원격 JSON",
  local_file: "로컬 생성 파일",
  none: "연결 없음",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type ReviewDetails = {
  before: string | null;
  after: string | null;
  evidence: string | null;
  sourceUrl: string | null;
  verifiedAt: string | null;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
function validSource(value: string): ReviewSource | "all" {
  return value === "catalog_refresh" || value === "catalog_exception" || value === "clinic_review" ? value : "all";
}
function validPriority(value: string): ReviewPriority | "all" {
  return value === "critical" || value === "high" || value === "medium" || value === "low" ? value : "all";
}
function formatDateTime(value: string | null, fallback = "아직 생성되지 않음") {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("ko-KR", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Seoul",
      }).format(date);
}
function primitiveText(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}
function pickText(payload: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = primitiveText(payload[key]);
    if (value) return value;
  }
  return null;
}
function safeHttpsUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
function reviewDetails(item: UnifiedReviewItem): ReviewDetails {
  const payload = item.payload;
  return {
    before: pickText(payload, ["before", "previousValue", "oldValue", "currentValue", "current"]),
    after: pickText(payload, ["after", "proposedValue", "newValue", "nextValue", "proposed"]),
    evidence: pickText(payload, ["evidenceSummary", "evidence", "reason", "reviewReason", "sourceName"]),
    sourceUrl: safeHttpsUrl(pickText(payload, ["evidenceUrl", "sourceUrl", "officialUrl", "url"])),
    verifiedAt: pickText(payload, ["lastVerifiedAt", "verifiedAt", "lastCheckedAt", "checkedAt"]),
  };
}
function payloadPreview(item: UnifiedReviewItem) {
  const hiddenKeys = new Set([
    "before", "previousValue", "oldValue", "currentValue", "current",
    "after", "proposedValue", "newValue", "nextValue", "proposed",
    "evidenceSummary", "evidence", "reason", "reviewReason", "sourceName",
    "evidenceUrl", "sourceUrl", "officialUrl", "url",
    "lastVerifiedAt", "verifiedAt", "lastCheckedAt", "checkedAt",
  ]);
  return Object.entries(item.payload)
    .filter(([key, value]) => !hiddenKeys.has(key) && ["string", "number", "boolean"].includes(typeof value))
    .slice(0, 4);
}
function matchesQuery(item: UnifiedReviewItem, query: string) {
  if (!query) return true;
  const haystack = [item.id, item.title, item.source, item.priority, ...Object.values(item.payload)]
    .filter((value) => ["string", "number", "boolean"].includes(typeof value))
    .join(" ")
    .toLocaleLowerCase("ko-KR");
  return haystack.includes(query.toLocaleLowerCase("ko-KR"));
}

export default async function UnifiedReviewPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdminUser();
  const params = await searchParams;
  const source = validSource(first(params.source));
  const priority = validPriority(first(params.priority));
  const query = first(params.q).trim().slice(0, 100);

  let loadError = false;
  let manifest;
  try {
    manifest = await getUnifiedReviewManifest();
  } catch {
    loadError = true;
    manifest = null;
  }

  const filteredItems = manifest?.items.filter(
    (item) =>
      (source === "all" || item.source === source) &&
      (priority === "all" || item.priority === priority) &&
      matchesQuery(item, query),
  ) ?? [];
  const filtersActive = source !== "all" || priority !== "all" || Boolean(query);

  return (
    <main className="min-h-screen bg-[#FAF7F5] px-4 py-10 text-gray-900 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8B6914]">Admin</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">통합 검수</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-600">
          제품 갱신, 제품 예외, 피부과 추천 후보를 한곳에서 확인하는 읽기 전용 화면입니다.
          이 화면에서는 DB 수정, 게시 승인, Production 반영을 하지 않습니다.
        </p>
        <AdminSubnav current="review" />

        {loadError || !manifest ? (
          <div role="alert" className="mt-8 rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800">
            통합 검수 매니페스트를 읽지 못했습니다. 원격 URL, 파일 형식과 안전 플래그를 확인해 주세요.
          </div>
        ) : (
          <>
            <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {(["critical", "high", "medium", "low"] as ReviewPriority[]).map((itemPriority) => (
                <div key={itemPriority} className="rounded-xl border border-[#E8DFD8] bg-white px-4 py-4">
                  <p className="text-xs text-gray-500">{PRIORITY_LABELS[itemPriority]}</p>
                  <p className="mt-1 text-3xl font-semibold tabular-nums">
                    {manifest.countsByPriority[itemPriority].toLocaleString("ko-KR")}
                  </p>
                </div>
              ))}
            </section>

            <section className="mt-4 rounded-xl border border-[#E8DFD8] bg-white px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold">안전 상태</h2>
                  <p className="mt-1 text-sm text-gray-600">생성 시각: {formatDateTime(manifest.generatedAt)}</p>
                  <p className="mt-1 text-xs text-gray-500">전달 경로: {DELIVERY_LABELS[manifest.deliverySource]}</p>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                  읽기 전용 · 자동 게시 차단
                </span>
              </div>
            </section>

            <section className="mt-4 grid gap-3 sm:grid-cols-3">
              {(["catalog_refresh", "catalog_exception", "clinic_review"] as ReviewSource[]).map((itemSource) => (
                <div key={itemSource} className="rounded-xl border border-[#E8DFD8] bg-white px-4 py-4">
                  <p className="text-sm text-gray-600">{SOURCE_LABELS[itemSource]}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">
                    {manifest.countsBySource[itemSource].toLocaleString("ko-KR")}
                  </p>
                </div>
              ))}
            </section>

            <section className="mt-6 rounded-xl border border-[#E8DFD8] bg-white p-4">
              <form method="get" className="grid gap-3 md:grid-cols-[1fr_180px_160px_auto]">
                <label className="text-sm font-medium">
                  검색
                  <input name="q" defaultValue={query} maxLength={100} placeholder="제품명, 항목 ID, 근거 검색" className="mt-1 w-full rounded-lg border border-[#D9CCC2] bg-white px-3 py-2 font-normal" />
                </label>
                <label className="text-sm font-medium">
                  출처
                  <select name="source" defaultValue={source} className="mt-1 w-full rounded-lg border border-[#D9CCC2] bg-white px-3 py-2 font-normal">
                    <option value="all">전체</option>
                    {Object.entries(SOURCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="text-sm font-medium">
                  우선순위
                  <select name="priority" defaultValue={priority} className="mt-1 w-full rounded-lg border border-[#D9CCC2] bg-white px-3 py-2 font-normal">
                    <option value="all">전체</option>
                    {Object.entries(PRIORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <div className="flex items-end gap-2">
                  <button type="submit" className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white">적용</button>
                  <a href="/admin/review" className="rounded-lg border border-[#D9CCC2] px-4 py-2 text-sm font-semibold">초기화</a>
                </div>
              </form>
            </section>

            <section className="mt-8">
              <h2 className="text-xl font-semibold">검수 항목</h2>
              <p className="mt-1 text-sm text-gray-600">
                {filtersActive ? `검색 결과 ${filteredItems.length.toLocaleString("ko-KR")}건 / 전체 ` : "총 "}
                {manifest.total.toLocaleString("ko-KR")}건 · 긴급도 순
              </p>

              {!manifest.available ? (
                <div className="mt-4 rounded-xl border border-dashed border-[#D9CCC2] bg-white px-5 py-8 text-center">
                  <p className="font-medium">배포 환경에 연결된 검수 파일이 없습니다.</p>
                  <p className="mt-2 text-sm text-gray-600">
                    Preview에서는 HTTPS 원격 JSON 주소를 서버 전용 환경변수 UNIFIED_REVIEW_MANIFEST_URL로 연결해야 합니다. Production에서는 이 원격 경로를 자동으로 무시합니다.
                  </p>
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="mt-4 rounded-xl border border-[#E8DFD8] bg-white px-5 py-8 text-center">
                  <p className="font-medium">{filtersActive ? "조건에 맞는 검수 항목이 없습니다." : "현재 검수할 예외가 없습니다."}</p>
                  <p className="mt-2 text-sm text-gray-600">필터를 초기화하거나 다음 자동화 결과를 확인해 주세요.</p>
                </div>
              ) : (
                <ul className="mt-4 space-y-3">
                  {filteredItems.map((item) => {
                    const details = reviewDetails(item);
                    const hasEvidenceDetails = Boolean(details.before || details.after || details.evidence || details.sourceUrl || details.verifiedAt);
                    const preview = payloadPreview(item);
                    return (
                      <li key={item.id} className="rounded-xl border border-[#E8DFD8] bg-white px-4 py-4">
                        <div className="flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full bg-[#F3ECE7] px-2 py-1 font-medium text-gray-700">{SOURCE_LABELS[item.source]}</span>
                          <span className="rounded-full bg-amber-50 px-2 py-1 font-medium text-amber-800">{PRIORITY_LABELS[item.priority]}</span>
                        </div>
                        <h3 className="mt-3 font-semibold">{item.title}</h3>
                        <p className="mt-1 text-xs text-gray-500">{item.id}</p>

                        {hasEvidenceDetails ? (
                          <section aria-label="검수 근거" className="mt-4 rounded-lg bg-[#FAF7F5] p-3">
                            <h4 className="text-sm font-semibold">검수 근거</h4>
                            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                              {details.before ? <div><dt className="text-xs text-gray-500">변경 전</dt><dd className="mt-1 break-words text-gray-800">{details.before}</dd></div> : null}
                              {details.after ? <div><dt className="text-xs text-gray-500">변경 후</dt><dd className="mt-1 break-words text-gray-800">{details.after}</dd></div> : null}
                              {details.evidence ? <div className="sm:col-span-2"><dt className="text-xs text-gray-500">근거</dt><dd className="mt-1 whitespace-pre-wrap break-words text-gray-800">{details.evidence}</dd></div> : null}
                              {details.verifiedAt ? <div><dt className="text-xs text-gray-500">마지막 확인일</dt><dd className="mt-1 text-gray-800">{formatDateTime(details.verifiedAt, details.verifiedAt)}</dd></div> : null}
                              {details.sourceUrl ? <div><dt className="text-xs text-gray-500">공식 출처</dt><dd className="mt-1"><a href={details.sourceUrl} target="_blank" rel="noreferrer" className="font-medium text-blue-700 underline underline-offset-2">새 창에서 확인</a></dd></div> : null}
                            </dl>
                          </section>
                        ) : null}

                        {preview.length > 0 ? (
                          <dl className="mt-4 grid gap-x-6 gap-y-2 border-t border-[#EFE7E2] pt-3 text-sm sm:grid-cols-2">
                            {preview.map(([key, value]) => (
                              <div key={key} className="min-w-0"><dt className="text-xs text-gray-500">{key}</dt><dd className="truncate text-gray-800">{String(value)}</dd></div>
                            ))}
                          </dl>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

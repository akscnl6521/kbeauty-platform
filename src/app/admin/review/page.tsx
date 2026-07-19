import { requireAdminUser } from "@/lib/auth/admin";
import {
  getUnifiedReviewManifest,
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

function formatGeneratedAt(value: string | null) {
  if (!value) return "아직 생성되지 않음";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("ko-KR", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Seoul",
      }).format(date);
}

function payloadPreview(item: UnifiedReviewItem) {
  return Object.entries(item.payload)
    .filter(([, value]) =>
      ["string", "number", "boolean"].includes(typeof value),
    )
    .slice(0, 4);
}

export default async function UnifiedReviewPage() {
  await requireAdminUser();

  let loadError = false;
  let manifest;
  try {
    manifest = await getUnifiedReviewManifest();
  } catch {
    loadError = true;
    manifest = null;
  }

  return (
    <main className="min-h-screen bg-[#FAF7F5] px-4 py-10 text-gray-900 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8B6914]">
          Admin
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">통합 검수</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-600">
          제품 갱신, 제품 예외, 피부과 추천 후보를 한곳에서 확인하는 읽기 전용
          화면입니다. 이 화면에서는 DB 수정, 게시 승인, Production 반영을 하지
          않습니다.
        </p>
        <AdminSubnav current="review" />

        {loadError || !manifest ? (
          <div
            role="alert"
            className="mt-8 rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800"
          >
            통합 검수 매니페스트를 읽지 못했습니다. 파일 형식과 안전 플래그를
            확인해 주세요.
          </div>
        ) : (
          <>
            <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {(
                ["critical", "high", "medium", "low"] as ReviewPriority[]
              ).map((priority) => (
                <div
                  key={priority}
                  className="rounded-xl border border-[#E8DFD8] bg-white px-4 py-4"
                >
                  <p className="text-xs text-gray-500">
                    {PRIORITY_LABELS[priority]}
                  </p>
                  <p className="mt-1 text-3xl font-semibold tabular-nums">
                    {manifest.countsByPriority[priority].toLocaleString("ko-KR")}
                  </p>
                </div>
              ))}
            </section>

            <section className="mt-4 rounded-xl border border-[#E8DFD8] bg-white px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold">안전 상태</h2>
                  <p className="mt-1 text-sm text-gray-600">
                    생성 시각: {formatGeneratedAt(manifest.generatedAt)}
                  </p>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                  읽기 전용 · 자동 게시 차단
                </span>
              </div>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-gray-500">DB 변경</dt>
                  <dd className="font-medium">없음</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Production 변경</dt>
                  <dd className="font-medium">없음</dd>
                </div>
                <div>
                  <dt className="text-gray-500">게시 허용</dt>
                  <dd className="font-medium">차단</dd>
                </div>
              </dl>
            </section>

            <section className="mt-4 grid gap-3 sm:grid-cols-3">
              {(
                [
                  "catalog_refresh",
                  "catalog_exception",
                  "clinic_review",
                ] as ReviewSource[]
              ).map((source) => (
                <div
                  key={source}
                  className="rounded-xl border border-[#E8DFD8] bg-white px-4 py-4"
                >
                  <p className="text-sm text-gray-600">{SOURCE_LABELS[source]}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">
                    {manifest.countsBySource[source].toLocaleString("ko-KR")}
                  </p>
                </div>
              ))}
            </section>

            <section className="mt-8">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">검수 항목</h2>
                  <p className="mt-1 text-sm text-gray-600">
                    총 {manifest.total.toLocaleString("ko-KR")}건 · 긴급도 순
                  </p>
                </div>
              </div>

              {!manifest.available ? (
                <div className="mt-4 rounded-xl border border-dashed border-[#D9CCC2] bg-white px-5 py-8 text-center">
                  <p className="font-medium">아직 통합 검수 파일이 없습니다.</p>
                  <p className="mt-2 text-sm text-gray-600">
                    정기 자동화가 실행되면 제품 갱신·예외·피부과 후보가 이곳에
                    표시됩니다.
                  </p>
                </div>
              ) : manifest.items.length === 0 ? (
                <div className="mt-4 rounded-xl border border-[#E8DFD8] bg-white px-5 py-8 text-center">
                  <p className="font-medium">현재 검수할 예외가 없습니다.</p>
                  <p className="mt-2 text-sm text-gray-600">
                    정상 데이터는 자동화 흐름을 유지하고, 예외만 이 화면에
                    표시됩니다.
                  </p>
                </div>
              ) : (
                <ul className="mt-4 space-y-3">
                  {manifest.items.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-xl border border-[#E8DFD8] bg-white px-4 py-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap gap-2 text-xs">
                            <span className="rounded-full bg-[#F3ECE7] px-2 py-1 font-medium text-gray-700">
                              {SOURCE_LABELS[item.source]}
                            </span>
                            <span className="rounded-full bg-amber-50 px-2 py-1 font-medium text-amber-800">
                              {PRIORITY_LABELS[item.priority]}
                            </span>
                          </div>
                          <h3 className="mt-3 font-semibold">{item.title}</h3>
                          <p className="mt-1 text-xs text-gray-500">{item.id}</p>
                        </div>
                      </div>

                      {payloadPreview(item).length > 0 ? (
                        <dl className="mt-4 grid gap-x-6 gap-y-2 border-t border-[#EFE7E2] pt-3 text-sm sm:grid-cols-2">
                          {payloadPreview(item).map(([key, value]) => (
                            <div key={key} className="min-w-0">
                              <dt className="text-xs text-gray-500">{key}</dt>
                              <dd className="truncate text-gray-800">
                                {String(value)}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

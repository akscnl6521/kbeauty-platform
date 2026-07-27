import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminUser } from "@/lib/auth/admin";
import { getUsageGuideItem } from "@/lib/admin/usageGuideReview";
import { AdminLogoutButton } from "../../AdminLogoutButton";
import { AdminSubnav } from "../../AdminSubnav";
import { UsageGuideDecisionPanel } from "../UsageGuideDecisionPanel";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Admin 사용 가이드 상세 | K-Beauty Match",
  robots: { index: false, follow: false },
};

const REASON_LABEL: Record<string, string> = {
  method_steps_missing: "사용 단계가 없습니다",
  medical_claim_present: "의학적 표현이 포함되어 있습니다",
  source_missing: "출처가 없습니다",
  source_excerpt_missing: "원문 발췌가 없어 대조할 수 없습니다",
  patch_test_steps_missing: "패치테스트 단계가 없습니다",
};

const FREQUENCY_LABEL: Record<string, string> = {
  morning: "아침",
  evening: "저녁",
  weekly: "주간",
  as_needed: "필요할 때",
};

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toISOString().replace("T", " ").slice(0, 16);
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border-b border-[#F0E8E2] py-2 last:border-0">
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-gray-900">{value}</dd>
    </div>
  );
}

export default async function AdminUsageGuideDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminUser();
  const { id } = await params;

  const result = await getUsageGuideItem(id);
  if (!result) notFound();

  if ("schemaReady" in result) {
    return (
      <main className="min-h-screen bg-[#FAF7F5] px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-3xl rounded-lg border border-amber-200 bg-amber-50 px-4 py-5 text-sm text-amber-900">
          <p className="font-semibold">사용 가이드 스키마가 아직 없습니다.</p>
          <p className="mt-2 font-mono text-xs">{result.migrationPath}</p>
          <p className="mt-3">
            <Link href="/admin/usage-guides" className="font-medium underline">
              목록으로
            </Link>
          </p>
        </div>
      </main>
    );
  }

  const { guide } = result;

  return (
    <main className="min-h-screen bg-[#FAF7F5] px-4 py-10 text-gray-900 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8B6914]">
              Admin
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight">
              {guide.productName ?? `제품 #${guide.productId}`}
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              추출된 값이 실제로 원문에 있는지 대조하세요. 승인해도 사용자 화면에는
              나타나지 않습니다.
            </p>
            <AdminSubnav current="usage-guides" />
          </div>
          <AdminLogoutButton className="shrink-0 rounded-lg border border-[#E8DFD8] bg-white px-3 py-1.5 text-sm font-medium text-gray-800" />
        </div>

        <p className="mt-6 text-sm">
          <Link
            href="/admin/usage-guides"
            className="font-medium text-[#8B6914] underline"
          >
            ← 검수 목록
          </Link>
        </p>

        <div
          className={
            result.approvable
              ? "mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
              : "mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
          }
        >
          {result.approvable ? (
            <p className="font-medium">근거 요건을 충족합니다.</p>
          ) : (
            <>
              <p className="font-medium">아직 승인할 수 없습니다.</p>
              <ul className="mt-2 list-disc pl-5">
                {result.blockingReasons.map((code) => (
                  <li key={code}>{REASON_LABEL[code] ?? code}</li>
                ))}
              </ul>
            </>
          )}
        </div>

        {result.unmatchedFields.length > 0 ? (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-medium">
              아래 값은 저장된 원문 발췌에서 찾지 못했습니다. 추출 오류일 수 있으니
              원문을 직접 확인하세요.
            </p>
            <ul className="mt-2 list-disc pl-5">
              {result.unmatchedFields.map((field) => (
                <li key={field}>{field}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <section className="mt-6 grid gap-6 sm:grid-cols-2">
          <div className="rounded-lg border border-[#E8DFD8] bg-white px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">§36.5 항목</h2>
            <dl className="mt-2">
              <Field label="도포량" value={guide.amountLabel ?? "—"} />
              <Field
                label="사용 부위"
                value={guide.applicationArea.join(", ") || "—"}
              />
              <Field
                label="아침·저녁 구분"
                value={
                  guide.frequency
                    ? (FREQUENCY_LABEL[guide.frequency] ?? guide.frequency)
                    : "—"
                }
              />
              <Field
                label="사용 순서 (원문 표현)"
                value={guide.orderHints.join(", ") || "—"}
              />
              <Field label="루틴 내 순서" value={guide.orderIndex} />
              <Field label="언어" value={guide.locale} />
              <Field
                label="추출되지 않은 항목"
                value={guide.missingFields.join(", ") || "없음"}
              />
            </dl>
          </div>

          <div className="rounded-lg border border-[#E8DFD8] bg-white px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">출처</h2>
            <dl className="mt-2">
              <Field label="출처 유형" value={guide.sourceType} />
              <Field
                label="원문 주소"
                value={
                  guide.sourceUrl ? (
                    <a
                      href={guide.sourceUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-[#8B6914] underline"
                    >
                      {guide.sourceUrl}
                    </a>
                  ) : (
                    "—"
                  )
                }
              />
              <Field label="도메인" value={guide.sourceDomain ?? "—"} />
              <Field label="추출 방식" value={guide.extractionMethod} />
              <Field
                label="의학적 표현"
                value={guide.containsMedicalClaim ? "있음" : "없음"}
              />
              <Field label="검수 상태" value={guide.verificationStatus} />
              <Field label="승인일" value={formatDateTime(guide.verifiedAt)} />
              <Field
                label="마지막 확인 / 재확인 기한"
                value={`${formatDateTime(guide.lastCheckedAt)} / ${formatDateTime(guide.nextCheckDueAt)}`}
              />
            </dl>
          </div>
        </section>

        <section className="mt-6 rounded-lg border border-[#E8DFD8] bg-white px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">바르는 방법</h2>
          {guide.methodSteps.length === 0 ? (
            <p className="mt-2 text-sm text-red-800">사용 단계가 없습니다.</p>
          ) : (
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
              {guide.methodSteps.map((step, index) => (
                <li key={`${index}-${step.slice(0, 12)}`}>{step}</li>
              ))}
            </ol>
          )}
        </section>

        <section className="mt-6 grid gap-6 sm:grid-cols-2">
          <div className="rounded-lg border border-[#E8DFD8] bg-white px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">
              제품별 주의사항
            </h2>
            {guide.cautionText.length === 0 ? (
              <p className="mt-2 text-sm text-gray-600">
                이 제품에만 해당하는 주의사항은 없었습니다.
              </p>
            ) : (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {guide.cautionText.map((caution, index) => (
                  <li key={`${index}-${caution.slice(0, 12)}`}>{caution}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-lg border border-[#E8DFD8] bg-white px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">
              법정 표시 문구
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              화장품법상 모든 제품에 동일하게 붙는 문구입니다. 제품 고유 정보가
              아닙니다.
            </p>
            {guide.statutoryNotices.length === 0 ? (
              <p className="mt-2 text-sm text-gray-600">—</p>
            ) : (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
                {guide.statutoryNotices.map((notice, index) => (
                  <li key={`${index}-${notice.slice(0, 12)}`}>{notice}</li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="mt-6 rounded-lg border border-[#E8DFD8] bg-white px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">원문 발췌</h2>
          <p className="mt-1 text-xs text-gray-500">
            추출에 사용된 원문입니다. 위 값들이 여기에 실제로 있는지 확인하세요.
          </p>
          <pre
            role="region"
            aria-label="원문 발췌"
            tabIndex={0}
            className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded border border-[#F0E8E2] bg-[#FBF8F6] p-3 text-xs leading-relaxed text-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B6914]"
          >
            {guide.sourceExcerpt ?? "저장된 원문 발췌가 없습니다."}
          </pre>
        </section>

        <section className="mt-6 rounded-lg border border-[#E8DFD8] bg-white px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">검수 결정</h2>
          <UsageGuideDecisionPanel
            guideId={guide.id}
            canApprove={result.approvable}
          />
        </section>
      </div>
    </main>
  );
}

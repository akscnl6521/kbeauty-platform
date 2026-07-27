import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminUser } from "@/lib/auth/admin";
import { getMediaReviewItem } from "@/lib/admin/mediaReview";
import { AdminLogoutButton } from "../../AdminLogoutButton";
import { AdminSubnav } from "../../AdminSubnav";
import { MediaReviewDecisionPanel } from "../MediaReviewDecisionPanel";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Admin 영상 검수 상세 | K-Beauty Match",
  robots: { index: false, follow: false },
};

const REASON_LABEL: Record<string, string> = {
  media_source_missing: "영상 주소 없음",
  https_required: "https 아님",
  unauthorized_copy: "무단 복제본 — 외부 영상은 저장할 수 없습니다",
  copy_not_permitted: "복제 권리 없음",
  embed_id_missing: "임베드 id 없음",
  media_not_approved: "아직 승인 전",
  verified_at_missing: "승인일 없음",
  media_unreachable: "영상 접속 불가",
  medical_claim_forbidden: "의학적 표현 포함",
  before_after_manual_review: "전후 비교 — 수동 확인 필요",
  category_common_must_not_name_product: "공통 영상인데 제품명이 노출됩니다",
  ai_disclosure_missing: "AI 생성 고지 없음",
  rights_record_missing: "권리 기록 없음",
  rights_expired: "권리 만료",
  rights_not_started: "권리 시작 전",
  rights_not_publishable: "공개 불가 권리 상태",
  embed_not_permitted: "임베드 불가",
  territory_not_covered: "지역 범위 밖",
  disclosure_missing: "고지 문구 없음",
  disclosure_type_mismatch: "고지 유형 불일치",
  sponsorship_disclosure_missing: "협찬 고지 없음",
};

function formatDateTime(value: string | null | undefined): string {
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

export default async function AdminMediaReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminUser();
  const { id } = await params;

  const result = await getMediaReviewItem(id);
  if (!result) notFound();

  if ("schemaReady" in result) {
    return (
      <main className="min-h-screen bg-[#FAF7F5] px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-3xl rounded-lg border border-amber-200 bg-amber-50 px-4 py-5 text-sm text-amber-900">
          <p className="font-semibold">미디어 라이브러리 스키마가 아직 없습니다.</p>
          <p className="mt-2 font-mono text-xs">{result.migrationPath}</p>
          <p className="mt-3">
            <Link href="/admin/media-review" className="font-medium underline">
              목록으로
            </Link>
          </p>
        </div>
      </main>
    );
  }

  const item = result;
  const { asset, checklist } = item;

  return (
    <main className="min-h-screen bg-[#FAF7F5] px-4 py-10 text-gray-900 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8B6914]">
              Admin
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight">{asset.title}</h1>
            <p className="mt-2 text-sm text-gray-600">
              승인해도 사용자 화면에는 노출되지 않습니다. 노출은 별도 트랙입니다.
            </p>
            <AdminSubnav current="media-review" />
          </div>
          <AdminLogoutButton className="shrink-0 rounded-lg border border-[#E8DFD8] bg-white px-3 py-1.5 text-sm font-medium text-gray-800" />
        </div>

        <p className="mt-6 text-sm">
          <Link href="/admin/media-review" className="font-medium text-[#8B6914] underline">
            ← 검수 목록
          </Link>
        </p>

        <div
          className={
            item.publishable
              ? "mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
              : "mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
          }
        >
          {item.publishable ? (
            <p className="font-medium">공개 조건을 모두 충족합니다.</p>
          ) : (
            <>
              <p className="font-medium">아직 공개할 수 없습니다.</p>
              <ul className="mt-2 list-disc pl-5">
                {item.blockingReasons.map((code) => (
                  <li key={code}>{REASON_LABEL[code] ?? code}</li>
                ))}
              </ul>
            </>
          )}
        </div>

        <section className="mt-6 grid gap-6 sm:grid-cols-2">
          <div className="rounded-lg border border-[#E8DFD8] bg-white px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">영상</h2>
            <dl className="mt-2">
              <Field label="범위" value={asset.scope} />
              <Field label="유형" value={asset.assetType} />
              <Field label="카테고리" value={asset.categorySlug ?? "—"} />
              <Field label="루틴 단계" value={asset.routineStep ?? "—"} />
              <Field label="아침/저녁" value={asset.timeOfDay ?? "—"} />
              <Field
                label="길이"
                value={asset.durationSeconds ? `${asset.durationSeconds}초` : "—"}
              />
              <Field label="언어 / 국가" value={`${asset.language} / ${asset.country ?? "—"}`} />
              <Field label="검수 상태" value={asset.verificationStatus} />
              <Field label="승인일" value={formatDateTime(asset.verifiedAt)} />
            </dl>
          </div>

          <div className="rounded-lg border border-[#E8DFD8] bg-white px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">출처</h2>
            <dl className="mt-2">
              <Field label="출처 유형" value={asset.sourceType} />
              <Field
                label="영상 주소"
                value={
                  asset.sourceUrl ? (
                    <a
                      href={asset.sourceUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-[#8B6914] underline"
                    >
                      {asset.sourceUrl}
                    </a>
                  ) : (
                    "—"
                  )
                }
              />
              <Field label="채널" value={asset.embedProvider} />
              <Field
                label="저장 사본"
                value={asset.storageUrl ? asset.storageUrl : "없음 (링크·임베드만)"}
              />
              <Field label="고지 관계" value={asset.contentRelationship} />
              <Field label="고지 문구" value={asset.disclosure ?? "—"} />
              <Field label="AI 생성" value={asset.isAiGenerated ? "예" : "아니오"} />
              <Field
                label="마지막 접속 확인"
                value={formatDateTime(asset.verifiedAt ?? null)}
              />
            </dl>
          </div>
        </section>

        <section className="mt-6 rounded-lg border border-[#E8DFD8] bg-white px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">권리</h2>
          {item.rights.length === 0 ? (
            <p className="mt-2 text-sm text-red-800">
              권리 기록이 없습니다. 권리 기록 없이는 승인할 수 없습니다.
            </p>
          ) : (
            <div className="mt-2 space-y-4">
              {item.rights.map((grant) => {
                const note = item.rightsNotes.find((entry) => entry.id === grant.id);
                return (
                  <dl key={grant.id} className="rounded border border-[#F0E8E2] px-3 py-2">
                    <Field label="권리 상태" value={grant.rightsStatus} />
                    <Field label="권리 근거" value={grant.rightsBasis} />
                    <Field label="권리자" value={grant.rightsHolder} />
                    <Field
                      label="허용 범위"
                      value={[
                        grant.allowsEmbed ? "임베드" : null,
                        grant.allowsCopy ? "복제" : null,
                        grant.allowsDownload ? "다운로드" : null,
                        grant.allowsModification ? "편집" : null,
                      ]
                        .filter(Boolean)
                        .join(", ") || "없음"}
                    />
                    <Field
                      label="유효 기간"
                      value={`${formatDateTime(grant.rightsStartAt)} ~ ${formatDateTime(grant.rightsEndAt)}`}
                    />
                    <Field
                      label="지역"
                      value={
                        grant.isWorldwide
                          ? "전 세계"
                          : grant.territoryCodes.join(", ") || "—"
                      }
                    />
                    <Field
                      label="근거 자료"
                      value={
                        grant.evidenceUrl ? (
                          <a
                            href={grant.evidenceUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="text-[#8B6914] underline"
                          >
                            {grant.evidenceUrl}
                          </a>
                        ) : (
                          "—"
                        )
                      }
                    />
                    <Field label="재확인 기한" value={formatDateTime(grant.reviewDueAt)} />
                    {note?.evidenceNote ? (
                      <Field label="비고" value={note.evidenceNote} />
                    ) : null}
                  </dl>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-6 rounded-lg border border-[#E8DFD8] bg-white px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">검수 항목</h2>
          <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
            {(
              [
                ["httpsSource", "https 주소"],
                ["officialSource", "공식 출처"],
                ["rightsRecorded", "권리 기록 존재"],
                ["rightsWindowActive", "권리 유효 기간 내"],
                ["rightsEvidencePresent", "권리 근거 자료"],
                ["copyLegal", "무단 복제 아님"],
                ["disclosureSatisfied", "고지 충족"],
                ["noMedicalClaim", "의학적 표현 없음"],
                ["categoryCommonClean", "공통 영상 제품명 없음"],
                ["reachable", "영상 접속 가능"],
              ] as const
            ).map(([key, label]) => (
              <li key={key} className={checklist[key] ? "text-emerald-800" : "text-red-800"}>
                {checklist[key] ? "✓" : "✕"} {label}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-6 rounded-lg border border-[#E8DFD8] bg-white px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">검수 결정</h2>
          <MediaReviewDecisionPanel assetId={asset.id} canApprove={item.publishable} />
        </section>
      </div>
    </main>
  );
}

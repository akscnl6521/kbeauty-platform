import Link from "next/link";
import { requireAdminUser } from "@/lib/auth/admin";
import { AdminSubnav } from "@/app/admin/AdminSubnav";
import { runClinicCandidateCollection } from "@/lib/clinic/clinicCollection";
import {
  advanceClinicReviewStatus,
  checkClinicFields,
  isClinicPublishable,
} from "@/lib/clinic/clinicVerification";
import {
  listConsultationLeadDryRun,
  maskLeadContact,
} from "@/lib/clinic/consultationLead";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "병원 후보 검수 | K-Beauty Match Admin",
};

export default async function AdminClinicsPage() {
  await requireAdminUser();
  const collection = await runClinicCandidateCollection();
  const leads = listConsultationLeadDryRun().slice(0, 20);

  const rows = collection.candidates.map((clinic) => {
    const check = checkClinicFields(clinic);
    const publishable = isClinicPublishable(clinic);
    const reviewTry = advanceClinicReviewStatus(clinic, "mark_admin_reviewed");
    return { clinic, check, publishable, reviewTry };
  });

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-8 text-gray-900">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        Admin · Stage 6
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">병원 후보 검수</h1>
      <p className="mt-2 text-sm text-gray-600">
        공식 수집·필드 검증·제휴 표시·게시 게이트를 읽기 전용으로 확인합니다. fixture는
        게시할 수 없고, Production 쓰기는 없습니다.
      </p>
      <AdminSubnav current="clinics" />

      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-semibold">수집 결과</h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-gray-500">mode</dt>
            <dd className="font-medium">{collection.mode}</dd>
          </div>
          <div>
            <dt className="text-gray-500">후보 수</dt>
            <dd className="font-medium">{collection.candidates.length}</dd>
          </div>
          <div>
            <dt className="text-gray-500">publishAllowed</dt>
            <dd className="font-medium">{String(collection.publishAllowed)}</dd>
          </div>
          <div>
            <dt className="text-gray-500">실패/차단</dt>
            <dd className="font-medium">{collection.failures.length}</dd>
          </div>
        </dl>
        {collection.failures.length > 0 ? (
          <ul className="mt-3 space-y-1 text-xs text-amber-900">
            {collection.failures.map((failure) => (
              <li key={`${failure.adapterId}-${failure.failure}`}>
                [{failure.adapterId}] {failure.failure}: {failure.detail}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="text-lg font-semibold">후보 목록</h2>
        {rows.map(({ clinic, check, publishable, reviewTry }) => (
          <article
            key={clinic.id}
            className="rounded-2xl border border-gray-200 bg-white p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold">{clinic.name}</h3>
                <p className="mt-1 text-xs text-gray-500">{clinic.id}</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border px-2 py-1">
                  {clinic.verificationStatus}
                </span>
                <span className="rounded-full border px-2 py-1">
                  {clinic.isPartner ? "제휴" : "Organic"}
                </span>
                <span className="rounded-full border px-2 py-1">
                  {publishable ? "사용자 노출 가능" : "사용자 비노출"}
                </span>
                {clinic.fixtureOnly ? (
                  <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-amber-900">
                    fixtureOnly
                  </span>
                ) : null}
              </div>
            </div>
            <p className="mt-2 text-sm text-gray-700">
              증상: {clinic.symptomTags.join(", ") || "없음"} · 전문:{" "}
              {clinic.specialties.join(", ") || "없음"}
            </p>
            <p className="mt-1 text-xs text-gray-600">
              주소: {clinic.address ?? "미확인"} · 운영:{" "}
              {clinic.operatingHours ?? "미확인"} · 언어:{" "}
              {clinic.languages.join(", ") || "미확인"} · 예산대:{" "}
              {clinic.consultationBudgetBand}
            </p>
            {clinic.isPartner && clinic.partnershipDisclosure ? (
              <p className="mt-2 text-xs text-violet-800">{clinic.partnershipDisclosure}</p>
            ) : null}
            <p className="mt-2 text-xs text-gray-500">
              필드 검사: {check.ok ? "통과" : "부족"} (
              {check.reasons.join(", ") || "none"})
            </p>
            <p className="mt-1 text-xs text-gray-500">
              admin_reviewed 시도: {reviewTry.ok ? "가능" : "불가"} (
              {reviewTry.reasons.join(", ")})
            </p>
          </article>
        ))}
      </section>

      <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-semibold">상담 리드 dry-run (최근)</h2>
        <p className="mt-1 text-xs text-gray-600">
          메모리 큐 · 서버 재시작 시 초기화 · 전체 연락처 미표시
        </p>
        {leads.length === 0 ? (
          <p className="mt-3 text-sm text-gray-600">기록된 dry-run 리드가 없습니다.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {leads.map((lead) => (
              <li key={lead.id} className="rounded-lg border border-gray-100 px-3 py-2">
                <p className="font-medium">{lead.id}</p>
                <p className="text-xs text-gray-600">
                  {lead.professionalType} ·{" "}
                  {maskLeadContact(lead.contactValue, lead.contactMethod)} ·{" "}
                  {lead.status}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-6 text-sm">
        <Link href="/admin/review" className="font-semibold text-[#8B6914] underline">
          통합 검수로 돌아가기
        </Link>
      </p>
    </main>
  );
}

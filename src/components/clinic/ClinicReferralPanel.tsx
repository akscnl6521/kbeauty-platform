"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { ClinicReferralPresentation } from "@/lib/clinic/clinicReferralService";
import { CommerceLaneBadge } from "@/components/commerce/CommerceLaneBadge";

type LeadState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "ok"; message: string }
  | { status: "error"; message: string };

const PROFESSIONAL_LABEL: Record<string, string> = {
  dermatology: "피부과",
  hair_scalp_clinic: "두피·탈모 전문",
  allergy_care: "알레르기 관련",
  dentistry: "치과·구강",
  urgent_care: "응급·신속 의료",
  other: "기타 전문가",
};

function ClinicCardList({
  title,
  items,
  tone,
}: {
  title: string;
  items: ClinicReferralPresentation["organic"];
  tone: "organic" | "partner" | "demo";
}) {
  if (items.length === 0) return null;
  const border =
    tone === "partner"
      ? "border-violet-200 bg-violet-50/40"
      : tone === "demo"
        ? "border-dashed border-gray-300 bg-gray-50"
        : "border-blue-100 bg-white";

  const lane =
    tone === "partner"
      ? ("partner_clinic" as const)
      : tone === "demo"
        ? ("demo_fixture" as const)
        : ("organic" as const);

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-blue-950">{title}</h3>
        <CommerceLaneBadge lane={lane} />
      </div>
      <ul className="mt-2 space-y-2">
        {items.map((clinic) => (
          <li key={clinic.id} className={`rounded-lg border px-3 py-2 ${border}`}>
            <p className="font-medium text-sm text-gray-900">{clinic.name}</p>
            {clinic.displayDisclosure ? (
              <p className="mt-1 text-xs text-violet-800">{clinic.displayDisclosure}</p>
            ) : null}
            {clinic.address ? (
              <p className="mt-1 text-xs text-gray-600">{clinic.address}</p>
            ) : null}
            {clinic.operatingHours ? (
              <p className="text-xs text-gray-600">운영: {clinic.operatingHours}</p>
            ) : null}
            {clinic.languages.length > 0 ? (
              <p className="text-xs text-gray-600">
                언어: {clinic.languages.join(", ")}
              </p>
            ) : null}
            <p className="mt-1 text-xs text-gray-500">
              매칭 증상: {clinic.matchedSymptoms.join(", ") || "없음"}
              {clinic.distanceKm != null ? ` · 약 ${clinic.distanceKm}km` : ""}
            </p>
            {clinic.bookingUrl && !clinic.isDemo ? (
              <a
                href={clinic.bookingUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex text-xs font-semibold text-[#C2185B] underline"
              >
                예약 페이지 열기
              </a>
            ) : null}
            {clinic.isDemo ? (
              <p className="mt-1 text-xs font-medium text-amber-800">
                게시된 병원이 아닌 fixture 미리보기입니다.
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ClinicReferralPanel({
  routes,
  clinicMode,
}: {
  routes: Array<{
    professionalType: string;
    urgency: string;
    reason: string;
    productRecommendationAllowed: boolean;
  }>;
  clinicMode: "none" | "supportive" | "priority" | "urgent";
}) {
  const [presentation, setPresentation] = useState<ClinicReferralPresentation | null>(
    null,
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [leadState, setLeadState] = useState<LeadState>({ status: "idle" });
  const [contactMethod, setContactMethod] = useState<"email" | "phone">("email");
  const [contactValue, setContactValue] = useState("");
  const [consentPersonalInfo, setConsentPersonalInfo] = useState(false);
  const [consentShareWithClinic, setConsentShareWithClinic] = useState(false);
  const [consentNotDiagnosis, setConsentNotDiagnosis] = useState(false);

  const shouldLoad = routes.length > 0 && clinicMode !== "none";
  const primaryType = useMemo(
    () => routes[0]?.professionalType ?? "dermatology",
    [routes],
  );

  useEffect(() => {
    if (!shouldLoad) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/clinics/referral", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            routes,
            languages: ["ko"],
            includeDemoPreview: true,
          }),
        });
        const json = (await response.json()) as {
          ok: boolean;
          data?: ClinicReferralPresentation;
          error?: { message?: string };
        };
        if (cancelled) return;
        if (!json.ok || !json.data) {
          setLoadError(json.error?.message ?? "병원 안내를 불러오지 못했습니다.");
          setPresentation(null);
          return;
        }
        setLoadError(null);
        setPresentation(json.data);
      } catch {
        if (!cancelled) {
          setLoadError("병원 안내를 불러오지 못했습니다.");
          setPresentation(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [routes, clinicMode, shouldLoad]);

  if (!shouldLoad) return null;

  const visiblePresentation = presentation;

  async function submitLead(event: FormEvent) {
    event.preventDefault();
    setLeadState({ status: "submitting" });
    try {
      const response = await fetch("/api/clinics/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clinicId: visiblePresentation?.organic[0]?.id ?? visiblePresentation?.partnered[0]?.id ?? null,
          professionalType: primaryType,
          contactMethod,
          contactValue,
          preferredLanguage: "ko",
          consentPersonalInfo,
          consentShareWithClinic,
          consentNotDiagnosis,
          notes: null,
        }),
      });
      const json = (await response.json()) as {
        ok: boolean;
        data?: { message?: string };
        error?: { message?: string };
      };
      if (!json.ok) {
        setLeadState({
          status: "error",
          message: json.error?.message ?? "요청을 확인하지 못했습니다.",
        });
        return;
      }
      setLeadState({
        status: "ok",
        message: json.data?.message ?? "dry-run으로 기록되었습니다.",
      });
    } catch {
      setLeadState({ status: "error", message: "네트워크 오류로 요청하지 못했습니다." });
    }
  }

  return (
    <div className="mt-4 space-y-4">
      <ul className="space-y-2 text-sm text-blue-950">
        {routes.map((route) => (
          <li
            key={`${route.professionalType}-${route.reason}-${route.urgency}`}
            className="rounded-lg border border-blue-200 bg-white/70 px-3 py-2"
          >
            <span className="font-medium">
              {PROFESSIONAL_LABEL[route.professionalType] ?? route.professionalType}
            </span>
            <span className="mx-2 text-xs text-blue-700">{route.urgency}</span>
            <span className="text-xs text-blue-800">{route.reason}</span>
            {!route.productRecommendationAllowed ? (
              <p className="mt-1 text-xs text-red-800">
                현재 신호에서는 제품 추천을 중단합니다. (진단 아님)
              </p>
            ) : null}
          </li>
        ))}
      </ul>

      {loadError ? <p className="text-sm text-red-800">{loadError}</p> : null}

      {visiblePresentation ? (
        <>
          <p className="text-xs text-blue-800">{visiblePresentation.disclosure.organic}</p>
          {visiblePresentation.emptyReason === "urgent_no_listing" ? (
            <p className="text-sm text-red-900">
              응급·급성 신호에서는 병원 목록 대신 가까운 의료기관·응급 서비스를 우선하세요.
            </p>
          ) : null}
          {visiblePresentation.emptyReason === "no_publishable_clinics" ? (
            <p className="text-sm text-blue-950">
              현재 사용자에게 공개 가능한 검수 완료 병원이 없습니다. 공식 정보 검수 후에만
              목록이 채워집니다.
            </p>
          ) : null}

          <ClinicCardList
            title="Organic 안내 (제휴 아님)"
            items={visiblePresentation.organic}
            tone="organic"
          />
          <ClinicCardList
            title="제휴·예약 수수료 의료기관 (분리 표시)"
            items={visiblePresentation.partnered}
            tone="partner"
          />
          {visiblePresentation.demoPreview.length > 0 ? (
            <>
              <p className="text-xs text-amber-800">{visiblePresentation.disclosure.demo}</p>
              <ClinicCardList
                title="미리보기 예시 (게시 아님)"
                items={visiblePresentation.demoPreview}
                tone="demo"
              />
            </>
          ) : null}
        </>
      ) : null}

      <form
          onSubmit={submitLead}
          className="rounded-xl border border-blue-200 bg-white p-4"
          aria-label="상담 리드 최소 정보 동의"
        >
          <h3 className="text-sm font-semibold text-blue-950">
            상담 연결 요청 (dry-run)
          </h3>
          <p className="mt-1 text-xs text-blue-800">
            최소 연락처와 동의만 받습니다. 지금은 실제 전달·DB 저장 없이 dry-run만 수행합니다.
          </p>

          <label className="mt-3 block text-xs font-medium text-gray-700">
            연락 방법
            <select
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={contactMethod}
              onChange={(event) =>
                setContactMethod(event.target.value as "email" | "phone")
              }
            >
              <option value="email">이메일</option>
              <option value="phone">전화</option>
            </select>
          </label>

          <label className="mt-3 block text-xs font-medium text-gray-700">
            연락처
            <input
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={contactValue}
              onChange={(event) => setContactValue(event.target.value)}
              placeholder={contactMethod === "email" ? "you@example.com" : "010-0000-0000"}
              autoComplete={contactMethod === "email" ? "email" : "tel"}
              required
            />
          </label>

          <fieldset className="mt-3 space-y-2 text-xs text-gray-800">
            <legend className="font-medium">필수 동의</legend>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={consentPersonalInfo}
                onChange={(event) => setConsentPersonalInfo(event.target.checked)}
              />
              <span>상담 연결을 위한 최소 개인정보 처리에 동의합니다.</span>
            </label>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={consentShareWithClinic}
                onChange={(event) => setConsentShareWithClinic(event.target.checked)}
              />
              <span>검수된 의료기관에 연락 목적 범위로 공유될 수 있음에 동의합니다.</span>
            </label>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={consentNotDiagnosis}
                onChange={(event) => setConsentNotDiagnosis(event.target.checked)}
              />
              <span>이 서비스는 진단·처방이 아님을 이해했습니다.</span>
            </label>
          </fieldset>

          <button
            type="submit"
            disabled={leadState.status === "submitting"}
            className="mt-4 inline-flex rounded-lg bg-[#C2185B] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {leadState.status === "submitting" ? "기록 중…" : "dry-run 요청 기록"}
          </button>

          {leadState.status === "ok" ? (
            <p className="mt-2 text-xs text-green-800" role="status">
              {leadState.message}
            </p>
          ) : null}
          {leadState.status === "error" ? (
            <p className="mt-2 text-xs text-red-800" role="alert">
              {leadState.message}
            </p>
          ) : null}
        </form>
    </div>
  );
}

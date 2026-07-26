"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MyCareNav } from "../MyCareNav";
import { SampleDataBadge } from "@/components/scaffold/SampleDataBadge";
import { SafetyFilterStub } from "@/components/scaffold/SafetyFilterStub";
import { CommercialBadge } from "@/components/scaffold/CommercialBadge";
import { trackScaffoldClick } from "@/lib/scaffold/clickTrackingStub";
import { supabase } from "@/lib/supabase";

/**
 * Real institution row shape, read-only, from
 * public.dermatology_institution_candidates (workflow_status IN
 * ('verified','published') only — enforced both by the RLS policy and by
 * this query's explicit filter as defense in depth).
 * This table currently holds real HIRA (data.go.kr) Seoul dermatology
 * clinic directory data — see docs/catalog and DASHBOARD.md 2026-07-25.
 */
type RealInstitutionRow = {
  name: string;
  address: string | null;
  sggu_name: string | null;
  department_name: string | null;
  phone: string | null;
  workflow_status: string;
  updated_at: string;
};

const MIN_REAL_RESULTS = 1;

type MockClinic = {
  name: string;
  specialty: string;
  district: string;
  distanceKm: number;
  languages: string[];
  sponsored: boolean;
  lastVerifiedAt: string;
};

const MOCK_CLINICS: MockClinic[] = [
  {
    name: "샘플 서울피부과의원",
    specialty: "여드름·홍조",
    district: "강남구",
    distanceKm: 1.2,
    languages: ["한국어", "영어"],
    sponsored: false,
    lastVerifiedAt: "2026-07-20",
  },
  {
    name: "샘플 한빛피부과",
    specialty: "아토피·민감성",
    district: "마포구",
    distanceKm: 2.4,
    languages: ["한국어"],
    sponsored: false,
    lastVerifiedAt: "2026-07-18",
  },
  {
    name: "샘플 더마클리닉",
    specialty: "색소·미백",
    district: "서초구",
    distanceKm: 3.1,
    languages: ["한국어", "일본어"],
    sponsored: true,
    lastVerifiedAt: "2026-07-15",
  },
  {
    name: "샘플 청담스킨의원",
    specialty: "여드름·모공",
    district: "강남구",
    distanceKm: 1.8,
    languages: ["한국어", "영어"],
    sponsored: false,
    lastVerifiedAt: "2026-07-21",
  },
];

export default function MyClinicsPage() {
  // Sponsored/affiliate section is explicitly out of scope this session —
  // stays 100% scaffold mock data per prior session decision.
  const sponsored = MOCK_CLINICS.filter((c) => c.sponsored);

  const [realInstitutions, setRealInstitutions] = useState<RealInstitutionRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("dermatology_institution_candidates")
      .select("name, address, sggu_name, department_name, phone, workflow_status, updated_at")
      .in("workflow_status", ["verified", "published"])
      .order("sggu_name", { ascending: true })
      .limit(20)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) setRealInstitutions(data as RealInstitutionRow[]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const useRealData = realInstitutions.length >= MIN_REAL_RESULTS;
  const mockOrganic = MOCK_CLINICS.filter((c) => !c.sponsored);

  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-[#FAF7F5] px-4 py-10 text-gray-900">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">피부과 추천</h1>
        {useRealData ? null : <SampleDataBadge />}
      </div>
      <p className="mt-2 text-sm text-gray-600">
        {useRealData
          ? "일반(비제휴) 추천은 건강보험심사평가원(HIRA) 공개 데이터 기준 서울 피부과 병의원 정보입니다. 제휴 병원 섹션은 별도 스캐폴드용 더미입니다."
          : "아래 병원 목록은 실제 검증된 공식 데이터가 아닌 스캐폴드용 더미입니다. 실제 서비스에서는 공식 출처·전문의 증거 검증을 통과한 병원만 노출합니다."}
      </p>

      <MyCareNav current="/my/clinics" />

      <section className="mt-6">
        <SafetyFilterStub />
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          일반(비제휴) 추천
        </h2>
        {useRealData
          ? realInstitutions.map((clinic) => (
              <div
                key={clinic.name + (clinic.address ?? "")}
                className="rounded-2xl border border-blue-200 bg-blue-50 p-4"
              >
                <h3 className="font-semibold text-blue-950">{clinic.name}</h3>
                <p className="mt-1 text-sm text-blue-900">
                  {clinic.department_name ?? "피부과"} · {clinic.sggu_name ?? "서울"}
                </p>
                {clinic.address ? (
                  <p className="mt-1 text-xs text-blue-800">{clinic.address}</p>
                ) : null}
                {clinic.phone ? (
                  <p className="mt-1 text-xs text-blue-800">전화: {clinic.phone}</p>
                ) : null}
                <p className="mt-1 text-xs text-blue-700">
                  정보 확인일: {clinic.updated_at.slice(0, 10)}
                </p>
              </div>
            ))
          : mockOrganic.map((clinic) => (
              <div
                key={clinic.name}
                className="rounded-2xl border border-blue-200 bg-blue-50 p-4"
              >
                <h3 className="font-semibold text-blue-950">{clinic.name}</h3>
                <p className="mt-1 text-sm text-blue-900">
                  {clinic.specialty} · {clinic.district} · {clinic.distanceKm}km
                </p>
                <p className="mt-1 text-xs text-blue-800">
                  진료 언어: {clinic.languages.join(", ")}
                </p>
                <p className="mt-1 text-xs text-blue-700">
                  정보 확인일: {clinic.lastVerifiedAt}
                </p>
              </div>
            ))}
      </section>

      {sponsored.length > 0 ? (
        <section className="mt-6 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            제휴 병원
          </h2>
          <p className="text-xs text-gray-500">
            제휴 병원 · 상담 연결 시 병원이 운영사에 수수료를 지급할 수
            있습니다. 적합도 순위에는 영향을 주지 않으며, 일반 추천과 항상
            분리해서 표시합니다.
          </p>
          {sponsored.map((clinic) => (
            <div
              key={clinic.name}
              className="rounded-2xl border border-violet-200 bg-violet-50 p-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-violet-950">{clinic.name}</h3>
                <CommercialBadge kind="affiliate" show={clinic.sponsored} />
              </div>
              <p className="mt-1 text-sm text-violet-900">
                {clinic.specialty} · {clinic.district} · {clinic.distanceKm}km
              </p>
              <p className="mt-1 text-xs text-violet-800">
                진료 언어: {clinic.languages.join(", ")}
              </p>
              <p className="mt-1 text-xs text-violet-700">
                정보 확인일: {clinic.lastVerifiedAt}
              </p>
            </div>
          ))}
        </section>
      ) : null}

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/my/check-ins"
          className="inline-flex rounded-lg border border-[#E8DFD8] bg-white px-4 py-2 text-sm font-semibold"
        >
          ← 체크인으로 돌아가기
        </Link>
        <Link
          href="/my/consultation-report"
          onClick={() =>
            trackScaffoldClick({
              screen: "/my/clinics",
              itemId: "consultation-report-cta",
              kind: "clinic_referral",
            })
          }
          className="inline-flex rounded-lg bg-[#C2185B] px-4 py-2 text-sm font-semibold text-white"
        >
          상담 리포트 준비 →
        </Link>
      </div>
    </main>
  );
}

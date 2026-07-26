"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MyCareNav } from "../MyCareNav";
import { buildCareGuidanceViewModel } from "@/lib/care/guidanceViewModel";
import {
  RECOMMENDATION_STORAGE_KEY,
  RANKED_PRODUCTS_STORAGE_KEY,
} from "@/lib/recommend/types";
import ProductUsageGuide from "@/components/usage/ProductUsageGuide";
import { analyzeBodyAreasToApplicationTokens } from "@/lib/media/usageGuideApplicationArea";
import {
  ANALYZE_INPUT_SNAPSHOT_KEY,
  type AnalyzeInputSnapshot,
} from "@/lib/ai/analyzeInputSnapshot";
import { ClinicReferralPanel } from "@/components/clinic/ClinicReferralPanel";

type RankedItem = {
  id?: string;
  product?: {
    id?: string;
    name?: string;
    name_ko?: string | null;
    brand?: string;
  };
  name?: string;
  name_ko?: string | null;
  brand?: string;
};

function productName(item: RankedItem): string {
  return (
    item.product?.name_ko ||
    item.product?.name ||
    item.name_ko ||
    item.name ||
    "제품명 확인 필요"
  );
}

function productBrand(item: RankedItem): string | null {
  return item.product?.brand || item.brand || null;
}

export default function CareGuidancePage() {
  const [recommendation, setRecommendation] = useState<Record<string, unknown> | null>(null);
  const [ranked, setRanked] = useState<RankedItem[]>([]);
  const [applicationAreas, setApplicationAreas] = useState<string[] | undefined>(
    undefined
  );
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const savedRecommendation = JSON.parse(
        window.localStorage.getItem(RECOMMENDATION_STORAGE_KEY) || "null"
      );
      const savedRanked = JSON.parse(
        window.localStorage.getItem(RANKED_PRODUCTS_STORAGE_KEY) || "[]"
      );
      setRecommendation(
        savedRecommendation && typeof savedRecommendation === "object"
          ? savedRecommendation
          : null
      );
      setRanked(Array.isArray(savedRanked) ? savedRanked.slice(0, 5) : []);

      const rawSnapshot = window.localStorage.getItem(ANALYZE_INPUT_SNAPSHOT_KEY);
      const snapshot = rawSnapshot
        ? (JSON.parse(rawSnapshot) as AnalyzeInputSnapshot)
        : null;
      const areaIds: string[] = [];
      if (snapshot?.concernObservations) {
        for (const obs of snapshot.concernObservations) {
          if (!Array.isArray(obs.areas)) continue;
          for (const area of obs.areas) {
            if (typeof area === "string" && area.trim()) areaIds.push(area);
          }
        }
      }
      if (snapshot?.rednessObservation?.areas) {
        for (const area of snapshot.rednessObservation.areas) {
          if (typeof area === "string" && area.trim()) areaIds.push(area);
        }
      }
      const tokens = analyzeBodyAreasToApplicationTokens(areaIds);
      setApplicationAreas(tokens.length > 0 ? tokens : undefined);
    } catch {
      setRecommendation(null);
      setRanked([]);
      setApplicationAreas(undefined);
    } finally {
      setLoaded(true);
    }
  }, []);

  const guidance = useMemo(
    () => buildCareGuidanceViewModel(recommendation),
    [recommendation]
  );

  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-[#FAF7F5] px-4 py-10 text-gray-900">
      <h1 className="text-3xl font-bold tracking-tight">관리 가이드</h1>
      <p className="mt-2 text-sm text-gray-600">
        제품 사용법, 안전 주의사항, 피부과 안내와 제휴 표시 원칙을 한곳에서 확인합니다.
      </p>
      <MyCareNav current="/my/guidance" />

      {!loaded ? (
        <p className="mt-8 text-sm text-gray-600">가이드를 불러오는 중입니다.</p>
      ) : !recommendation ? (
        <section className="mt-6 rounded-2xl border border-pink-200 bg-white p-5">
          <h2 className="text-lg font-semibold">저장된 분석이 없습니다</h2>
          <p className="mt-2 text-sm text-gray-600">
            피부 분석을 완료하면 현재 관리 단계에 맞는 사용법과 상담 안내가 표시됩니다.
          </p>
          <Link
            href="/analyze"
            className="mt-4 inline-flex rounded-lg bg-[#C2185B] px-4 py-2 text-sm font-semibold text-white"
          >
            피부 분석 시작
          </Link>
        </section>
      ) : (
        <>
          <section className="mt-6 rounded-2xl border border-[#E8DFD8] bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              현재 관리 단계
            </p>
            <h2 className="mt-1 text-xl font-bold">{guidance.managementLabel}</h2>
            <p className="mt-2 text-sm text-gray-600">
              주요 고민: {guidance.concerns.length ? guidance.concerns.join(", ") : "등록 없음"}
            </p>
          </section>

          <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <h2 className="text-lg font-semibold">우선 확인할 안전 수칙</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-gray-800">
              {guidance.safetySteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </section>

          <section className="mt-6 rounded-2xl border border-[#E8DFD8] bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  제품 사용
                </p>
                <h2 className="mt-1 text-lg font-semibold">추천 제품 사용 가이드</h2>
              </div>
              <span className="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-600">
                {guidance.showProductUsage ? "사용법 확인 가능" : "현재 사용 중단 우선"}
              </span>
            </div>

            {!guidance.showProductUsage ? (
              <p className="mt-3 text-sm text-red-800">
                현재 단계에서는 새 제품이나 추천 제품 사용보다 증상 확인이 우선입니다.
              </p>
            ) : ranked.length === 0 ? (
              <p className="mt-3 text-sm text-gray-600">
                저장된 추천 제품이 없습니다. 분석 결과에서 제품을 확인해 주세요.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {ranked.map((item, index) => (
                  <article
                    key={item.product?.id || item.id || `${productName(item)}-${index}`}
                    className="rounded-xl border border-pink-100 bg-pink-50/30 p-4"
                  >
                    <p className="text-xs font-semibold text-[#C2185B]">사용 순서 {index + 1}</p>
                    <h3 className="mt-1 font-semibold">{productName(item)}</h3>
                    {productBrand(item) ? (
                      <p className="mt-1 text-xs text-gray-500">{productBrand(item)}</p>
                    ) : null}
                    {item.product?.id || item.id ? (
                      <ProductUsageGuide
                        productId={String(item.product?.id || item.id)}
                        locale="ko"
                        emptyMode={applicationAreas ? "hidden" : "message"}
                        applicationAreas={applicationAreas}
                        className="mt-3 border-t border-pink-100 pt-3 text-xs text-gray-700"
                      />
                    ) : (
                      <>
                        <p className="mt-2 text-sm text-gray-700">
                          도포량·사용 부위·사용 빈도는 공식 브랜드 근거 또는 내부 검수가 완료된 정보만 표시합니다.
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          검수된 사용 영상이 없는 경우 영상 대신 단계별 텍스트 안내만 제공합니다.
                        </p>
                      </>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
              피부과 안내
            </p>
            <h2 className="mt-1 text-lg font-semibold">{guidance.clinicTitle}</h2>
            <p className="mt-2 text-sm leading-relaxed text-blue-950">
              {guidance.clinicMessage}
            </p>
            {guidance.professionalRoutes.length > 0 || guidance.clinicMode !== "none" ? (
              <ClinicReferralPanel
                routes={guidance.professionalRoutes}
                clinicMode={guidance.clinicMode}
              />
            ) : null}
            {guidance.clinicMode !== "none" ? (
              <p className="mt-3 text-xs text-blue-800">
                실제 병원 목록은 공식 정보·전문 증상·거리·운영 상태 검증이 끝난 후보만 노출합니다.
                제휴 병원은 Organic 안내와 분리 표시합니다.
              </p>
            ) : null}
          </section>

          <section className="mt-6 rounded-2xl border border-violet-200 bg-violet-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
              광고·제휴 표시
            </p>
            <p className="mt-2 text-sm leading-relaxed text-violet-950">
              {guidance.commercialDisclosure}
            </p>
            <p className="mt-2 text-xs text-violet-800">
              Organic 추천, 제휴 링크, 스폰서 영역은 서로 분리하며 광고비로 적합도 순위를 바꾸지 않습니다.
            </p>
          </section>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/my"
              className="inline-flex rounded-lg border border-[#E8DFD8] bg-white px-4 py-2 text-sm font-semibold"
            >
              내 케어로 돌아가기
            </Link>
            <Link
              href="/results"
              className="inline-flex rounded-lg bg-[#C2185B] px-4 py-2 text-sm font-semibold text-white"
            >
              분석 결과 보기
            </Link>
          </div>
        </>
      )}
    </main>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import {
  rankMascaraProducts,
  rankLipProducts,
  rankBaseMakeupByUndertone,
} from "@/lib/catalog/makeup";
import { rankScalpProducts } from "@/lib/catalog/scalpHair/rankScalpHair";

type QuizPayload = {
  domain: string;
  answers: Record<string, string>;
  completedAt?: string;
};

const DEMO_POOL = {
  mascara: [
    {
      id: "demo-mascara-curl-wp",
      category: "mascara",
      waterproof: true,
      mascaraEffects: ["curl", "longlash"],
      name: "컬링·워터프루프 후보 (속성 예시)",
    },
    {
      id: "demo-mascara-vol",
      category: "mascara",
      waterproof: false,
      mascaraEffects: ["volume"],
      name: "볼륨 후보 (속성 예시)",
    },
  ],
  lip: [
    {
      id: "demo-lip-cool-matte",
      category: "lip_tint",
      undertoneFit: ["cool"],
      finish: "matte",
      lipEffects: ["matte", "stain"],
      name: "쿨톤 매트 틴트 (속성 예시)",
    },
    {
      id: "demo-lip-warm-gloss",
      category: "lip_tint",
      undertoneFit: ["warm"],
      finish: "glossy",
      lipEffects: ["gloss"],
      name: "웜톤 글로시 틴트 (속성 예시)",
    },
  ],
  base: [
    {
      id: "demo-base-cool",
      category: "cushion",
      undertoneFit: ["cool"],
      coverage: "medium",
      finish: "natural",
      name: "쿨톤 미들 커버 쿠션 (속성 예시)",
    },
    {
      id: "demo-base-warm",
      category: "cushion",
      undertoneFit: ["warm"],
      coverage: "medium",
      finish: "glow",
      name: "웜톤 글로우 쿠션 (속성 예시)",
    },
  ],
  hair: [
    {
      id: "demo-scalp-oily",
      category: "oily_scalp_shampoo",
      scalpTypes: ["oily" as const],
      name: "지성 두피 샴푸 (속성 예시)",
    },
    {
      id: "demo-scalp-sens",
      category: "sensitive_scalp_shampoo",
      scalpTypes: ["sensitive" as const],
      name: "민감 두피 샴푸 (속성 예시)",
    },
  ],
};

/**
 * Reads domain quiz localStorage and shows ranking hints.
 * Uses attribute demos when Staging public catalog has no makeup/hair SKUs —
 * never claims these demos are purchase-verified products.
 */
export function DomainQuizRecommendPanel() {
  const [quiz, setQuiz] = useState<QuizPayload | null>(null);

  useEffect(() => {
    const keys = [
      "kb_quiz_mascara",
      "kb_quiz_lip",
      "kb_quiz_base",
      "kb_quiz_hair",
    ];
    let latest: QuizPayload | null = null;
    let latestTs = 0;
    for (const k of keys) {
      try {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const parsed = JSON.parse(raw) as QuizPayload;
        const ts = Date.parse(parsed.completedAt ?? "") || 0;
        if (!latest || ts >= latestTs) {
          latest = parsed;
          latestTs = ts;
        }
      } catch {
        /* ignore */
      }
    }
    setQuiz(latest);
  }, []);

  const ranked = useMemo(() => {
    if (!quiz) return [];
    const a = quiz.answers;
    if (quiz.domain === "mascara") {
      return rankMascaraProducts(
        {
          wantCurl: a.effect === "curl" || a.droop === "droop",
          wantVolume: a.effect === "volume" || a.density === "sparse",
          wantLongLash: a.effect === "longlash" || a.length === "short",
          waterproof: a.waterproof === "yes" || a.smudge === "high",
          sensitiveEyes: a.sensitiveEyes === "yes",
          smudgeConcern: a.smudge === "high",
        },
        DEMO_POOL.mascara
      ).map((r) => ({
        id: r.product.id,
        name: (r.product as { name?: string }).name ?? r.product.id,
        score: r.score,
        tags: r.matchedTags,
      }));
    }
    if (quiz.domain === "lip") {
      return rankLipProducts(
        {
          undertone:
            a.undertone === "cool" ||
            a.undertone === "warm" ||
            a.undertone === "neutral"
              ? a.undertone
              : undefined,
          finish:
            a.finish === "matte" ||
            a.finish === "glossy" ||
            a.finish === "satin"
              ? a.finish
              : undefined,
          wantStain: a.stain === "yes",
          dryLips: a.dryLips === "yes",
        },
        DEMO_POOL.lip
      ).map((r) => ({
        id: r.product.id,
        name: (r.product as { name?: string }).name ?? r.product.id,
        score: r.score,
        tags: r.matchedTags,
      }));
    }
    if (quiz.domain === "base") {
      return rankBaseMakeupByUndertone(
        {
          undertone:
            a.undertone === "cool" ||
            a.undertone === "warm" ||
            a.undertone === "neutral"
              ? a.undertone
              : undefined,
          coverage:
            a.coverage === "sheer" ||
            a.coverage === "medium" ||
            a.coverage === "full"
              ? a.coverage
              : undefined,
          finish: a.finish,
        },
        DEMO_POOL.base
      ).map((r) => ({
        id: r.product.id,
        name: (r.product as { name?: string }).name ?? r.product.id,
        score: r.score,
        tags: r.matchedTags,
      }));
    }
    if (quiz.domain === "hair") {
      const scalpType =
        a.scalpType === "dry" ||
        a.scalpType === "oily" ||
        a.scalpType === "sensitive" ||
        a.scalpType === "normal"
          ? a.scalpType
          : undefined;
      return rankScalpProducts(
        { scalpType },
        DEMO_POOL.hair
      ).map((r) => ({
        id: r.product.id,
        name: (r.product as { name?: string }).name ?? r.product.id,
        score: r.score,
        tags: r.matchedTags,
      }));
    }
    return [];
  }, [quiz]);

  if (!quiz) {
    return (
      <div className="mt-3 space-y-2">
        <p className="text-xs text-gray-500">
          도메인 문진을 완료하면 속성 기반 추천 힌트가 여기에 표시됩니다. 예시
          후보는 구매 검증 제품이 아닙니다.
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            href="/quiz/mascara"
            className="touch-target inline-flex items-center rounded-full border border-[#E8DFD8] bg-white px-3 py-2 text-sm font-medium text-gray-800"
          >
            마스카라 문진
          </a>
          <a
            href="/quiz/base"
            className="touch-target inline-flex items-center rounded-full border border-[#E8DFD8] bg-white px-3 py-2 text-sm font-medium text-gray-800"
          >
            베이스 문진
          </a>
          <a
            href="/quiz/lip"
            className="touch-target inline-flex items-center rounded-full border border-[#E8DFD8] bg-white px-3 py-2 text-sm font-medium text-gray-800"
          >
            립 문진
          </a>
          <a
            href="/quiz/hair"
            className="touch-target inline-flex items-center rounded-full border border-[#E8DFD8] bg-white px-3 py-2 text-sm font-medium text-gray-800"
          >
            헤어 문진
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-dashed border-[#D9C8B8] bg-[#FCFAF7] p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#9A6B3F]">
        {quiz.domain} 문진 결과 · 속성 매칭
      </p>
      <p className="mt-1 text-xs text-gray-600">
        공개 verified 카탈로그에 해당 도메인 SKU가 부족할 때는 속성 예시만
        보여 흐름을 검증합니다. 실제 구매 링크는 검수된 한국 offer만
        사용합니다.
      </p>
      {ranked.length === 0 ? (
        <div className="mt-2 space-y-2">
          <p className="text-sm text-gray-600">
            매칭 결과가 없습니다. 공개 카탈로그에 해당 속성의 verified SKU가
            아직 부족할 수 있어요. 문진을 다시 하거나 피부 분석·성분 가이드로
            이어가 보세요.
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href={
                quiz.domain === "shampoo" || quiz.domain === "hair"
                  ? "/quiz/hair"
                  : `/quiz/${quiz.domain}`
              }
              className="touch-target inline-flex items-center rounded-full bg-[#C2185B] px-3 py-2 text-sm font-semibold text-white"
            >
              이 문진 다시하기
            </a>
            <a
              href="/analyze"
              className="touch-target inline-flex items-center rounded-full border border-[#C2185B] bg-white px-3 py-2 text-sm font-semibold text-[#C2185B]"
            >
              피부 분석
            </a>
            <a
              href="/ingredients"
              className="touch-target inline-flex items-center rounded-full border border-[#E8DFD8] bg-white px-3 py-2 text-sm font-medium text-gray-800"
            >
              성분 가이드
            </a>
            <a
              href="/quiz"
              className="touch-target inline-flex items-center rounded-full border border-[#E8DFD8] bg-white px-3 py-2 text-sm font-medium text-gray-800"
            >
              피부 문진
            </a>
          </div>
        </div>
      ) : (
        <ul className="mt-2 space-y-2">
          {ranked.slice(0, 3).map((r) => (
            <li key={r.id} className="text-sm">
              <span className="font-medium text-gray-900">{r.name}</span>
              <span className="ml-2 text-xs text-gray-500">
                score {r.score.toFixed(1)} · {r.tags.join(", ") || "—"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

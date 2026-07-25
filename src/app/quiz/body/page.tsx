"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BeautyShell, QuizCard } from "@/components/beauty/BeautyShell";
import { SampleDataBadge } from "@/components/scaffold/SampleDataBadge";

const BODY_AREAS = [
  { value: "hands", label: "손" },
  { value: "arms", label: "팔" },
  { value: "legs", label: "다리" },
  { value: "underarms", label: "겨드랑이" },
  { value: "back", label: "등" },
  { value: "neck", label: "목" },
];

const STORAGE_KEY = "kb_quiz_body";

export default function BodyAreaQuizPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(value: string) {
    setSelected((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  }

  function finish() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ areas: selected, completedAt: new Date().toISOString() })
      );
    } catch {
      /* ignore */
    }
    router.push("/results?tab=body");
  }

  return (
    <BeautyShell
      eyebrow="맞춤 문진"
      title="전신 부위 고민"
      subtitle="얼굴 외에 신경 쓰이는 신체 부위가 있다면 선택해 주세요. 여러 곳을 고를 수 있습니다."
    >
      <QuizCard>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9A6B3F]">
            해당 부위 선택 (선택)
          </p>
          <SampleDataBadge label="입력 자리만 · 추천 미반영" />
        </div>

        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          {BODY_AREAS.map((area) => {
            const active = selected.includes(area.value);
            return (
              <button
                key={area.value}
                type="button"
                onClick={() => toggle(area.value)}
                aria-pressed={active}
                className={`rounded-2xl border px-4 py-3 text-left text-sm font-medium transition ${
                  active
                    ? "border-[#8B4513] bg-[#FCF3E7] text-[#5A3410]"
                    : "border-[#E8DFD8] bg-[#FCF9F6] hover:border-[#8B4513] hover:bg-white"
                }`}
              >
                {area.label}
              </button>
            );
          })}
        </div>

        <p className="mt-5 text-xs leading-relaxed text-gray-500">
          이 응답은 현재 저장만 되며, 추천 로직에는 아직 반영되지 않습니다.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={finish}
            className="touch-target rounded-full bg-[#C2185B] px-6 py-2.5 text-sm font-semibold text-white"
          >
            {selected.length > 0 ? "선택 완료" : "건너뛰기"}
          </button>
        </div>
      </QuizCard>
    </BeautyShell>
  );
}

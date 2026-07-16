"use client";

import { DomainQuizClient } from "@/components/beauty/DomainQuizClient";

export default function HairQuizPage() {
  return (
    <DomainQuizClient
      domain="hair"
      storageKey="kb_quiz_hair"
      title="샴푸·두피 문진"
      subtitle="두피·모발 상태는 스킨케어와 분리된 도메인에서만 추천합니다."
      resultsPath="/results?tab=hair&domain=shampoo"
      steps={[
        {
          key: "scalpType",
          title: "두피 타입은?",
          options: [
            { value: "dry", label: "건성" },
            { value: "oily", label: "지성" },
            { value: "sensitive", label: "민감" },
            { value: "normal", label: "보통" },
            { value: "unknown", label: "잘 모름" },
          ],
        },
        {
          key: "dandruff",
          title: "비듬이 있나요?",
          options: [
            { value: "yes", label: "있음" },
            { value: "no", label: "없음" },
          ],
        },
        {
          key: "itch",
          title: "가려움이 있나요?",
          options: [
            { value: "yes", label: "있음" },
            { value: "no", label: "없음" },
          ],
        },
        {
          key: "damage",
          title: "모발 손상·염색·펌 상태는?",
          options: [
            { value: "damage", label: "손상" },
            { value: "color", label: "염색·펌" },
            { value: "heat", label: "열 손상 걱정" },
            { value: "none", label: "특별한 이슈 없음" },
          ],
        },
        {
          key: "thickness",
          title: "모발 굵기는?",
          options: [
            { value: "fine", label: "가는 편" },
            { value: "medium", label: "보통" },
            { value: "thick", label: "굵은 편" },
          ],
        },
        {
          key: "volume",
          title: "볼륨이 부족한가요?",
          options: [
            { value: "yes", label: "부족" },
            { value: "no", label: "괜찮음" },
          ],
        },
      ]}
    />
  );
}

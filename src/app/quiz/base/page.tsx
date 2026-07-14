"use client";

import { DomainQuizClient } from "@/components/beauty/DomainQuizClient";

export default function BaseMakeupQuizPage() {
  return (
    <DomainQuizClient
      domain="base"
      storageKey="kb_quiz_base"
      title="베이스 메이크업 문진"
      subtitle="호수·언더톤·커버력·피니시는 공식 표기가 있을 때만 매칭합니다."
      resultsPath="/results?tab=makeup&domain=base"
      steps={[
        {
          key: "undertone",
          title: "언더톤은?",
          options: [
            { value: "cool", label: "쿨톤" },
            { value: "warm", label: "웜톤" },
            { value: "neutral", label: "뉴트럴" },
            { value: "unknown", label: "잘 모름" },
          ],
        },
        {
          key: "coverage",
          title: "원하는 커버력은?",
          options: [
            { value: "sheer", label: "얇게" },
            { value: "medium", label: "중간" },
            { value: "full", label: "높게" },
          ],
        },
        {
          key: "finish",
          title: "선호 피니시는?",
          options: [
            { value: "natural", label: "내추럴" },
            { value: "glow", label: "글로우" },
            { value: "matte", label: "매트" },
          ],
        },
        {
          key: "skinType",
          title: "피부 타입은?",
          options: [
            { value: "dry", label: "건성" },
            { value: "oily", label: "지성" },
            { value: "combination", label: "복합성" },
            { value: "sensitive", label: "민감" },
            { value: "unknown", label: "잘 모름" },
          ],
        },
      ]}
    />
  );
}

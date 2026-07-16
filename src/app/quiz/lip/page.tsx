"use client";

import { DomainQuizClient } from "@/components/beauty/DomainQuizClient";

export default function LipQuizPage() {
  return (
    <DomainQuizClient
      domain="lip"
      storageKey="kb_quiz_lip"
      title="립 제품 맞춤 문진"
      subtitle="피부톤·언더톤·입술 본연색·표현 선호를 문진으로 보완합니다."
      resultsPath="/results?tab=makeup&domain=lip"
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
          key: "brightness",
          title: "원하는 명도는?",
          options: [
            { value: "light", label: "밝은" },
            { value: "medium", label: "중간" },
            { value: "deep", label: "딥" },
          ],
        },
        {
          key: "finish",
          title: "선호 마무리는?",
          options: [
            { value: "matte", label: "매트" },
            { value: "satin", label: "세틴" },
            { value: "glossy", label: "글로시" },
          ],
        },
        {
          key: "stain",
          title: "착색을 원하나요?",
          options: [
            { value: "yes", label: "원함" },
            { value: "no", label: "원하지 않음" },
          ],
        },
        {
          key: "dryLips",
          title: "입술이 건조한 편인가요?",
          options: [
            { value: "yes", label: "건조함" },
            { value: "no", label: "괜찮음" },
          ],
        },
      ]}
    />
  );
}

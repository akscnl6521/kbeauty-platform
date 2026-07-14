"use client";

import { DomainQuizClient } from "@/components/beauty/DomainQuizClient";

export default function MascaraQuizPage() {
  return (
    <DomainQuizClient
      domain="mascara"
      storageKey="kb_quiz_mascara"
      title="마스카라 맞춤 문진"
      subtitle="속눈썹 길·숱·처짐·번짐·세정 난이도를 문진으로 보완합니다. 사진만으로 단정하지 않습니다."
      resultsPath="/results?tab=makeup&domain=mascara"
      steps={[
        {
          key: "length",
          title: "속눈썹 길이는?",
          options: [
            { value: "short", label: "짧은 편" },
            { value: "medium", label: "보통" },
            { value: "long", label: "긴 편" },
          ],
        },
        {
          key: "density",
          title: "속눈썹 숱은?",
          options: [
            { value: "sparse", label: "적은 편" },
            { value: "medium", label: "보통" },
            { value: "dense", label: "풍성한 편" },
          ],
        },
        {
          key: "droop",
          title: "처짐 정도는?",
          options: [
            { value: "straight", label: "곧게 뻗음" },
            { value: "mild", label: "약간 처짐" },
            { value: "droop", label: "잘 처짐" },
          ],
        },
        {
          key: "smudge",
          title: "번짐이 걱정되나요?",
          options: [
            { value: "low", label: "거의 없음" },
            { value: "mid", label: "가끔" },
            { value: "high", label: "자주 번짐" },
          ],
        },
        {
          key: "waterproof",
          title: "워터프루프가 필요하나요?",
          options: [
            { value: "yes", label: "필요" },
            { value: "no", label: "불필요" },
            { value: "unknown", label: "잘 모름" },
          ],
        },
        {
          key: "effect",
          title: "원하는 효과는?",
          options: [
            { value: "curl", label: "컬링" },
            { value: "volume", label: "볼륨" },
            { value: "longlash", label: "롱래쉬" },
          ],
        },
        {
          key: "sensitiveEyes",
          title: "눈이 예민한 편인가요?",
          options: [
            { value: "yes", label: "예" },
            { value: "no", label: "아니오" },
          ],
        },
      ]}
    />
  );
}

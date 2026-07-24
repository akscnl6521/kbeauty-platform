/**
 * P3-T05 one-time human review steps for later Staging import approval.
 * Agents must not claim these as completed.
 */

import type { StagingHumanReviewStep } from "./types";

export function buildStagingHumanReviewSteps(): StagingHumanReviewStep[] {
  return [
    {
      id: "HUMAN-P3-T05-PRODUCT-CANDIDATE-REVIEW",
      onceOnly: true,
      titleKo: "제품 후보·provenance·거절 사유 사람 검수",
      whereKo:
        "artifacts/staging-import-package/latest-summary.md · 제품 레인 CSV/JSON",
      checkKo:
        "공식 출처·전성분·이미지 권리·구매 offer·중복·거절 사유가 패키지와 일치하는지",
      passCriteriaKo:
        "fixture·미검증·중복 미해결은 Staging import 대상에서 제외 · 값/키 채팅 금지",
      failActionKo: "거절 사유 기록 · 가짜 제품 import 금지",
      stagingImport: false,
      productionForbidden: true,
      relatedExternalIds: ["EX-11"],
    },
    {
      id: "HUMAN-P3-T05-CLINIC-CANDIDATE-REVIEW",
      onceOnly: true,
      titleKo: "병원 후보·공식 근거·증상 근거 사람 검수",
      whereKo: "T07-05 감사 + staging-import-package 병원 레인",
      checkKo:
        "HIRA/기관상세/증상근거·충돌·스테일·유료 레인 분리가 올바른지",
      passCriteriaKo:
        "공식 근거+관리자 승인 행만 남김 · fixture 게시/import 0",
      failActionKo: "거절 · HUMAN-T07-OFFICIAL-SITE-EVIDENCE로 되돌림",
      stagingImport: false,
      productionForbidden: true,
      relatedExternalIds: ["EX-04", "HUMAN-T07-OFFICIAL-SITE-EVIDENCE"],
    },
    {
      id: "HUMAN-P3-T05-REFRESH-AND-DUPLICATES",
      onceOnly: true,
      titleKo: "갱신 상태·중복 병합 최종 확인",
      whereKo: "P3-T03 refresh audit + staging-import-package duplicates 섹션",
      checkKo: "stale/due/needs_refresh·duplicateOf 링크가 해소됐는지",
      passCriteriaKo: "stale·미해소 중복은 import 제외",
      failActionKo: "갱신 큐/중복 큐로 되돌림 · 자동 게시 금지",
      stagingImport: false,
      productionForbidden: true,
      relatedExternalIds: ["EX-11", "EX-04"],
    },
    {
      id: "HUMAN-P3-T05-COMMERCIAL-SEPARATION",
      onceOnly: true,
      titleKo: "상업 분리·Organic 비오염 확인",
      whereKo: "commercialIndependence 섹션 · P3-T04 revenue readiness",
      checkKo:
        "제휴/스폰서가 Organic 추천·Staging 적격에 섞이지 않았는지 · disclosure 유지",
      passCriteriaKo:
        "organicOrderUnchanged=true · 유료 레인 structural eligibility=false",
      failActionKo: "유료 레인 분리 재검수 · 수익 채널 활성화 금지",
      stagingImport: false,
      productionForbidden: true,
      relatedExternalIds: ["EX-12"],
    },
    {
      id: "HUMAN-P3-T05-STAGING-IMPORT-APPROVAL",
      onceOnly: true,
      titleKo: "Staging import 1회 승인 (실행은 사람)",
      whereKo:
        "통합 패키지 structurallyStagingImportEligible=true 행만 · 관리자 승인",
      checkKo:
        "publishable gate·거절 사유·fixture 제외·Production 미포함을 최종 확인",
      passCriteriaKo:
        "사람 승인 후에만 Staging import 실행 · 본 패키지는 실행하지 않음",
      failActionKo:
        "승인 보류 · Production/main 절대 진행 금지 · fixture import 금지",
      stagingImport: true,
      productionForbidden: true,
      relatedExternalIds: [
        "HUMAN-T07-STAGING-IMPORT-APPROVAL",
        "EX-04",
        "EX-06",
      ],
    },
    {
      id: "HUMAN-P3-T05-PRODUCTION-GATE",
      onceOnly: true,
      titleKo: "Production·main 게이트 (지금 미실행)",
      whereKo: "별도 명시 승인 체크리스트",
      checkKo: "main 병합·Production DB/배포·환경변수 — 지금 실행하지 않음",
      passCriteriaKo: "승인 전 미실행 유지",
      failActionKo: "승인 없이 진행 시도 시 즉시 중단",
      stagingImport: false,
      productionForbidden: true,
      relatedExternalIds: ["EX-06", "WQG-P0-002"],
    },
  ];
}

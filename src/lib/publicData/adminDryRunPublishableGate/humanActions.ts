/**
 * One-time human actions left after T07-05 dry-run code completion.
 * Agents must not claim these as done.
 */

import type { OneTimeHumanAction } from "./types";

export function buildOneTimeHumanActions(): OneTimeHumanAction[] {
  return [
    {
      id: "HUMAN-T07-OFFICIAL-SITE-EVIDENCE",
      titleKo: "공식 사이트 증상 근거 사람 검수",
      stepsKo: [
        "여드름·주사/홍조·아토피·색소 각 카테고리별 공식 병원 페이지 URL·제목·발췌·확인일·만료일을 매니페스트에 수동 입력합니다.",
        "`npm run check:symptom-evidence-review`로 큐 레인을 확인한 뒤, Organic vs 유료 레인을 분리 검수합니다.",
        "로그인·CAPTCHA·제한 크롤이 필요한 페이지는 자동화하지 않고 거절 또는 오프라인 발췌로만 처리합니다.",
        "승인 행만 `reviewerStatus=approved`로 표시합니다. fixture·미검증은 게시하지 않습니다.",
      ],
      approvalRequired: true,
      stagingImport: false,
      productionForbidden: true,
    },
    {
      id: "HUMAN-T07-STAGING-IMPORT-APPROVAL",
      titleKo: "Staging import 1회 승인",
      stepsKo: [
        "T07-02 live HIRA 수집 결과와 T07-03 기관상세 보강 감사 JSON을 확인합니다.",
        "`npm run check:admin-dry-run-publishable-gate` 감사에서 structurally_publishable·blockReasons를 검토합니다.",
        "관리자가 명시 승인한 후보만 Staging import 대상으로 표시합니다(fixture·실패·스테일·출처충돌·근거부족 제외).",
        "Staging import는 사람 승인 후에만 실행합니다. Production DB/배포·main 병합은 별도 명시 승인 전 금지입니다.",
      ],
      approvalRequired: true,
      stagingImport: true,
      productionForbidden: true,
    },
  ];
}

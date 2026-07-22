# Scenario Pilot Phase 2.1 — Staging / Preview Validation

상태: 로컬 작업 브랜치 검증 완료, Production 미변경, DB write 없음.

## 목적

Phase 2에서 런타임 연결된 A/B/C와 insufficient 처리되는 D/E를
실제 Staging DB + Vercel Preview 기준으로 다시 검증한다.

## 안전 조건

- 브랜치: `feature/recommendation-usage-guide-display-20260720`
- Staging ref: `jfnj***gfd`
- Production ref: `rhfr***mns` 차단
- DB 모드: `SELECT_ONLY`
- 실제 이메일 / 사진 / Care write 없음

## 현재 Staging 결과

`npm run verify:recommendation-scenario-phase21-staging`

- A `kr-redness-sensitive-cream`
  - pool ready: 6
  - Staging product intersection: 3
  - KR offer pass: 3
  - safety pass: 3
  - final: 0 (`insufficient_verified_candidates`)
  - 주요 제외: `aestura-atobarrier365-cream`, `round-lab-dokdo-cream`, `torriden-dive-in-serum` → `products_row_missing`

- B `pilot-dryness-barrier-serum`
  - pool ready: 7
  - Staging product intersection: 3
  - KR offer pass: 3
  - safety pass: 3
  - final: 0 (`insufficient_verified_candidates`)
  - 주요 제외: `aestura-atobarrier365-cream`, `round-lab-dokdo-cream`, `torriden-dive-in-serum`, `skin1004-madagascar-centella-ampoule` → `products_row_missing`

- C `kr-acne-pores-toner`
  - pool ready: 5
  - Staging product intersection: 3
  - KR offer pass: 3
  - safety pass: 3
  - final: 0 (`insufficient_verified_candidates`)
  - 주요 제외: `beauty-of-joseon-green-plum-refreshing-toner`, `haruharu-wonder-black-rice-hyaluronic-toner` → `products_row_missing`

- D `kr-uv-sunscreen-sensitive`
  - pool ready: 1
  - final: 0 (`insufficient_verified_candidates`, `verified_count=1`)

- E `kr-aging-eye-cream`
  - pool ready: 2
  - final: 0 (`insufficient_verified_candidates`, `verified_count=2`)

## Preview

- 배포 URL: `https://kbeauty-platform-804qt5jzd-akscnl6521s-projects.vercel.app`
- 상태: `READY`
- `/api/dev/scenario-pilot-phase2` 는 Preview에서 허용, Production에서는 404
- 자동 smoke 결과: Preview 보호 때문에 `302`
  - 스크립트: `npm run check:preview-scenario-phase21`
  - 자동 POST 검증은 보호 해제 또는 1회 수동 승인 후 재실행 필요

## Feature flag

- 코드 기본값: `NEXT_PUBLIC_SCENARIO_PILOT_PHASE2` 미설정이어도 `true`
- Preview branch에 명시적 env=`true` 저장은 승인 카드가 필요했고 이번 세션에서는 skip됨
- Production에는 env 변경 없음

## UI

기존 `/results`에 최소 상태 연결만 추가:

- `scenario_matched`
- `recommendations_ready`
- `insufficient_verified_candidates`
- `no_matching_scenario`
- `safety_escalation`

추가 표시:

- 매칭된 피부 관리 상황
- 검증 제품 수
- 추천 이유 요약
- 사용 범위/한계
- D/E `검증 제품 보강 중`
- scenario snapshot

일반 카탈로그 탐색은 insufficient / no_match / safety 상황에서 숨김.

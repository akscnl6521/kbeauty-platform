# Scalp / Hair Analysis Spec (비진단)

얼굴 피부 분석과 **분리된** 두피·모발·탈모 관찰 UX 설계입니다.  
질환명 자동 생성·치료·발모 보장·완치 표현을 사용하지 않습니다.

## 시작 선택

- 얼굴 피부
- 두피
- 모발
- 입술
- 색조

한 세션에서 복수 도메인을 선택할 수 있으나, **추천 후보군은 도메인별로 분리**합니다.

## 두피 질문

- 두피 타입: dry / oily / combination / sensitive / normal / unknown
- 유분 발생 시점
- 건조·당김
- 가려움
- 비듬·각질
- 냄새
- 붉은기
- 뾰루지
- 열감

## 모발 질문

- 굵기: fine / medium / thick
- 곱슬 정도: straight / wavy / curly / coily
- 건조, 손상, 염색·탈색, 열기구, 끊어짐, 볼륨

## 탈모 관찰 질문

패턴:

- 전체적으로 빠짐 (diffuse_shedding)
- 정수리 (crown_thinning)
- 헤어라인 (receding_hairline)
- 가르마 (widening_part)
- 부분적으로 비어 보임 (patchy_loss)
- 모발 가늘어짐 (hair_thinning)
- 끊어짐 (breakage)

추가:

- 시작 시기 (sudden / gradual / recurrent)
- 진행 속도·기간
- 동반 증상 (가려움·붉은기·통증·진물·출혈 등)
- 최근 트리거 (스트레스, 출산 후, 다이어트 등 — 자유 입력, 진단 아님)
- 가족력 (선택)

## 안전 흐름

`assessHairLossObservationSafety`:

| level | 의미 | UX |
|-------|------|-----|
| cosmetic_support | 뚜렷한 위험 신호 없음 | 관리 정보 + 검증 제품(구매 CTA는 offer 검증 시에만) |
| professional_consultation | 부분 탈락, 갑작스러운 가늘어짐, 통증·두피 증상 동반 등 | **상담 우선**, 제품 구매 유도 금지 |
| urgent_check | 진물·출혈·딱지, 갑작스러운 넓은 탈락 등 | **즉시 전문가 확인 안내**, 샴푸 추천 억제 |

공통 문구 예:

> 입력하신 내용만으로 원인을 판단할 수는 없습니다. 갑작스럽거나 부분적으로 빠지는 양상, 통증·진물·출혈이 동반되면 샴푸 선택보다 전문가 상담을 먼저 고려하세요.

금지:

- 원형탈모·지루성피부염 등 질환명 단정
- “탈모 치료”, “발모 보장”, “완치”
- 상담 우선 상태에서 구매 CTA 강조

## 결과 구성

1. 두피 환경 관리 정보 (비진단)
2. 모발 관리 정보
3. 상담 우선 / 긴급 확인 안내 (해당 시)
4. 도메인별 검증 제품 (`rankScalpProducts` / `rankHairProducts`)
5. 공식 기능성 주장(검증된 경우만 배지)
6. 비진단 고지

## 얼굴 분석과의 관계

- `rankProducts` (얼굴) 공식 변경 없음
- 샴푸·색조를 얼굴 후보군에 혼합하지 않음
- redness / expert_first 정책과 동일한 “상담 우선 > 구매” 원칙 공유

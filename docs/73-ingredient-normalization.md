# 73 — Ingredient Normalization

## 처리

전성분 분리 → INCI 정규화 → alias 후보 → 중복 제거 → 순서 유지

## 신규 성분

높은 확신: 기존 ingredient 연결  
중간: alias candidate  
낮음: needs_review  
임의 성분명 생성 금지

근거/주의: `evidence-link.ts` 힌트 + 기존 `ingredient_evidence` / `ingredient_cautions`  
의학적 확정·치료 표현 금지. 근거 충돌 → needs_review.

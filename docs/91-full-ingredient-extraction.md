# 91 — Full Ingredient Extraction

HTML textContent / JSON-LD `additionalProperty` / labeled sections (ingredients, INCI, 전성분…).

- script 실행 금지
- 원문 전체 장기 저장 대신 정제 문자열 + `rawHash`
- key ingredients ≠ full INCI
- 없으면 추측 금지 → `ingredients_missing` queue

구현: `src/lib/pipeline/ingredient-extract.ts`

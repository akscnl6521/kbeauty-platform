# 92 — INCI Normalization

파서: 쉼표 분리, and/및 보호, 농도·별표 제거, CI 색소, fragrance/parfum, 순서 유지.

매칭: slug → name_en → name_ko → alias.  
결과: exact|alias|normalized|ambiguous|unmatched.

자동 `product_ingredients`는 exact/alias/normalized + threshold만.  
ambiguous/unmatched → needs_review queue. 임의 ingredient INSERT 기본 금지.

구현: `ingredient-normalize.ts`, `ingredient-link.ts`

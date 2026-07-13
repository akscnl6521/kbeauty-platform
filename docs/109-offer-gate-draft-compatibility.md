# 109 — Offer Gate Draft Compatibility

draft(`active=false`) 제품에도 verified offer UPSERT 허용.
제품 활성화 게이트가 verified offer를 요구하므로 chicken-egg 방지.

추천 Top5는 여전히 `products.active=true` + `verified_at` 필요.

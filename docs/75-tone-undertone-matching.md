# 75 — Tone / Undertone Matching

## 스킨케어 vs 색조

- 스킨케어: `toneRelevance=not_applicable` (강제 피부색 분류 금지)
- 색조: shade/depth/undertone/finish/white cast 등 명시 근거만

이미지 기반 shade는 별도 모듈. 부정확한 이미지 추론만으로 verified 금지.

구현: `scoreToneUndertone`

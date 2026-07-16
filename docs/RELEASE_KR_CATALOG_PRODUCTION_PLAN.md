# Production 한국 카탈로그 반영 계획

최종 갱신: 2026-07-16  
**상태:** A안 신규 **5건 INSERT 완료** (id 188~192) · 중복 3건 스킵 · media 없음 · main/배포 **미실행**

## 권고

**A. Staging COSRX 한국 제품 중 Production에 없는 신규분만 INSERT (이름/의도 중복은 스킵)**

이유: Production에 이미 COSRX 다수 존재. Staging slug를 그대로 넣으면 Snail 92·Retinol·Vitamin C가 **중복 제품**이 됨.

## Staging 소스(참조)

| 항목 | 건수(백업 기준) |
|------|----------------:|
| products (전체 Staging) | 11 |
| 그중 COSRX 시드 후보 | 8 (id 4~11) |
| ingredients | 129 |
| product_ingredients (시드 8건) | 218 |
| catalog_product_media | 11 (경로 비움 · Production 테이블 없음) |
| product_offers | 2 (시드 관련 1건은 중복 SKU) |

백업: `data/backups/2026-07-14-catalog/`  
프로브(id 2·3)·Snail 96(id 1)은 A안 대상 **제외**.

## 2026-07-16 dry-run 결과 (읽기 전용)

Production ref: `rhfrmvkjsummaylpzmns` · products **186** · ingredients **40**

### 신규 INSERT 가능 (exact slug·이름 미존재) — 5건

| Staging id | slug | name |
|-----------:|------|------|
| 4 | `cosrx-low-ph-good-morning-gel-cleanser` | Low pH Good Morning Gel Cleanser |
| 5 | `cosrx-aha-bha-clarifying-treatment-toner` | AHA/BHA Clarifying Treatment Toner |
| 6 | `cosrx-hydrium-watery-toner` | Hydrium Watery Toner |
| 7 | `cosrx-the-niacinamide-15-serum` | The Niacinamide 15 Serum |
| 9 | `cosrx-the-6-peptide-skin-booster-serum` | The 6 Peptide Skin Booster Serum |

### 스킵 (이름/의도 중복) — 3건

| Staging id | Staging slug | Production 기존 |
|-----------:|--------------|-----------------|
| 8 | `cosrx-advanced-the-vitamin-c-23-serum` | id 187 `the-vitamin-c-23-serum` |
| 10 | `cosrx-advanced-snail-92-all-in-one-cream` | id 28 `cosrx-snail-92-cream` |
| 11 | `cosrx-the-retinol-0-1-cream` | id 29 `cosrx-retinol-cream` |

### 스키마·복원 주의

1. **Staging id 재사용 금지** — Production에 id 4·10 등 이미 존재. 신규 id 발급 후 `product_ingredients` 재매핑.
2. **ingredients id 재사용 금지** — 이름(INCI) 기준 upsert 후 링크.
3. Production에 `catalog_product_media` **없음** → media 복원 스킵.
4. offer는 unverified 유지 · **자동 Verified 금지** · 추천 Top5에 unverified offer 미포함.
5. migration: Production 최신 원격 `20260713183335` · Staging 전용 GRANT/미디어 migration은 A안 최소 INSERT에 **필수 아님**(media 스킵).
6. signed URL / Storage 재업로드: 이번 dry-run 범위에서 media path 비어 있음 → **해당 없음**.

## 반영 전 체크리스트

1. Production 명시 승인 — **「진행승인」 수신 (2026-07-16)**
2. Staging ↔ Production slug/이름 중복 조회 — **완료**
3. migration 갭 확인 — **확인 (media 스킵)**
4. 복원 순서: ingredients → products(신규 5) → product_ingredients → (media 스킵) → offers(선택)
5. signed URL / Storage — media 없음 → 스킵
6. offer unverified · 자동 Verified 금지
7. S2V needs_review는 후보만 · 제품 Verified 자동 승격 금지
8. dry-run 리포트 — **완료** → 다음: 소량 **1건 스모크** → 나머지 4건
9. Production 추천 Top5 unverified offer 미포함 재확인 (스모크 후)

## 스모크·나머지 결과 (2026-07-16)

| id | slug | links | verified_at |
|---:|------|------:|:-----------:|
| 188 | cosrx-low-ph-good-morning-gel-cleanser | 27 | NULL |
| 189 | cosrx-aha-bha-clarifying-treatment-toner | 11 | NULL |
| 190 | cosrx-hydrium-watery-toner | 13 | NULL |
| 191 | cosrx-the-niacinamide-15-serum | 15 | NULL |
| 192 | cosrx-the-6-peptide-skin-booster-serum | 45 | NULL |

## 다음 실행

**main 병합** / **Production 배포**는 별도 승인 후에만.  
공개 노출이 필요하면 `verified_at` 설정은 관리자 검증 후 (자동 Verified 금지).

**금지:** 중복 3건 INSERT · Staging id 재사용 · probe · 무단 main/배포

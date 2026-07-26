# Phase 2.6.2 — A 엄격안 Staging 적용 후 검증

checked_at: 2026-07-22  
Staging: `jfnj***gfd`  
Production write: **0**  
B 예외안: **미적용**

## 적용 내용 (사용자 Dashboard v2)

1. BOJ offer `13fe02a6-…` : `verification_status` unverified → **verified**  
   (stock/price/url/seller/active 불변, OOS 유지)
2. A 엄격 RLS 적용 (verified + in_stock **또는** verified official KR OOS/unknown)

## 검증 결과

### anon 가시성
| 항목 | 결과 |
|------|------|
| anon_visible | **21** (20→21) |
| 추가 행 | BOJ 1건만 (`out_of_stock` + `verified`) |
| ROUND LAB anon | **비가시** (unverified 유지) |

### C Top
| Rank | slug | commerce | CTA |
|------|------|----------|-----|
| 1 | cosrx-aha-bha-clarifying-treatment-toner | in_stock | ON |
| 2 | beauty-of-joseon-green-plum-refreshing-toner | **out_of_stock** | **OFF** |
| 3 | anua-heartleaf-77-soothing-toner | in_stock | ON |
| 4 | haruharu-wonder-black-rice-hyaluronic-toner | availability_unknown | OFF |

### 테스트
- `test:recommendation-commerce-separation` ok
- `test:recommendation-scenario-phase2` ok
- `test:quality` ok

### Preview
- URL: https://kbeauty-platform-7lyllvzr8-akscnl6521s-projects.vercel.app  
- branch alias: https://kbeauty-platform-git-feature-recomm-744811-akscnl6521s-projects.vercel.app  
- API smoke: Vercel SSO 보호(수동 로그인 필요)  
- Staging DB 변경은 Preview 재배포 없이 런타임 반영

## Rollback
`supabase/migrations/STAGING_ONLY_ROLLBACK_20260722_boj_verify_and_rls_a_v2.sql`

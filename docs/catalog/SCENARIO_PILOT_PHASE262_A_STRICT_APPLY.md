# Phase 2.6.2 — A 엄격안 적용 준비 (Dashboard 수동)

## Dry-run 결과 (통과, write 0)

| 항목 | 결과 |
|------|------|
| Staging ref | `jfnj***gfd` |
| PDP | 청매실 AHA BHA 토너 · 18,000원 · **SOLD OUT** |
| 용량 | 라이브 HTML에 150ml 문자열 없음 · Phase 2.3/#31 SKU 유지 |
| Staging offer | **정확히 1건** `13fe02a6-…` |
| 상태 | official KR · OOS · unverified · 18000 · active |
| ROUND LAB | 변경 대상 아님 |

## Agent 적용 차단 사유

1. `service_role`에 `product_offers` **UPDATE 권한 없음** (SELECT/INSERT만)
2. `supabase db query --linked` **IPv6 미지원**으로 ALTER POLICY 실행 불가

→ **Supabase Dashboard SQL Editor**에서 Staging 전용 적용 필요.

## 적용 방법 (사용자)

1. 브라우저에서 [Supabase Dashboard](https://supabase.com/dashboard) 열기
2. 프로젝트 ref가 **`jfnj***gfd`** 인지 확인 (Production `rhfr***mns`면 중단)
3. 왼쪽 **SQL Editor** 클릭
4. 파일 내용 전체를 붙여넣기:  
   `supabase/migrations/STAGING_ONLY_APPLY_20260722_boj_verify_and_rls_a.sql`
5. **Run** 실행
6. 아래가 보이면 성공:
   - BOJ row: `verification_status=verified`, `stock_status=out_of_stock`, `price=18000`
   - ROUND LAB: 여전히 `unverified`
   - anon/authenticated privilege: **SELECT만**

## Rollback

같은 Staging에서:  
`supabase/migrations/STAGING_ONLY_ROLLBACK_20260722_boj_verify_and_rls_a.sql`

## 적용 후 Agent가 이어서 할 일

사용자가 「적용했어」라고 하면:

```bash
node scripts/phase262-post-apply-verify.mjs
npm run test:recommendation-commerce-separation
npm run test:recommendation-scenario-phase2
```

확인 목표: anon 20→21, 추가=BOJ 1건, commerce=out_of_stock, CTA OFF, Haruharu=availability_unknown

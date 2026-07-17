# Production 일괄 검토 체크리스트

최종 갱신: 2026-07-17  
**Staging 다양성 1차는 완료.** Production 변경은 이 목록을 본 뒤 한 번에 결정.

## A. 이미 끝난 것 (재실행 금지)

- [x] main 병합 (`2b17f5f`)
- [x] Production 배포 (www.kbeautymatch.com · health 200)
- [x] A안 COSRX 5건 INSERT (id 188~192, `verified_at` NULL)
- [x] Staging 다양성·이미지·KRW offer·Preview official_global
- [x] Staging 최종 품질 (`check:staging-quality` · KR offers 14 · `test:quality`)

## B. 대시보드에서 확인할 것 (값 채팅에 붙이지 말 것)

1. **Vercel → Production → Environment Variables** — [x] **에이전트 대체 확인 완료**
   - `AI_PROVIDER` 존재 · mock 아님 (`requiredConfigPresent`)
   - `NEXT_PUBLIC_SITE_URL` · `OPENAI_API_KEY` Production에 존재
2. **Supabase Production → Authentication → URL Configuration** — [ ] **사용자 확인**
   - Site URL: `https://www.kbeautymatch.com`
   - Redirect: `https://www.kbeautymatch.com/auth/callback`

## C. Production 게이트 (현재 의도)

| 항목 | 상태 |
|------|------|
| Preview `official_global` (USD 공식 offer) | **Production에 적용 안 됨** (`VERCEL_ENV=production`) |
| 핵심 Top5 | KRW + 한국 판매처 + verified + in_stock만 |
| COSRX 188~192 | `verified_at` NULL → 공개 Top5 미노출 |
| Staging KR 다양성 (14·브랜드6) | **Production DB에 자동 복사 안 됨** |

## D. 에이전트 읽기 점검 (2026-07-17)

| 항목 | 결과 |
|------|------|
| `/api/health` | **200** · ok · version `2b17f5f` · supabaseReachable · requiredConfigPresent |
| 홈 | **200** |
| Vercel Production env 키 | AI_PROVIDER · SITE_URL · OPENAI · Supabase 키 **존재** (값 미출력) |
| AI mock 차단 | **통과** (requiredConfigPresent) |
| Auth URL | **섹션 B-2 사용자** |

## E. 일괄 승인 시 결정할 문구 (원하실 때만)

채팅에 아래 중 필요한 것만:

- `Production AI/Auth 확인 완료`
- `Production에 KR offer 게이트 유지 확인`
- `Production 재배포 진행` (코드 반영이 필요할 때)
- `Production COSRX verified_at 설정 진행` (검수 후 · 자동 금지 원칙 유지)

## F. Staging 잔여

- [x] 다양성 5종 이미지·KRW offer · Top5 14·브랜드 6
- 잔여 27 heroes 공식 INCI: **BLOCKED**
- 다양성 2차: INCI 해소 전 승격 풀 없음

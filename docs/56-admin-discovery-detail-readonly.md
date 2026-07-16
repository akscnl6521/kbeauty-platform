# docs/56-admin-discovery-detail-readonly.md — 관리자 discovery 상세 1차 (읽기 전용)

최종 갱신: 2026-07-13  
상태: **코드 구현 · commit/push 안 함**  
관련: `docs/40`, `docs/55`

---

## 1. 생성/수정 파일

| 경로 | 역할 |
|------|------|
| `src/lib/admin/discovery-detail.ts` | `getAdminDiscoveryDetail` |
| `src/app/api/admin/discovery/[id]/route.ts` | GET 상세 API |
| `src/app/admin/discovery/[id]/page.tsx` | 상세 UI |
| `src/app/admin/discovery/page.tsx` | 후보명·상세 링크 |

쓰기·상태 변경·seed·migration **없음**.

## 2. 원격 스키마

### product_discovery_candidates
목록 컬럼 + `search_query`, `discovered_at`,  
`sale/ingredient/evidence/safety_check_status`, `notes`.

### verification_queue
`entity_type='candidate'` + `entity_id`=후보 uuid.

### 미연결
- `data_sources` ↔ candidate **직접 FK 없음** (조인 안 함)
- `product_change_history` ↔ candidate **직접 FK 없음** (product_id만)

현재 후보·큐 **0건**.

## 3. 상태 요약

`canProceedToNextStage` / `nextStage` / `nextStageHint`는 **읽기 전용 참고값**.  
`docs/40` 허용 전환과 맞춤. rejected/needs_review → 불가. published → 완료.  
상태 변경 버튼 **없음**.

## 4. API

`GET /api/admin/discovery/[id]`

| 케이스 | 상태 |
|--------|------|
| 잘못된 UUID | 400 |
| 없음 | 404 |
| 미인증 | 401 |
| 성공 | 200 `{ candidate, linkedProduct, queue, statusSummary }` |

`assigned_to` 원문 미반환.

## 5. URL 보안

https만 「출처 열기」 · `noopener noreferrer`

## 6. 테스트 한계

후보 0건 → 상세 200 E2E **미실행** (가짜 데이터 생성 금지).  
빌드 + 401/400(인증 후) 경로 검증.

## 7. 다음

읽기 전용 ingredients 목록 또는 discovery 쓰기 API(별도 승인).

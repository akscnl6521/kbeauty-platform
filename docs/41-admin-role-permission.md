# docs/41-admin-role-permission.md — 관리자 역할·권한 설계

최종 갱신: 2026-07-13  
상태: **설계 전용**  
중요: **이번 단계에서 인증 구현하지 않음.** 선행 과제로 분리.

---

## 1. 현재 상태 (BLOCKER급 선행)

| 항목 | 상태 |
|------|------|
| Next.js 관리자 세션 | 없음 |
| middleware | 없음 |
| service_role 서버 client | 없음 |
| Zod | 없음 |
| `/admin/catalog-review` | dev only, **무인증** |
| `profiles.role` | 원격 text 컬럼 존재 (값 체계 앱 미정의) |
| admin_users / admin_roles 테이블 | **없음** |

결론: UI/API 구현 **전에** 최소 인증 구조를 별도 과제로 완료해야 한다.

---

## 2. 역할 후보

| Role | 설명 |
|------|------|
| `admin` | 전체. 시스템·publish·위험 작업 |
| `reviewer` | 검토·승인·안전·queue 완료. 시스템 설정 제외 |
| `researcher` | evidence/caution 작성·편집. **publish 금지** |
| `catalog_manager` | discovery/product/variant/offer 관리. evidence **승인** 금지 |
| `read_only` | 조회만 |

일반 사용자(`authenticated` / 소비자)는 `/api/admin/*` 및 `/admin/*` 접근 불가.

---

## 3. 최소 인증 구조 (선행 과제 — 설계만)

권장 방향 (구현 시 택1, 지금 ALTER 금지):

**옵션 A — profiles.role 활용**  
- Supabase Auth + `profiles.role` allow-list  
- 서버에서 `auth.getUser()` 후 profiles 조회  

**옵션 B — admin_users 분리**  
- `admin_users(user_id, role, active)`  
- 소비자 profiles와 권한 분리  

**옵션 C — 초대 코드 + allowlist**  
- 소규모 운영 초기. `invite_codes` 확장 검토  

공통 필수:
1. 서버만 service_role 사용  
2. 클라이언트는 anon + 사용자 JWT  
3. 관리자 쓰기는 API에서만  
4. role 변경은 admin만  

---

## 4. service_role 사용 원칙

| 허용 | 금지 |
|------|------|
| 서버 Route Handler / 서버 액션 | `NEXT_PUBLIC_*`에 키 넣기 |
| 관리자 4테이블 CRUD | 브라우저 `createClient(service_role)` |
| publish 트랜잭션 RPC 호출 | 로그·문서에 키 값 기록 |
| | 클라이언트 번들 |

공개 7테이블은 원칙적으로 관리자 읽기도 service_role 또는 사용자 JWT+정책으로 가능.  
미승인 행 조회가 필요하므로 **관리자 읽기는 service_role(또는 전용 admin policy) 권장.**

---

## 5. 화면 권한

| 화면 | admin | reviewer | researcher | catalog_manager | read_only |
|------|-------|----------|------------|-----------------|-----------|
| /admin | ✓ | ✓ | ✓ | ✓ | ✓ |
| /admin/discovery | ✓ | ✓ | ✓ | ✓ | ✓ |
| discovery 쓰기 버튼 | ✓ | △검토 | — | ✓ | — |
| /admin/products | ✓ | ✓ | ✓ | ✓ | ✓ |
| product/offer 편집 | ✓ | △ | — | ✓ | — |
| /admin/ingredients | ✓ | ✓ | ✓ | ✓ | ✓ |
| ingredient 편집 | ✓ | △ | ✓ alias | ✓ | — |
| /admin/evidence | ✓ | ✓ | ✓ | ✓ | ✓ |
| evidence 승인 | ✓ | ✓ | — | — | — |
| evidence 작성 | ✓ | △ | ✓ | — | — |
| /admin/verification | ✓ | ✓ | △ | △ | ✓ |
| queue complete | ✓ | ✓ | — | — | — |
| /admin/sources | ✓ | ✓ | ✓ | ✓ | ✓ |
| sources 쓰기 | ✓ | — | — | ✓ | — |
| /admin/history | ✓ | ✓ | ✓ | ✓ | ✓ |
| Publish 버튼 | ✓ | △정책 | — | — | — |

△ = 조직 정책으로 열 수 있으나 기본은 보수적으로 닫음.

---

## 6. API 권한

| API | admin | reviewer | researcher | catalog_manager | read_only |
|-----|-------|----------|------------|-----------------|-----------|
| GET all | ✓ | ✓ | ✓ | ✓ | ✓ |
| POST discovery | ✓ | — | — | ✓ | — |
| PATCH discovery | ✓ | △ | — | ✓ | — |
| sale-check / link / ingredients | ✓ | — | — | ✓ | — |
| evidence POST | ✓ | △ | ✓ | — | — |
| safety-review | ✓ | ✓ | — | — | — |
| submit-review | ✓ | ✓ | — | ✓ | — |
| approve (→verified) | ✓ | ✓ | — | — | — |
| reject | ✓ | ✓ | — | — | — |
| **publish** | ✓ | 기본 ✗* | — | — | — |
| verification assign/complete | ✓ | ✓ | — | — | — |

\* publish는 **admin 전용**을 기본으로 한다. dual-control이 필요하면 reviewer approve + admin publish.

---

## 7. 테이블 작업 권한 (논리)

| 테이블 | 클라이언트(anon/auth) | 관리자 API |
|--------|----------------------|------------|
| brands 등 공개 7 | 승인 SELECT만 | CRUD (승인 워크플로 준수) |
| discovery / queue / sources / history | **0** | CRUD (history는 insert 중심) |
| products / ingredients / offers | 기존 정책 (offers는 verified+in_stock 등) | 서버에서만 파이프라인 갱신 |

관리자 4테이블에 anon 정책 추가 **금지** (현재 RLS ON + 정책 0 + GRANT 0 유지).

---

## 8. 승인 분리 원칙

1. **작성 ≠ 승인**  
   - researcher가 evidence 작성 → reviewer가 approved  
2. **판매 확인 ≠ publish**  
   - catalog_manager sale-check → admin publish  
3. **workflow verified ≠ published**  
4. **자기 승인 금지 (권장)**  
   - 동일 사용자가 submit과 publish를 연속 수행하지 않도록 정책 플래그  
5. **의료/고위험 caution**  
   - reviewer 이상, publish 시 피부과 안내 우선

---

## 9. 최소 권한

- 일상 운영: catalog_manager + reviewer  
- 연구: researcher  
- 사고 대응·스키마: admin  
- 감사: read_only  

role 문자열은 allow-list. 임의 text role 거부.

---

## 10. profiles.role 과의 관계

원격 `profiles.role`은 존재하나:
- 앱에서 읽지 않음  
- 허용 값 CHECK 없음  
- 관리자 전용인지 불명  

**지금 ALTER하지 말 것.**  
선행 과제에서:
- role enum/CHECK 또는 admin_users  
- RLS로 본인 profile만 읽기  
- 관리자 API에서 role 검증  

을 확정한다.

---

## 11. 보안 위험 (문서화)

| 위험 | 완화 |
|------|------|
| catalog-review 무인증 | production 404 유지. 신규 admin은 인증 필수 |
| products/ingredients anon에 DML 권한 잔존 | 별도 보안 hardening migration 후보 (이번 범위 밖) |
| service_role 유출 | env만, CI 시크릿 |
| 상태 raw UPDATE | 전환 API만 |
| 기존 186 일괄 publish | 서버 게이트 + UI 경고 |

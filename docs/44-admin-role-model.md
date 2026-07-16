# docs/44-admin-role-model.md — 관리자 역할 모델

최종 갱신: 2026-07-13  
상태: **설계 전용**  
권한 SSOT: **`admin_users.role`** (`profiles.role` 사용 안 함)  
관련: `docs/41`, `docs/43`, `docs/45`

---

## 1. 역할 정의

| Role | 설명 | 핵심 제한 |
|------|------|-----------|
| `admin` | 전체 운영·publish·관리자 계정 관리 | — |
| `reviewer` | 검토·승인·safety·queue 완료 | 계정 관리·(기본) publish 금지 |
| `researcher` | evidence/caution 작성 | **승인·publish 금지** |
| `catalog_manager` | discovery/product/variant/offer | **evidence 승인 금지** |
| `read_only` | 조회 | **모든 쓰기 금지** |

소비자 `profiles.role` 기본값 `member` 등은 **관리자 API와 무관**.

---

## 2. 작성 / 승인 분리

| 영역 | 작성 가능 | 승인 가능 |
|------|-----------|-----------|
| evidence | researcher, admin | reviewer, admin |
| caution 초안 | researcher, admin | reviewer, admin |
| discovery/sale/ingredients | catalog_manager, admin | (단계 전진은 정책 API) |
| safety 검토 | reviewer, admin | reviewer, admin |
| workflow → verified | reviewer, admin | — |
| workflow → published | **admin만** | — |
| 관리자 계정 | — | **admin만** |

원칙:
- 작성자 ≠ 승인자 (권장: 동일 user_id의 self-approve 차단 플래그)
- researcher는 publish 불가
- catalog_manager는 evidence `approved` 전환 불가
- read_only는 GET만

---

## 3. 작업별 권한표

범례: ✓ 허용 / — 금지

| 작업 | admin | reviewer | researcher | catalog_manager | read_only |
|------|-------|----------|------------|-----------------|-----------|
| 대시보드 조회 | ✓ | ✓ | ✓ | ✓ | ✓ |
| discovery 생성/수정 | ✓ | — | — | ✓ | — |
| 판매 확인 | ✓ | — | — | ✓ | — |
| 성분 입력 | ✓ | — | — | ✓ | — |
| evidence 작성 | ✓ | △ | ✓ | — | — |
| evidence 승인 | ✓ | ✓ | — | — | — |
| safety 승인 | ✓ | ✓ | — | — | — |
| queue 할당 | ✓ | ✓ | — | — | — |
| queue 완료 | ✓ | ✓ | — | — | — |
| → verified | ✓ | ✓ | — | — | — |
| → **published** | ✓ | — | — | — | — |
| 변경 이력 조회 | ✓ | ✓ | ✓ | ✓ | ✓ |
| **관리자 계정 관리** | ✓ | — | — | — | — |
| role/active 변경 | ✓ | — | — | — | — |

△ = 기본 금지, 조직 정책으로만 개방.

---

## 4. role 변경 규칙

1. 변경 주체: **admin만** (서버 API 또는 Dashboard SQL bootstrap)  
2. 대상이 마지막 active admin이면 **강등/비활성 금지** (가드)  
3. 허용 role 값만 CHECK  
4. 자기 자신 강등 시 다른 admin 존재 확인  
5. 모든 변경 → `admin_role_history`  
6. 브라우저·공개 API·URL 파라미터 승격 **금지**

---

## 5. 비활성화 (`active=false`)

- 즉시 `/admin`·`/api/admin` 403  
- 행 삭제 대신 비활성  
- 재활성은 admin + history  
- Auth 사용자 ban과 별개 (둘 다 가능)

---

## 6. 관리자 권한 변경 감사

기록 항목:
- `target_user_id`
- `old_role` / `new_role`
- `old_active` / `new_active`
- `changed_by`
- `reason`
- `changed_at`

### product_change_history vs admin_role_history

| | product_change_history | admin_role_history |
|--|------------------------|--------------------|
| 목적 | 제품·offer·성분 등 | 관리자 권한 |
| FK | product/variant | auth user |
| 권고 | 제품만 | **권한은 분리** |

**권고: 별도 `admin_role_history`.**  
제품 이력에 관리자 UUID/role을 섞지 않음.

---

## 7. profiles.role 과의 관계

| 사용 | 금지 |
|------|------|
| 소비자 구분(member 등) 향후 | 관리자 게이트에 profiles.role 사용 |
| | 클라이언트가 role을 admin으로 쓰는 로직 |

profiles UPDATE 정책 강화는 **별도 보안 hardening** 후보 (admin 인증 범위 밖이지만 위험 문서화됨).

---

## 8. API·화면 매핑

세부 path는 `docs/39`·`docs/41`을 따른다.  
본 문서는 role 매트릭스의 SSOT로 취급한다.

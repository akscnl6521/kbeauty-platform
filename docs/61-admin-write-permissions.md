# docs/61-admin-write-permissions.md — 관리자 쓰기 권한

최종 갱신: 2026-07-13  
상태: **구현 완료**

## 역할

| 역할 | discovery 생성/수정 | 제품 연결 | queue 생성 | queue 검토 | publish |
|------|---------------------|-----------|-----------|-----------|---------|
| admin | ✅ | ✅ (교체 포함) | ✅ | ✅ | ✅ |
| catalog_manager | ✅ | ✅ (신규만) | ✅ | ❌ | ❌ |
| researcher | ✅ | ❌ | ✅ | ❌ | ❌ |
| reviewer | ❌ | ❌ | ❌ | ✅ | ❌ |
| read_only | ❌ | ❌ | ❌ | ❌ | ❌ |

## 구현

- `src/lib/auth/admin-permissions.ts`
- `src/lib/admin/write-guard.ts`
- 역할은 **서버 `admin_users.role`만** 신뢰 (클라이언트 role 무시)
- 부족 시 `403 FORBIDDEN` — `"이 작업을 수행할 권한이 없습니다."`

## 미지원

- 역할 변경 UI
- reopen / DELETE

# docs/57-admin-ingredients-readonly.md — 관리자 성분 목록 (읽기 전용)

최종 갱신: 2026-07-13  
상태: **구현 완료**  
관련: `docs/58`

---

## 1. 생성/수정 파일

| 경로 | 역할 |
|------|------|
| `src/lib/admin/ingredients.ts` | `getAdminIngredients` |
| `src/lib/admin/query.ts` | 공통 pagination/query 헬퍼 |
| `src/app/api/admin/ingredients/route.ts` | GET 목록 API |
| `src/app/admin/ingredients/page.tsx` | 읽기 전용 UI (상세 링크 포함) |

쓰기·seed·migration·원격 schema 변경 **없음**.

## 2. 원격 스키마

### ingredients (~40행)
| 컬럼 | 비고 |
|------|------|
| id bigint | PK |
| slug, name_en | NOT NULL |
| name_ko, name_ja | nullable |
| effects, mechanism, caution, paper_* | 레거시 |
| created_at | timestamp |
| **active / verified_at / inci_name / updated_at** | **없음** |

### 관련 테이블
| 테이블 | 비고 |
|--------|------|
| ingredient_aliases | alias, language_code, alias_type, review_status |
| ingredient_evidence | evidence_level, review_status (≠ ingredient verified) |
| ingredient_cautions | caution_type, severity, review_status |
| product_ingredients | verification_status |

## 3. 필터 동작 (스키마 제약)

| 필터 | 동작 |
|------|------|
| active=true | 컬럼 없음 → 전체 |
| active=false | 컬럼 없음 → 0건 |
| verified=true | verified_at 없음 → 0건 |
| verified=false | 전체 |
| hasAlias/Evidence/Caution/linked | 관련 테이블 ingredient_id 집합 |

INCI: `ingredient_aliases.alias_type='inci'`일 때만 표시.  
evidence 존재 ≠ ingredient verified.

## 4. API / UI

- `GET /api/admin/ingredients`
- `/admin/ingredients`
- 상세: `/admin/ingredients/[id]` (`docs/58`)

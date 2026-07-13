# 123 — User Care Lifecycle

최종 갱신: 2026-07-13

## 목적

한 번 분석하고 떠나는 UX가 아니라, 분석 이후 **3·7·15·30일** 동안 피부 상태·제품 반응을 추적하고
루틴·추천을 **안전하게 보정 제안**하는 지속 관리 경험.

## 흐름

1. `/analyze` → `/api/analyze` → `/results` (기존 유지)
2. 사용자가 `/my`에서 분석 snapshot 저장 (익명 기기 가능)
3. AM/PM 루틴 저장
4. 시스템이 Day 3/7/15/30 체크인 자동 예약
5. 체크인 완료 → 변화 점수 · 루틴 제안 · 상담 권고 규칙
6. 사용자 확인 후에만 루틴 버전 증가

## 저장

- **로그인 사용자**: Supabase (`CarePersistence` + `/api/care/*`) · `/my` 인증 필수
- **익명**: 분석/결과는 localStorage · `/my` 진입 전 로그인 · attach로 계정 연결
- **Migration**: `create_continuous_care_persistence` 적용 완료 (`docs/133`)
- **인증**: `docs/138` · 온보딩 `docs/139`

## 금지

- 의료 진단·치료 보장
- 동의 없는 루틴 강제 변경
- 관리자 목록에 이메일·UID·메모·사진 노출
- Cursor의 운영 worker/SQL 실행

# Phase 3.0 — 실시간 안내형 얼굴 촬영 MVP + AI 분석 대기 UX

최종 갱신: 2026-07-22  
기준: MASTER_PLAN.md §22 · §분석 대기 UX · v4.2

## 1. 조사 결과 (구현 전)

| 항목 | 현재 상태 |
| --- | --- |
| `/analyze` 사진 입력 | `FileReader` + `input[type=file]` 드래그앤드롭 단일 업로드 |
| 카메라 API | **미사용** (`getUserMedia` 없음) |
| 이미지 전처리 | 클라이언트에서 dataURL→base64만 분리. EXIF 제거는 Care용 `stripExif` 존재, analyze 미연결 |
| `/api/analyze` | `mode: photo \| manual`. photo는 `imageBase64` 단일 장. requestId 없음 |
| 로딩/오류 | `loading` boolean + 버튼 문구 "분석 중..." · 전용 진행 화면 없음 |
| 세션 | 분석 결과 localStorage · 입력 스냅샷 · 사진은 메모리 state만 |
| 동의 UI | `PhotoConsentPanel` (분석 동의 / 비교 저장 분리) |
| 얼굴 landmark | 의존성 **없음** → pose는 `pose_check_unavailable` |
| 모바일 | `accept="image/*"`만 · Safari 카메라 capture 속성 없음 |

## 2. MVP 범위

- 필수 각도 3장: 정면 · 왼쪽 45° · 오른쪽 45°
- 기본: 카메라 촬영 / 보조: 갤러리 · 문진만
- 자동 촬영 OFF · 수동 + 로컬 품질 검사
- 사진은 브라우저 메모리/object URL만 · Storage·migration 없음
- 분석 API는 **정면(또는 첫 통과 사진) 1장** 전송 (기존 계약 유지)

## 3. Feature flag

- `NEXT_PUBLIC_GUIDED_CAMERA_CAPTURE`
- 미설정/`1`/`true` → **ON** (Preview 기본)
- `0`/`false`/`off` → 기존 단일 업로드 UI
- Production 환경변수는 변경하지 않음 (보안 수단 아님)

## 4. 미룬 항목

- 위/아래 각도 · 부위 근접 · 라이브니스 · QR 이어촬영
- care-photos bucket · DB migration · 영구 저장
- 제3자 얼굴인식 API · 가짜 분석 수치
- WQ-G · Production · main 병합

## 5. 구현 요약 (2026-07-22)

| 영역 | 구현 |
| --- | --- |
| Flag | `NEXT_PUBLIC_GUIDED_CAMERA_CAPTURE` 기본 ON |
| UI | `GuidedCaptureFlow` · 타원 가이드 · 1/3–3/3 · 분석 진행 오버레이 |
| 품질 | `qualityCheck.ts` · EXIF strip (`stripExif`) |
| API | 기존 `/api/analyze` photo 1장(정면 우선) |
| 테스트 | `npm run test:guided-capture` · `npm run build` 통과 |

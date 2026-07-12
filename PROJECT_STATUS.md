# PROJECT_STATUS.md — K-Beauty Match 현재 상태

최종 갱신: 2026-07-12

## 현재 컴퓨터 / 경로

| 항목 | 값 |
|------|-----|
| 현재 컴퓨터 | 보조컴퓨터 |
| 프로젝트 경로 | `C:\Users\조병선\Desktop\K뷰티사업\kbeauty-platform` |
| GitHub 저장소 | https://github.com/akscnl6521/kbeauty-platform.git |
| 현재 브랜치 | `main` |
| 최근 정상 커밋 | `1895221` — Sprint 8: Separate core recommendations and normalize ingredient names |
| Working tree | 문서 3개 신규 상태 (코드 working tree는 Sprint 8 기준 clean이었음) |
| 빌드 | `npm run build` 성공 |

## 환경 / 시크릿

| 항목 | 값 |
|------|-----|
| `.env.local` 위치 | `C:\Users\조병선\Desktop\K뷰티사업\kbeauty-platform\.env.local` |
| 현재 AI 실행 방식 | 서버 `POST /api/analyze` — 현재 **mock fallback** (실제 Anthropic/OpenAI/Ollama 연결 전) |
| 비고 | 브라우저는 AI API 키를 직접 사용하지 않음. 프로바이더 선택은 서버만 담당 |

## 실행 가능한 페이지

| 경로 | 역할 |
|------|------|
| `/` | 메인페이지 |
| `/analyze` | AI 피부 분석 (사진·수동·Mock) |
| `/results` | 분석 가이드 + 핵심 추천 Top 5 + 제품 탐색 |
| `/quiz` | 설문 |
| `/routine` | 루틴 |
| `/face-explorer` | 얼굴 영역 탐색 |
| `/ingredients/[slug]` | 성분 상세 |
| `/privacy` | 개인정보 |
| `/terms` | 약관 |
| `/api/analyze` | 서버 AI 분석 API |

## 현재 작동 기능

- 메인페이지
- 피부 분석
- Mock AI 분석
- 분석 결과 저장 (LocalStorage)
- `/results` 자동 이동
- 피부 타입 및 고민 표시
- 추천 성분 및 피해야 할 성분 표시
- 화장품 관리 가능 범위와 한계 표시
- 아침·저녁 루틴 표시
- 주의사항과 신뢰도 표시
- 핵심 추천 제품 Top 5
- 다른 제품 둘러보기
- 성분명 표준화
- 제품 검색
- 즐겨찾기
- 구매처 링크
- 한국어·영어·일본어 구조

## 현재 미완성 기능

- 실제 Anthropic / OpenAI / Ollama 연결
- 알레르기 및 회피 성분 입력
- 현재 사용 제품 등록
- 국가·언어·통화 자동 감지
- 분석 결과 DB 저장
- 3일·7일·15일·30일 안부 확인
- 관리자 시스템
- 사진 분석 (비전 픽셀 전달)
- 깨진 한글 소스 주석 정리

## 다음 작업

1. 소스 파일의 깨진 한글 주석 UTF-8 정리
2. 알레르기 및 회피 성분 입력 추가
3. 현재 사용 제품 등록 구조 추가
4. 안전 필터와 전문가 상담 분기 강화
5. 실제 AI 공급자 연결

## 참고 문서

- `ROADMAP.md` — 완료 / 진행 중 / 다음 작업 / 이후 단계
- `CHANGELOG.md` — Sprint 변경 이력
- `docs/` — 비전·아키텍처 등 상세 초안 (일부 As-Is 서술은 구버전일 수 있음 → 본 파일 우선)

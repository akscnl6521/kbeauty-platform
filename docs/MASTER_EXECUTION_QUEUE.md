# Master Execution Queue — 2026-07-23

근거: `KBEAUTY_MASTER_EXECUTION_PROMPT.md` (수정 금지)  
브랜치: `feature/recommendation-usage-guide-display-20260720`  
규칙: main 병합·Production·유료 API·파괴적 Git·명세 파일 수정·미커밋 삭제 금지. commit/push는 사용자 지시 전 보류.

상태: `done` | `in_progress` | `blocked_external` | `deferred`

| ID | 작업 | 의존 | 상태 | 비고 |
|----|------|------|------|------|
| Q01 | 저장소·문서·미커밋 조사 | — | done | 코드가 문서보다 우선 |
| Q02 | 스킨케어 분석→추천→루틴→저장→체크인 연결 검증 | Q01 | done | Care local-store + analyze/results |
| Q03 | BeautyProfile 계약·저장 연결 | Q01 | done | `src/lib/profile` + local-store |
| Q04 | BeautyProfile 조회·편집 UI | Q03 | done | `/my/profile` |
| Q05 | 문진·도메인 퀴즈 → BeautyProfile 반영 | Q03 | done | DomainQuizClient |
| Q06 | 전체 taxonomy·규제 분리 | Q01 | done | devices/oral/wellness/pro |
| Q07 | 공통 제품 모델·적격·상업 메타 분리 | Q01 | done | `commonProduct.ts` |
| Q08 | 마스카라·립·샴푸 속성 랭커 + 결과 패널 | Q06 | done | 데모풀=속성검증(실구매 아님) |
| Q09 | Organic/Affiliate/Sponsored 분리 | Q07 | done | commercial separation |
| Q10 | 3/7/15/30 체크인·루틴 조정 | Q02 | done | checkinPolicy + UI |
| Q11 | 증상 안전 + 전문가 라우팅 실흐름 연결 | Q02 | done | symptomSafety ↔ professionalRouting → guidance |
| Q12 | 수집·정규화·중복·갱신 파이프라인 | Q07 | done | scripts + catalog libs |
| Q13 | 국가·언어·판매처 구조 | Q01 | done | locale/offer 기존 유지 |
| Q14 | 빈/로딩/오류·접근성·동의 문구 | Q04 | done | 프로필·가이드 보강 |
| Q15 | 관련 selftest + TS | Q04–Q11 | done | master-execution 확장 · journey 통과 |
| Q16 | Preview·실기기·외부 데이터 | — | blocked_external | 사람 검수 |
| Q17 | Production 배포·DB·AI_PROVIDER | — | blocked_external | RELEASE_GATE_PENDING |
| Q18 | Phase 3.1 랜드마크 자동촬영 | — | deferred | flag OFF 유지 |
| Q19 | 문서 갱신(STATUS/ROADMAP/CHANGELOG) | Q15 | done | 본 번들 |
| Q20 | Stage 6 병원 후보·안내·리드 dry-run | Q11 | done | fixtureOnly · 실데이터 미게시 |
| Q21 | Preview 원격 검수 JSON 경로 | Q19 | done | public artifact + VERCEL_URL |

## 구현 가능 큐 종료 조건

- Q01–Q15, Q19–Q21 = done
- Q16–Q18 = 외부/승인 차단으로 위장 완료 금지 · 인터페이스·fixture·문서만 유지

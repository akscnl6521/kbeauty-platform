# PROJECT_STATUS.md — K-Beauty Match 현재 상태

최종 갱신: 2026-07-20

## 현재 기준

- 최상위 계획: K-Beauty Match Master Plan v4.1
- GitHub 저장소: `akscnl6521/kbeauty-platform`
- 기준 브랜치: `main`
- 작업 브랜치: `feature/recommendation-usage-guide-display-20260720`
- 최근 main 병합: PR #29~#32 (영상 권리 검수 큐·통합 매니페스트·루틴 사용 가이드 연결)
- Production 배포: 이번 작업에서 미실행
- Production DB·환경변수 변경: 이번 작업에서 미실행

## 현재 완료된 핵심 기능

- 피부 고민·증상·부위 관찰 입력
- 위험 신호와 전문가 상담 우선 분기
- 제품 추천 안전 필터와 Top 5 게이트
- 현재 제품·루틴 관리
- Day 3·7·15·30 체크인과 지속 관리
- 관리자 제품·성분·검증·카탈로그 도구
- 한국 화장품 후보 수집·정규화·Staging 검수 구조
- 제품 갱신 계획과 due queue 자동화
- 피부과 후보 검수 계획 자동화
- 카탈로그·피부과 자동화 통합 안전 감사
- 제품 갱신·제품 예외·피부과 검수 통합 매니페스트
- 관리자 통합 검수 화면과 GET 전용 API
- 출처·우선순위·검색 필터
- 변경 전후·근거·공식 출처·마지막 확인일 표시
- 영상 자산·권리 상태 및 사용법 정책 모델
- 게시 가능한 제품 사용 가이드 선택 정책
- 영상 권리 만료·삭제·비공개 검수 큐와 통합 매니페스트
- 루틴 화면(`/routine`) 검증된 제품 사용 가이드 연결
- 추천 결과 핵심 제품 카드 검증된 사용 가이드 연결 (공용 `ProductUsageGuide`)
- 관리자 제품 상세 사용 영상·가이드 검수 화면 (읽기 전용, `catalog_product_media` SELECT)
- 부위별 화면(`/face-explorer`)·결과(`area` 쿼리)·관리 가이드에 검증된 사용 가이드 연결 (applicationArea 일치 시만)
- AI 생성·광고·협찬·브랜드 제공·제휴 공용 disclosure 정책 및 UI 라벨

## 자동화 안전 상태

- 자동 게시 금지
- Production 쓰기 금지
- DB 쓰기 없는 dry-run·아티팩트 중심
- 제품·병원 최종 검증 자동 승격 금지
- Organic 추천과 광고·제휴 점수 분리 유지
- 공식 출처 미확보 데이터 생성 금지
- 권리 미확인 영상 게시 금지
- 사용 가이드·영상 유무가 Organic 추천 점수·순위에 영향 없음

## 현재 진행 단계

Master Plan v4.1 구현 우선순위의 **단계 5 리텐션 보강**을 시작했다.

- 단계 4 본기능: 코드·자동 테스트·Staging build 검증 **완료**
- 단계 5 첫 작업: 3·7·15·30일 체크인 응답 분기 정책·화면 연결 **코드 완료** (실제 알림 발송·DB migration 실행 없음)
- 단계 5 두 번째 작업: 체크인 응답 기반 루틴 조정 제안 UI **코드 완료** (사용자 승인 전 자동 변경 없음 · 일시 중지≠삭제 · 되돌리기 · DB migration 미실행)
- Preview 콘솔 localStorage 수동 주입 검수: **중단**
- `/qa/usage-guide` 임시 QA 페이지: **본기능에 포함하지 않음** (미채택)
- main 미병합 · Production 미배포 · Production DB·환경변수 변경 없음

## 다음 작업

1. 체크인 재알림 실제 채널 연결 (이메일·웹푸시·SMS 미구현)
2. 사진 비교 동의·삭제 흐름
3. 재방문 대시보드 보강
4. Preview 수동 샘플 육안 확인 (단계 4 운영 검수 잔여)
5. Preview 관리자 로그인 후 Staging 미디어·통합 검수 육안
6. Preview 원격 검수 JSON 전달 경로 연결

## 현재 차단 또는 사람 확인이 필요한 항목

- Preview 수동 샘플 육안 확인 (단계 4 운영 검수 잔여)
- Preview 관리자 로그인 후 Staging `catalog_product_media` 실제 미디어 육안
- Preview 원격 검수 JSON 주소와 환경변수 연결
- 공식 전성분 미확보 제품의 최종 검증
- 실제 제품 이미지·가격·재고·구매 링크의 사람 최종 확인
- 실제 피부과 진료 범주·의료진·주소·예약 정보 확인
- 외부 영상 사용권과 게시 기간 확인
- Production 배포와 Production DB·환경변수 변경
- 광고·제휴 계약 실제 활성화

## 승인 경계

작업 브랜치 코드·문서·테스트·dry-run·Preview는 반복 승인 없이 진행한다.

다음은 별도 명시 승인 전 실행하지 않는다.

- Production 배포
- Production DB write
- Production 환경변수 변경
- 파괴적 SQL·대량 삭제
- main 병합 (별도 승인)

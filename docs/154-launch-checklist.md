# 154 — Launch Checklist

최종 갱신: 2026-07-13

## 자동 (Cursor/CI)

- [x] `test:pipeline` · `test:journey`
- [x] `check:production` · `check:deployment-env` · `check:release-security`
- [x] `test:smoke` · `build`
- [x] health API · 보안 헤더 · SEO · 오류 페이지

## 사용자 (배포 전)

- [ ] Staging 배포 · HTTP smoke · `/api/health`
- [ ] Auth Site/Redirect URL staging·production
- [ ] 실계정 E2E: 가입→온보딩→/my→체크인
- [ ] www/apex DNS
- [ ] worker/Task Scheduler 운영 PC 정렬 (웹과 분리)
- [ ] main 병합 **별도 승인**

## 금지 확인

- 운영 데이터 대량 생성 0 · 실메일 스팸 0 · DELETE 0 · mock AI production 0

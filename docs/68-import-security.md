# docs/68-import-security.md — Import SSRF·보안

최종 갱신: 2026-07-13

## SSRF 방어

- https만
- localhost / private / link-local / metadata 금지
- DNS resolve 후 private IP 재검사
- redirect마다 재검사 (최대 3)
- file/data/javascript 금지
- 응답 크기·timeout 제한
- User-Agent 명시

## 반환 금지

stack, SQL, service role, DNS/IP 내부, HTML 원문, 쿠키, 토큰, UUID/이메일

## 권한

preview/commit: admin, catalog_manager, researcher (`discovery.create`)  
read_only/reviewer: 403

## 감사

`candidate_imported_from_url` — domain·candidateId·sourceType만  
전체 URL이 꼭 필요 없으면 domain만 저장

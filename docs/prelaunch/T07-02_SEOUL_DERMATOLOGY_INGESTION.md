# T07-02 — Seoul dermatology candidate ingestion (HIRA)

최종 갱신: 2026-07-24

## 목적

공식 HIRA 병원정보 API(`hospInfoServicev2` / `MadmDtlInfoService`)로 **서울 + 피부과** 후보만 수집하는 재개 가능·중복 제거 파이프라인.

- 게시(publish) **금지**
- Production / Staging DB 쓰기 **없음**
- API 키를 URL·아티팩트·provenance에 **넣지 않음**

## 최소 수집 필드

| 필드 | HIRA 출처 |
|------|-----------|
| institutionId | `ykiho` |
| name | `yadmNm` |
| address | `addr` |
| longitude / latitude | `XPos` / `YPos` (있을 때만) |
| phone | `telno` (있을 때만) |
| institutionType | `clCd` / `clCdNm` |
| department | `dgsbjtCd` / `dgsbjtCdNm` |
| source timestamps | `estbDd` + pipeline `collectedAt` / `sourceVerifiedAt` |

## 필터 (공식 필드만)

- **서울**: `sidoCd=110000` 또는 공식 `sidoCdNm` (주소 문자열만으로 통과 금지)
- **피부과**: 공식 `dgsbjtCd=14` 또는 `dgsbjtCdNm=피부과`
- 상호명에 "피부과"만 있는 경우 **거절** (`dermatology_name_keyword_without_official_dept`)

## 파이프라인 기능

- 페이지 단위 **checkpoint** (`paused` → resume)
- **deterministic dedupe** (`ykiho` 우선)
- **stale/refresh**: 90일 재확인 · 180일 만료(게시 차단)
- 필드별 **provenance** + safe source URL (host+path만)
- machine-readable **audit** 아티팩트

## 명령

```bash
npm run test:seoul-dermatology-ingestion
npm run check:seoul-dermatology-ingestion
npm run check:seoul-dermatology-ingestion -- --mode=fixture --max-pages=2
```

아티팩트: `artifacts/seoul-dermatology-ingestion/` (gitignore)

## 코드

- `src/lib/publicData/seoulDermatologyIngestion/*`
- T07-01 클라이언트 재사용: `src/lib/publicData/client.ts`

## 정직 한계

- fixture / dry-run 기본 · 실 API live 호출은 키·승인 후
- 후보 ≠ publishable · 사람 검수(T07) 별도
- Production 미터치

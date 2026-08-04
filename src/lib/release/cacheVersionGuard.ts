/**
 * 추천 캐시 버전을 **올리는 것을 잊지 못하게** 막는 관문 (순수 함수).
 *
 * ## 왜 필요한가
 *
 * 2026-08-04, 배포는 성공했는데 사용자 화면이 안 바뀌었다. `/api/health` 버전도,
 * 화면 HTTP 200 도, Production 데이터 실측도 전부 통과했는데 «구매하기» 가 안 떴다.
 *
 * 결과 화면은 `skinRankedProducts`(localStorage)에서 읽는다. 오퍼 부착 로직을 바꾸면
 * `RECOMMENDATION_CACHE_VERSION` 을 올려 옛 Top 5 를 폐기해야 하는데, **안 올렸다.**
 * 배포 전에 분석을 돌린 사용자는 옛 로직으로 계산된 결과를 계속 봤다.
 *
 * 코드 주석에는 «offer 부착 로직이 바뀌면 올려라» 라고 적혀 있었다. 주석은 사람이
 * 잊는다. **기계가 막아야 한다.**
 *
 * ## 어떻게 판정하는가
 *
 * 브랜치가 `main` 대비 바꾼 파일 목록을 받아, 감시 대상이 하나라도 바뀌었는데
 * 캐시 버전 상수가 안 바뀌었으면 막는다.
 *
 * 감시 범위는 **넓게** 잡는다. 헛detection 의 대가는 «버전 한 번 더 올리기»(사용자는
 * 한 번 재계산할 뿐)이고, 놓쳤을 때의 대가는 «배포해도 화면이 안 바뀜» 이다.
 * 비용이 비대칭이므로 넓은 쪽이 옳다.
 */

/**
 * 바뀌면 저장된 Top 5 의 내용이 달라지는 파일들.
 *
 * 랭킹·안전 필터·성분 정규화까지 넣는다 — 이것들이 바뀌면 «누가 Top 5 에 들어가는지»
 * 가 달라지고, 옛 캐시는 그만큼 틀린 값이 된다.
 */
export const CACHE_AFFECTING_PATHS: readonly string[] = [
  "src/lib/recommend/productOffer.ts",
  "src/lib/recommend/persistTopRankedProducts.ts",
  "src/lib/recommend/applyBrandDiversity.ts",
  "src/lib/recommend/selectPurchaseLink.ts",
  "src/lib/recommend/commerceStatus.ts",
  "src/lib/recommend/rankProducts.ts",
  "src/lib/recommend/filterCandidatesBySafety.ts",
  "src/lib/recommend/filterRankedByMatchEvidence.ts",
  "src/lib/recommend/normalizeIngredient.ts",
  "src/lib/recommend/ingredientAliases.ts",
  "src/lib/recommend/allergenMatch.ts",
  "src/lib/recommend/fetchCandidateProducts.ts",
  "src/lib/recommend/publicCatalogFilter.ts",
];

/** 캐시 버전 상수가 사는 곳 */
export const CACHE_VERSION_FILE = "src/lib/recommend/types.ts";

export type CacheVersionGuardResult =
  | { ok: true; reason: string }
  | { ok: false; changed: string[]; message: string };

/**
 * @param changedFiles  `git diff --name-only main...HEAD` 결과 (POSIX 경로)
 * @param cacheVersionChanged  캐시 버전 상수 자체가 바뀌었는가
 */
export function evaluateCacheVersionGuard(
  changedFiles: readonly string[],
  cacheVersionChanged: boolean
): CacheVersionGuardResult {
  const normalized = changedFiles.map((f) => f.replace(/\\/g, "/").trim()).filter(Boolean);
  const touched = CACHE_AFFECTING_PATHS.filter((p) => normalized.includes(p));

  if (touched.length === 0) {
    return { ok: true, reason: "캐시에 영향을 주는 파일이 바뀌지 않았다" };
  }
  if (cacheVersionChanged) {
    return { ok: true, reason: `캐시 영향 파일 ${touched.length}개가 바뀌었고 버전도 올렸다` };
  }
  return {
    ok: false,
    changed: touched,
    message:
      "추천 캐시에 영향을 주는 파일이 바뀌었는데 RECOMMENDATION_CACHE_VERSION 을 안 올렸다.\n" +
      "이대로 배포하면 **이미 분석을 돌린 사용자는 옛 결과를 계속 본다** — 배포해도 화면이 안 바뀐다.\n" +
      `고칠 곳: ${CACHE_VERSION_FILE} 의 RECOMMENDATION_CACHE_VERSION (끝의 _V숫자 를 올린다)\n` +
      `바뀐 파일:\n${touched.map((t) => `  · ${t}`).join("\n")}`,
  };
}

/**
 * 추천 캐시 버전 무효화 회귀 테스트.
 *
 * 2026-08-04 — 배포는 됐는데 «구매하기» 가 안 떴다. 코드는 맞았고, **결과 화면이
 * localStorage 의 옛 Top 5 를 계속 읽고 있었다.** 오퍼 부착 로직을 바꾸면서
 * `RECOMMENDATION_CACHE_VERSION` 을 안 올린 것이 원인이다.
 *
 * 배포해도 화면이 안 바뀌는 종류의 결함이라 눈으로는 «코드가 잘못됐나» 로 오해하기 쉽다.
 * 그래서 무효화가 실제로 동작하는지 테스트로 고정한다.
 *
 * 실행: npm run test:recommendation-cache-version
 */
import assert from "node:assert/strict";
import {
  RANKED_PRODUCTS_STORAGE_KEY,
  RECOMMENDATION_CACHE_VERSION,
  RECOMMENDATION_CACHE_VERSION_KEY,
} from "../src/lib/recommend/types";
import {
  discardStaleRankedProductsCache,
  isRecommendationCacheVersionCurrent,
  writeRecommendationCacheVersion,
} from "../src/lib/recommend/recommendationCache";

/** localStorage 흉내 — 브라우저 API 가 없는 곳에서 캐시 로직을 그대로 태운다. */
class MemoryStorage {
  private map = new Map<string, string>();
  getItem(k: string): string | null {
    return this.map.has(k) ? this.map.get(k)! : null;
  }
  setItem(k: string, v: string): void {
    this.map.set(k, String(v));
  }
  removeItem(k: string): void {
    this.map.delete(k);
  }
  get size(): number {
    return this.map.size;
  }
}

const storage = new MemoryStorage();
// 캐시 함수들은 `typeof window === "undefined"` 를 **호출 시점에** 보므로,
// 첫 호출 전에만 심어 두면 된다 (import 순서와 무관).
(globalThis as unknown as { window: unknown }).window = { localStorage: storage };

// ── 옛 버전 캐시는 폐기된다 (이번 사고의 재현) ──
{
  storage.setItem(RANKED_PRODUCTS_STORAGE_KEY, JSON.stringify([{ product: { id: "old" } }]));
  storage.setItem(RECOMMENDATION_CACHE_VERSION_KEY, "KR_SCENARIO_PILOT_PHASE25_COMMERCE_SEP_V1");

  assert.equal(isRecommendationCacheVersionCurrent(), false, "옛 버전은 현재가 아니다");
  assert.equal(discardStaleRankedProductsCache(), true, "폐기했다고 알려야 한다");
  assert.equal(
    storage.getItem(RANKED_PRODUCTS_STORAGE_KEY),
    null,
    "옛 Top 5 가 남아 있으면 배포해도 화면이 안 바뀐다"
  );
}

// ── 버전 키가 아예 없는 캐시도 폐기된다 ──
{
  storage.setItem(RANKED_PRODUCTS_STORAGE_KEY, JSON.stringify([{ product: { id: "no-version" } }]));
  storage.removeItem(RECOMMENDATION_CACHE_VERSION_KEY);

  assert.equal(discardStaleRankedProductsCache(), true);
  assert.equal(storage.getItem(RANKED_PRODUCTS_STORAGE_KEY), null);
}

// ── 현재 버전 캐시는 건드리지 않는다 (매번 재계산하면 느려진다) ──
{
  const payload = JSON.stringify([{ product: { id: "current" } }]);
  storage.setItem(RANKED_PRODUCTS_STORAGE_KEY, payload);
  writeRecommendationCacheVersion();

  assert.equal(isRecommendationCacheVersionCurrent(), true);
  assert.equal(discardStaleRankedProductsCache(), false, "현재 버전이면 폐기하지 않는다");
  assert.equal(storage.getItem(RANKED_PRODUCTS_STORAGE_KEY), payload, "멀쩡한 캐시를 지우면 안 된다");
}

// ── 이번 배포에서 실제로 버전이 올라갔는지 ──
{
  // 오퍼 부착 로직(국가 매칭·브랜드 상한)을 바꿨으므로 V1 이면 안 된다.
  assert.notEqual(
    RECOMMENDATION_CACHE_VERSION,
    "KR_SCENARIO_PILOT_PHASE25_COMMERCE_SEP_V1",
    "offer 부착 로직을 바꿨으면 캐시 버전을 올려야 한다 — 안 올리면 배포해도 화면이 안 바뀐다"
  );
  assert.ok(RECOMMENDATION_CACHE_VERSION.trim().length > 0);
}

console.log("recommendation-cache-version self-test: ok");

/**
 * 캐시 버전 관문 회귀 테스트.
 *
 * 이 관문이 헐거우면 2026-08-04 사고가 그대로 재발한다 — 배포는 되는데 사용자
 * 화면이 안 바뀐다. 반대로 너무 빡빡하면 무시당하고, 무시당하는 관문은 없는 것만 못하다.
 *
 * 실행: npm run test:cache-version-guard
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import {
  CACHE_AFFECTING_PATHS,
  CACHE_VERSION_FILE,
  evaluateCacheVersionGuard,
} from "../src/lib/release/cacheVersionGuard";

// ── 이번 사고 재현: offer 로직을 바꿨는데 버전을 안 올렸다 ──
{
  const r = evaluateCacheVersionGuard(
    ["src/lib/recommend/persistTopRankedProducts.ts", "src/app/results/page.tsx"],
    false
  );
  assert.equal(r.ok, false, "막아야 한다");
  if (!r.ok) {
    assert.ok(r.changed.includes("src/lib/recommend/persistTopRankedProducts.ts"));
    assert.match(r.message, /RECOMMENDATION_CACHE_VERSION/);
    // 무엇을 고쳐야 하는지 알려줘야 한다 — «실패했다» 만으로는 못 고친다.
    assert.ok(r.message.includes(CACHE_VERSION_FILE), "고칠 파일을 알려줘야 한다");
  }
}

// ── 버전을 같이 올렸으면 통과 ──
{
  const r = evaluateCacheVersionGuard(["src/lib/recommend/productOffer.ts"], true);
  assert.equal(r.ok, true);
}

// ── 무관한 파일만 바꿨으면 통과 ──
{
  const r = evaluateCacheVersionGuard(["README.md", "docs/x.md", "src/app/page.tsx"], false);
  assert.equal(r.ok, true);
}

// ── 감시 대상 전부가 실제로 잡히는지 ──
for (const p of CACHE_AFFECTING_PATHS) {
  const r = evaluateCacheVersionGuard([p], false);
  assert.equal(r.ok, false, `${p} 를 바꿨으면 막아야 한다`);
}

// ── 경로 구분자가 달라도 잡는다 (Windows) ──
{
  const r = evaluateCacheVersionGuard(["src\\lib\\recommend\\productOffer.ts"], false);
  assert.equal(r.ok, false, "역슬래시 경로도 같은 파일이다");
}

// ── 빈 목록 ──
assert.equal(evaluateCacheVersionGuard([], false).ok, true);

// ── 감시 목록이 실재하는 파일인지 (오타로 관문이 조용히 무력화되는 것을 막는다) ──
for (const p of [...CACHE_AFFECTING_PATHS, CACHE_VERSION_FILE]) {
  assert.ok(existsSync(p), `감시 목록의 «${p}» 가 실제로 없다 — 경로가 바뀌었거나 오타다`);
}

console.log("cache-version-guard self-test: ok");

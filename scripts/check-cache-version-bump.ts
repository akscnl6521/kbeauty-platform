/**
 * 추천 캐시 버전을 올렸는지 CI 에서 확인한다. 읽기 전용 (git 조회만).
 *
 * 2026-08-04 사고 재발 방지 — 자세한 배경은 `src/lib/release/cacheVersionGuard.ts`.
 *
 * 기준 브랜치를 못 찾으면 **통과시킨다.** CI 가 얕은 클론이거나 첫 커밋일 수 있는데,
 * 거기서 막으면 이 검사가 «가끔 이유 없이 실패하는 것» 이 되어 무시당한다.
 * 무시당하는 관문은 없는 것만 못하다.
 *
 * 실행: npm run check:cache-version-bump
 */
import { execFileSync } from "node:child_process";
import {
  CACHE_VERSION_FILE,
  evaluateCacheVersionGuard,
} from "../src/lib/release/cacheVersionGuard";

const BASE_CANDIDATES = ["origin/main", "main"];

function git(args: string[]): string | null {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

function resolveBase(): string | null {
  for (const ref of BASE_CANDIDATES) {
    if (git(["rev-parse", "--verify", "--quiet", ref])) return ref;
  }
  return null;
}

function main(): void {
  const base = resolveBase();
  if (!base) {
    console.log("[cache-version-bump] 기준 브랜치를 찾지 못해 건너뛴다 (얕은 클론일 수 있다).");
    return;
  }

  // `A...B` 는 공통 조상 기준이라, main 이 앞서 있어도 내 변경만 본다.
  const diff = git(["diff", "--name-only", `${base}...HEAD`]);
  if (diff == null) {
    console.log(`[cache-version-bump] ${base}...HEAD diff 를 못 구해 건너뛴다.`);
    return;
  }
  const changed = diff.split("\n").map((s) => s.trim()).filter(Boolean);

  // 상수 자체가 바뀌었는지는 **그 줄의 변경**으로 본다 — 같은 파일의 주석만 고친 것을
  // «올렸다» 로 세면 관문이 헐거워진다.
  const versionDiff = git(["diff", `${base}...HEAD`, "--", CACHE_VERSION_FILE]) ?? "";
  const cacheVersionChanged = versionDiff
    .split("\n")
    .some((line) => /^[+-]\s*(export\s+const\s+)?RECOMMENDATION_CACHE_VERSION\b/.test(line) ||
      (/^[+-]/.test(line) && /"KR_SCENARIO_PILOT[^"]*"/.test(line)));

  const result = evaluateCacheVersionGuard(changed, cacheVersionChanged);

  if (result.ok) {
    console.log(`[cache-version-bump] ok — ${result.reason}`);
    return;
  }

  console.error("\n[cache-version-bump] FAILED\n");
  console.error(result.message);
  console.error("");
  process.exitCode = 1;
}

main();

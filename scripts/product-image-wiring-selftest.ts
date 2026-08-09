/**
 * **제품 카드를 그리는 화면은 이미지도 함께 연결해야 한다.**
 *
 * ## 왜 검사가 필요한가
 *
 * 이미지는 랭킹 캐시에 없다 — 서명 URL 이라 만료되므로 화면을 열 때 받아 붙인다
 * (`useProductImages` → `withImage`). 그래서 **카드를 쓰는 화면마다 따로 연결**해야
 * 하고, 빠뜨려도 아무 오류가 나지 않는다. 그냥 사진이 안 뜰 뿐이다.
 *
 * 실제로 두 번 그랬다:
 *
 *   2026-08-04  `/results` 에 연결이 없어 이미지가 한 번도 뜨지 않았다
 *   2026-08-09  `/results` 만 고치고 `/analyze` 를 빠뜨렸다
 *
 * 두 번 다 «DB 에 이미지가 있다» 를 «화면에 뜬다» 로 착각해서 생겼다. 사람이
 * 기억할 일이 아니라 검사가 할 일이다.
 *
 * 실행: npx tsx scripts/product-image-wiring-selftest.ts
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const CARD = "RecommendedProductCard";
const ROOT = "src/app";

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith(".tsx")) out.push(full);
  }
  return out;
}

function main() {
  const screens = walk(ROOT).filter((f) => {
    const src = readFileSync(f, "utf8");
    // 컴포넌트 자신은 제외하고, **카드를 실제로 그리는** 화면만 본다.
    return src.includes(`<${CARD}`);
  });

  assert.ok(screens.length > 0, `${CARD} 를 그리는 화면을 하나도 못 찾았다 — 검사가 헛돌고 있다`);

  const missing: string[] = [];
  for (const f of screens) {
    const src = readFileSync(f, "utf8");
    const hasHook = src.includes("useProductImages");
    // `ranked={...}` 로 넘기는 자리마다 이미지를 붙였는지 — 한 군데만 붙이고
    // 다른 자리를 빠뜨리는 일이 실제로 있었다.
    const passes = [...src.matchAll(/ranked=\{([^}]*)\}/g)].map((m) => m[1].trim());
    const unwrapped = passes.filter((p) => !p.includes("withImage("));
    if (!hasHook || unwrapped.length > 0) {
      missing.push(
        `${f} — 훅 ${hasHook ? "있음" : "**없음**"} · 이미지를 안 붙인 자리 ${unwrapped.length}곳` +
          (unwrapped.length ? ` (${unwrapped.join(" / ")})` : "")
      );
    }
  }

  assert.deepEqual(
    missing,
    [],
    `제품 카드를 그리는데 이미지를 연결하지 않은 화면이 있다:\n  ${missing.join("\n  ")}\n` +
      `→ useProductImages(...) 로 받아 withImage(ranked) 로 넘겨야 한다.`
  );

  console.log(`product-image-wiring self-test: ok (화면 ${screens.length}곳 확인)`);
}

main();

/**
 * 수집 대상 제품의 **전성분 추출 원문을 그대로 덤프**한다.
 *
 * 왜 필요한가 — 검증기가 21건 중 18건을 반려했다. 반려 이유(HTML 엔티티·물음표·
 * 연도)만 보고 추출기를 고치면 추측이 된다. 실제로 어디서 잘렸고 무엇이 붙었는지
 * 원문을 봐야 경계 규칙을 정할 수 있다.
 *
 * 읽기 전용 — HTTP GET 만 한다. DB 를 건드리지 않는다.
 *
 * 실행: npx tsx scripts/dump-extracted-ingredient-raw.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const UA = "Mozilla/5.0 (compatible; kbeautymatch-catalog/1.0)";
const ARTIFACT = "artifacts/tier1-collect/shopify-2026-07-28.json";

type CollectResult = {
  productId: number;
  brand: string;
  name: string;
  purchaseUrl: string | null;
  price: number | null;
  inStock: boolean | null;
  ingredientCount: number;
};

async function main() {
  const { extractLabeledIngredientsRaw } = await import(
    "@/lib/catalog/enrichment/extractLabeledIngredients"
  );
  const artifact = JSON.parse(readFileSync(ARTIFACT, "utf8")) as { results: CollectResult[] };
  const targets = artifact.results.filter(
    (r) => r.purchaseUrl && r.price != null && r.price > 0 && r.inStock === true && r.ingredientCount > 0
  );

  const out: string[] = [];
  for (const t of targets) {
    let page = "";
    try {
      const r = await fetch(t.purchaseUrl!, { headers: { "User-Agent": UA } });
      page = r.ok ? await r.text() : "";
    } catch {
      page = "";
    }
    const raw = extractLabeledIngredientsRaw(page);
    out.push(
      "".padEnd(78, "="),
      `${t.productId} ${t.brand} — ${t.name}`,
      `label: ${raw?.label ?? "(없음)"}`,
      `길이: ${raw?.raw.length ?? 0}`,
      "",
      raw?.raw ?? "(추출 실패)",
      ""
    );
    console.log(`${t.productId} ${t.brand} — ${raw?.raw.length ?? 0}자`);
  }

  mkdirSync("artifacts/ingredient-extract", { recursive: true });
  const path = "artifacts/ingredient-extract/raw-dump.txt";
  writeFileSync(path, out.join("\n"), "utf8");
  console.log(`\n덤프: ${path}`);
}

main().catch((e) => {
  console.error("[dump-extracted-ingredient-raw] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

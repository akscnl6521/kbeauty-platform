/**
 * 시나리오별 «추천 준비된 제품이 있는가» 를 잰다. **읽기만 한다.**
 *
 * ## 왜 고쳤나 (2026-08-09)
 *
 * 이 스크립트는 `data/backups/2026-07-14-catalog` 를 **경로째 박아 두고** 읽었다.
 * 그래서 그날 이후로 무엇을 하든 숫자가 안 움직였다 — 추천 풀이 36 → 106건이
 * 됐는데도 «추천 준비된 시나리오 0개» 라고 답했다. 활성 과제(WQ-F)의 진행도
 * 계기판이 한 달 전을 가리키고 있었던 것이다.
 *
 * 두 가지를 고쳤다:
 *
 *   1. 백업 모드는 **가장 최근 백업**을 고른다 (경로를 박아 두지 않는다)
 *   2. `--target-production` 을 주면 **Production 을 직접 읽는다** (SELECT 뿐)
 *
 * 어느 쪽을 봤는지 **첫 줄에 찍는다.** 이걸 안 찍어서 여러 판을 헛돌았다.
 *
 * 실행: npx --yes tsx scripts/analyze-scenario-catalog-gap.ts
 *       npm run analyze:scenario-catalog-gap -- --target-production
 */
import fs from "node:fs";
import path from "node:path";
import {
  analyzeScenarioCatalogGaps,
  type BackupProductRow,
} from "../src/lib/recommend/scenarios/gapAnalysis";

const ROOT = path.resolve(__dirname, "..");
const BACKUPS_ROOT = path.join(ROOT, "data", "backups");
const EXPECTED_PROD_REF = "rhfrmvkjsummaylpzmns";

/** `products.json` 이 들어 있는 백업 폴더 중 **이름이 가장 나중인** 것. */
function latestBackupDir(): string | null {
  if (!fs.existsSync(BACKUPS_ROOT)) return null;
  const dirs = fs
    .readdirSync(BACKUPS_ROOT)
    .map((d) => path.join(BACKUPS_ROOT, d))
    .filter((d) => fs.statSync(d).isDirectory() && fs.existsSync(path.join(d, "products.json")))
    .sort();
  return dirs.length ? dirs[dirs.length - 1] : null;
}

type BackupTableFile<T> = {
  rows?: T[];
};

function readJson<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function buildOfferCounts(
  offers: Array<{ product_id?: number | string; active?: boolean | null }>
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const offer of offers) {
    if (offer.active === false) continue;
    const key = String(offer.product_id ?? "");
    if (!key) continue;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

async function loadFromProduction(): Promise<{
  products: BackupProductRow[];
  offers: Array<{ product_id?: number | string; active?: boolean | null }>;
  imageReadyProductIds: ReadonlySet<string>;
}> {
  const { loadDotEnvLocal } = await import("./_loadDotEnvLocal");
  loadDotEnvLocal();
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.PRODUCTION_SUPABASE_URL ?? "";
  const key = process.env.PRODUCTION_SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) throw new Error("PRODUCTION_SUPABASE_SERVICE_ROLE_KEY 없음");
  const ref = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? "";
  if (ref !== EXPECTED_PROD_REF) throw new Error(`ABORT_NOT_PRODUCTION:${ref}`);
  const client = createClient(url, key, { auth: { persistSession: false } });

  // PostgREST 는 1000행에서 자른다.
  const page = async <T>(table: string, select: string): Promise<T[]> => {
    const out: T[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await client.from(table).select(select).order("id").range(offset, offset + 999);
      if (error) throw new Error(`${table}: ${error.code} ${error.message}`);
      const rows = (data ?? []) as T[];
      out.push(...rows);
      if (rows.length < 1000) break;
    }
    return out;
  };

  // 이미지는 `products` 가 아니라 `catalog_product_media` 에 있다.
  // 화면에 실제로 나가는 조건(`validation_status = "verified"`)과 같게 본다.
  const media = await page<{ product_id: string | number | null; validation_status: string | null }>(
    "catalog_product_media",
    "id,product_id,validation_status"
  );
  const imageReadyProductIds = new Set(
    media.filter((m) => m.validation_status === "verified").map((m) => String(m.product_id))
  );

  return {
    imageReadyProductIds,
    products: await page<BackupProductRow>(
      "products",
      "id,active,brand,category,verified_at,full_ingredients,key_ingredients,skin_concern,usage_area,name"
    ),
    offers: await page<{ product_id?: number | string; active?: boolean | null }>(
      "product_offers",
      "id,product_id,active"
    ),
  };
}

async function main(): Promise<void> {
  const toProduction = process.argv.includes("--target-production");

  let productRows: BackupProductRow[];
  let offerRows: Array<{ product_id?: number | string; active?: boolean | null }>;
  // 백업 모드에서는 이미지를 알 수 없다 — 예전과 똑같이 «모른다» 로 둔다.
  let imageReadyProductIds: ReadonlySet<string> | undefined;

  if (toProduction) {
    console.log(`대상: **Production** (${EXPECTED_PROD_REF}) — 읽기만 한다
`);
    const loaded = await loadFromProduction();
    productRows = loaded.products;
    offerRows = loaded.offers;
    imageReadyProductIds = loaded.imageReadyProductIds;
  } else {
    const dir = latestBackupDir();
    if (!dir) throw new Error(`백업을 못 찾았다: ${BACKUPS_ROOT}`);
    console.log(`대상: 백업 ${path.basename(dir)}  (Production 을 보려면 --target-production)
`);
    const productsFile = readJson<BackupTableFile<BackupProductRow>>(path.join(dir, "products.json"));
    if (!productsFile?.rows?.length) throw new Error(`제품 행이 없다: ${dir}`);
    const offersFile = readJson<BackupTableFile<{ product_id?: number | string; active?: boolean | null }>>(
      path.join(dir, "product-offers.json")
    );
    productRows = productsFile.rows;
    offerRows = offersFile?.rows ?? [];
  }

  const productsFile = { rows: productRows };
  const offersFile = { rows: offerRows };
  const offerCounts = buildOfferCounts(offerRows);

  const gaps = analyzeScenarioCatalogGaps(productsFile.rows, offerCounts, { imageReadyProductIds });

  const summary = {
    productCount: productsFile.rows.length,
    offerRows: offersFile?.rows?.length ?? 0,
    scenarioCount: gaps.length,
    scenariosWithReadyProducts: gaps.filter((g) => g.recommendationReadyCount > 0)
      .length,
    gaps,
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error("[analyze-scenario-catalog-gap] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

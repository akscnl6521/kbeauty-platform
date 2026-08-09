/**
 * **국내 공식몰에서 파는 제품을 그대로 등록한다.** 국내용 카탈로그를 먼저 세우는 경로다.
 *
 * ## 방향을 바꾼 이유
 *
 * 지금까지는 «우리 DB 제품 → 국내 오퍼 찾기» 였다. 그러면 DB 에 있는 제품이
 * 국내몰에 없으면 아무것도 못 한다. 실제로 추천 풀 26건 중 국내 구매 가능은 14건에
 * 머물렀고, 늘어난 12건은 전부 미국 오퍼뿐이라 **국내 사용자에게는 안 보였다.**
 *
 * 반대로 간다 — **국내몰에 실제로 파는 것부터 등록한다.** 국내몰 하나에서
 * 필요한 것이 전부 나온다:
 *
 *   제품명(한글) · 전성분 · 가격(원) · 재고 · 공식 이미지 · 구매 링크
 *
 * ## 지어내지 않는다
 *
 *   · 전성분이 없거나 검증을 통과 못 하면 **등록하지 않는다.** 성분 없는 제품은
 *     안전 필터가 판단할 근거가 없다.
 *   · 재고가 `InStock` 이 아니면 등록하지 않는다 — 살 수 없는 것을 권하지 않는다.
 *   · 이미 있는 제품과 이름이 겹치면 **새로 만들지 않는다**(중복 등록 방지).
 *   · 브랜드명은 몰의 한글 표기 대신 **우리 카탈로그의 영문 표기**를 쓴다.
 *     브랜드명은 임의로 바꾸거나 번역하지 않는 값이다(§35.3).
 *
 * ## 활성화는 게이트가 정한다
 *
 * 여기서는 제품·오퍼·이미지·성분링크만 만든다. `active`/`verified_at` 은
 * `verifyAndActivateProduct` 가 판단한다 — 게이트를 우회하지 않는다.
 *
 * 실행: npm run register:kr-products -- --apply
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  bundleSetReason,
  conditionalSaleReason,
  nonFaceSkincareReason,
  packagingNeutralKey,
} from "../src/lib/catalog/mallRegistrationFilters";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";
import { decodeHtmlBody } from "../src/lib/catalog/decodeHtmlBody";
import { sanitizeIngredientList } from "../src/lib/catalog/validateIngredientList";
import { KR_MALLS } from "../src/lib/catalog/krMalls";
import { koreanProductNameToComparable } from "../src/lib/catalog/koreanProductTerms";
import { nameSimilarity, nameTokens } from "../src/lib/catalog/brandGlobalStores";

loadDotEnvLocal();

const EXPECTED_PROD_REF = "rhfrmvkjsummaylpzmns";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
const SNAPSHOT = "artifacts/kr-malls/snapshot.json";
/** 이 이상 닮았으면 이미 있는 제품으로 본다 — 중복 등록보다 빠뜨리는 편이 낫다. */
/**
 * DB 에 이미 있는 제품인지 판정하는 이름 유사도 기준.
 *
 * **0.7 이었는데 너무 낮았다.** 한 브랜드 라인은 이름 대부분을 공유해서
 * (달바는 거의 전부 «화이트 트러플 …») 서로 다른 제품이 0.75~0.86 으로 붙는다.
 * 2026-08-09 실측에서 **176건이 «이미 있는 제품» 으로 조용히 버려졌는데**,
 * 그중 유사도 1.00 인 진짜 중복은 132건뿐이었다. 나머지 44건은 다른 제품이다:
 *
 *   `딥 클린 폼 클렌저`            ↔ `리턴 오일 크림 클렌저 160ml`   0.75
 *   `갈락토미세스 95 톤 밸런싱 에센스` ↔ `갈락토미세스 95 화이트닝 파워 에센스` 0.75
 *   `너리싱 트리트먼트 마스크`        ↔ `슬리핑 마스크`                0.75
 *
 * 이름이 «거의 같을 때만» 같은 제품으로 본다. 포장·수량만 다른 경우는
 * `packagingNeutralKey` 가 따로 잡으므로 유사도를 낮게 둘 이유가 없다.
 */
const DUPLICATE_MIN = 0.95;

type SnapItem = { name: string; url: string; price: number; currency: string; inStock: boolean; imageUrl: string | null };
type DbProduct = { id: number; brand: string | null; name: string | null; name_ko: string | null };

/** 제품명에서 카테고리를 읽는다. 못 읽으면 null — 억지로 채우지 않는다. */
function categoryFromKoreanName(name: string): string | null {
  const n = name.toLowerCase();
  const table: ReadonlyArray<readonly [RegExp, string]> = [
    [/클렌징\s*오일|클렌징오일/, "cleansing_oil"],
    [/클렌저|클렌징\s*폼|폼\s*클렌저/, "cleanser"],
    [/선\s*크림|선크림|선스틱|자외선/, "sunscreen"],
    [/토너\s*패드|패드/, "toner_pad"],
    [/토너|스킨/, "toner"],
    [/에센스/, "essence"],
    [/앰플/, "ampoule"],
    [/세럼/, "serum"],
    [/아이\s*크림/, "eye_cream"],
    [/크림/, "cream"],
    [/로션|에멀전|에멀젼/, "lotion"],
    [/마스크|시트/, "mask"],
    [/미스트/, "mist"],
    [/오일/, "facial_oil"],
    [/밤/, "balm"],
  ];
  for (const [re, cat] of table) if (re.test(n)) return cat;
  return null;
}

async function get(url: string): Promise<string> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20000);
    const r = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "ko-KR,ko;q=0.9" },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    return r.ok ? await decodeHtmlBody(r) : "";
  } catch {
    return "";
  }
}

async function fetchAll<T>(client: SupabaseClient, table: string, select: string): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.from(table).select(select).order("id").range(offset, offset + 999);
    if (error) throw new Error(`${table}: ${error.code} ${error.message}`);
    const page = (data ?? []) as T[];
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}

function slugify(brand: string, name: string): string {
  const base = `${brand} ${name}`
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base.slice(0, 80) || `kr-${Date.now()}`;
}






async function main() {
  const apply = process.argv.includes("--apply");
  const url = process.env.PRODUCTION_SUPABASE_URL ?? "";
  const key = process.env.PRODUCTION_SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) {
    console.log("PRODUCTION_SUPABASE_SERVICE_ROLE_KEY 없음 — 중단.");
    process.exitCode = 2;
    return;
  }
  if ((url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? "") !== EXPECTED_PROD_REF) {
    console.error("ABORT: ref 불일치.");
    process.exitCode = 1;
    return;
  }

  const { extractLabeledIngredientsRaw } = await import(
    "@/lib/catalog/enrichment/extractLabeledIngredients"
  );
  const { deriveKeyIngredientsFromFullList } = await import("@/lib/catalog/keyIngredients");
  const client = createClient(url, key, { auth: { persistSession: false } });

  const snap = JSON.parse(readFileSync(SNAPSHOT, "utf8")) as { malls: Record<string, SnapItem[]> };
  const existing = await fetchAll<DbProduct>(client, "products", "id,brand,name,name_ko");

  type Candidate = {
    brand: string;
    mallName: string;
    url: string;
    price: number;
    imageUrl: string | null;
    ingredients: string[];
    keyIngredients: string[];
    category: string | null;
  };
  const candidates: Candidate[] = [];
  const skipped: Array<{ name: string; why: string }> = [];

  for (const mall of KR_MALLS) {
    // 같은 상품이 카테고리마다 다른 URL 로 노출된다 — **상품명으로 먼저 중복을 없앤다.**
    // 안 그러면 같은 제품을 여러 번 등록하고, 페이지도 그만큼 헛되이 받는다.
    const seenName = new Set<string>();
    const items = (snap.malls[mall.domain] ?? [])
      .filter((i) => i.inStock && i.currency === "KRW")
      .filter((i) => {
        const k = i.name.replace(/\s+/g, " ").trim().toLowerCase();
        if (seenName.has(k)) return false;
        seenName.add(k);
        return true;
      });
    if (items.length === 0) continue;
    const pickedPackKeys = new Set<string>();
    // 우리 카탈로그의 영문 표기를 쓴다 — 브랜드명은 번역하지 않는다.
    const brand = mall.brands[0];
    const mine = existing.filter((p) => mall.brands.includes(String(p.brand ?? "")));
    console.log(`\n=== ${brand} (${mall.domain}) — 몰 재고 ${items.length}건 · DB 보유 ${mine.length}건 ===`);

    for (const it of items) {
      // 이미 있는 제품인가 — 한글 몰 이름을 비교용으로 바꿔 대조한다.
      const cmp = koreanProductNameToComparable(it.name);
      // 같은 몰 안에서도 같은 제품이 두 번 올라온다 —
      // `… 2BOX` 와 `… 2BOX (총 8개)`, `퍼스널 케어 마스크` 와 `… 10개 SET`.
      //
      // **이름 유사도로 묶으면 안 된다.** 한 브랜드 라인은 이름 대부분을 공유해서
      // (달바는 거의 전부 «화이트 트러플 …») 서로 다른 제품이 통째로 묶인다.
      // 실제로 유사도 방식은 폼 클렌저·젤 클렌저·오일 클렌저를 하나로 봤다.
      //
      // 그래서 **포장·수량 표기만 지우고 나머지가 글자까지 같을 때만** 중복으로 본다.
      // 용량(ml·g)은 지우지 않는다 — 100ml 와 150ml 는 값이 다른 별개 상품이다.
      const packKey = packagingNeutralKey(it.name);
      if (pickedPackKeys.has(packKey)) {
        skipped.push({ name: it.name, why: "같은 몰 안 중복(포장·수량만 다름)" });
        continue;
      }

      // 포장·수량 표기만 다른 같은 제품 — 유사도와 별개로 잡는다.
      const packKeyForDb = packagingNeutralKey(it.name);
      const samePackaging = mine.some(
        (p) =>
          packagingNeutralKey(String(p.name_ko ?? "")) === packKeyForDb ||
          packagingNeutralKey(String(p.name ?? "")) === packKeyForDb
      );
      const dupe = samePackaging || mine.some((p) => {
        const a = nameSimilarity(nameTokens(cmp, brand), nameTokens(String(p.name ?? ""), brand));
        const b = nameSimilarity(nameTokens(it.name, brand), nameTokens(String(p.name_ko ?? ""), brand));
        return Math.max(a, b) >= DUPLICATE_MIN;
      });
      if (dupe) {
        // **중복 판정도 기록한다.** 아무 말 없이 버리면, 유사도가 잘못 묶어
        // 멀쩡한 제품을 떨어뜨려도 알 수가 없다. 2026-08-09 에 COSRX 토너
        // 미스트가 후보에도 안 올라와 있었는데 왜인지 알아낼 방법이 없었다.
        const near = mine
          .map((p) => ({
            name: String(p.name_ko ?? p.name ?? ""),
            sim: Math.max(
              nameSimilarity(nameTokens(cmp, brand), nameTokens(String(p.name ?? ""), brand)),
              nameSimilarity(nameTokens(it.name, brand), nameTokens(String(p.name_ko ?? ""), brand))
            ),
          }))
          .sort((a, b) => b.sim - a.sim)[0];
        skipped.push({
          name: it.name,
          why: `이미 있는 제품으로 봄 — «${near?.name.slice(0, 30)}» 유사도 ${near?.sim.toFixed(2)}`,
        });
        continue;
      }

      // 세트는 전성분이 «여러 제품의 합» 이라 한 제품으로 등록하면 안전 판정이 틀어진다.
      const bundle = bundleSetReason(it.name);
      if (bundle) {
        skipped.push({ name: it.name, why: `세트 상품(전성분이 합쳐져 있다) — «${bundle}»` });
        continue;
      }

      const nonFace = nonFaceSkincareReason(it.name);
      if (nonFace) {
        skipped.push({ name: it.name, why: `얼굴 스킨케어가 아님 — «${nonFace}»` });
        continue;
      }

      const conditional = conditionalSaleReason(it.name);
      if (conditional) {
        skipped.push({ name: it.name, why: `조건부 판매·단종 — «${conditional}»` });
        continue;
      }

      const html = await get(it.url);
      const raw = html ? extractLabeledIngredientsRaw(html) : null;
      const v = raw ? sanitizeIngredientList(raw.raw) : null;
      await new Promise((r) => setTimeout(r, 700));

      if (!v || !v.ok) {
        skipped.push({ name: it.name, why: raw ? `전성분 반려 — ${v && !v.ok ? v.reason : "?"}` : "전성분 없음" });
        continue;
      }
      const keyHits = deriveKeyIngredientsFromFullList(v.tokens);
      const keyIngredients = keyHits.map((h) => h.tokenFromList);
      if (keyIngredients.length === 0) {
        // 주요 성분이 없으면 안전 필터가 추천 자격 자체를 못 준다(incomplete_info).
        skipped.push({ name: it.name, why: "주요 성분을 뽑지 못함" });
        continue;
      }

      pickedPackKeys.add(packKey);
      candidates.push({
        brand,
        mallName: it.name,
        url: it.url.replace(/^http:/, "https:"),
        price: it.price,
        imageUrl: it.imageUrl,
        ingredients: v.tokens,
        keyIngredients,
        category: categoryFromKoreanName(it.name),
      });
      console.log(
        `  + ${it.name.slice(0, 34).padEnd(36)} ${String(it.price).padStart(7)}원 · 성분 ${String(v.tokens.length).padStart(3)} · ` +
          `주요 ${keyIngredients.length} · ${it.imageUrl ? "이미지 O" : "이미지 X"} · ${categoryFromKoreanName(it.name) ?? "카테고리?"}`
      );
    }
  }

  console.log(`\n등록 후보 ${candidates.length}건 · 건너뜀 ${skipped.length}건`);
  const byWhy = new Map<string, number>();
  for (const s of skipped) byWhy.set(s.why.split(" —")[0], (byWhy.get(s.why.split(" —")[0]) ?? 0) + 1);
  for (const [w, n] of [...byWhy.entries()].sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(3)}건  ${w}`);

  mkdirSync("artifacts/kr-register", { recursive: true });
  writeFileSync(
    "artifacts/kr-register/candidates.json",
    JSON.stringify({ builtAt: new Date().toISOString(), candidates, skipped }, null, 2),
    "utf8"
  );
  console.log(`\n결과 저장: artifacts/kr-register/candidates.json`);

  if (!apply) {
    console.log("\ndry-run. --apply 로 등록한다.");
    return;
  }
  if (candidates.length === 0) return;

  const nowIso = new Date().toISOString();
  let created = 0;
  for (const c of candidates) {
    // 1) 제품 — 활성화는 게이트가 정하므로 여기서는 비활성으로 만든다.
    const { data: prod, error: pErr } = await client
      .from("products")
      .insert({
        brand: c.brand,
        name: c.mallName,
        name_ko: c.mallName,
        category: c.category,
        slug: slugify(c.brand, c.mallName),
        full_ingredients: c.ingredients,
        key_ingredients: c.keyIngredients,
        active: false,
        verified_at: null,
        data_confidence: "kr_official_mall",
      })
      .select("id")
      .single();
    if (pErr || prod?.id == null) {
      console.log(`  «${c.mallName.slice(0, 28)}» 제품 실패: ${pErr?.code} ${pErr?.message.slice(0, 60)}`);
      continue;
    }
    const productId = Number(prod.id);

    // 2) 국내 오퍼
    const { error: oErr } = await client.from("product_offers").insert({
      product_id: productId,
      retailer_name: `${c.brand} 공식몰`,
      retailer_country: "KR",
      ships_to_countries: ["KR"],
      purchase_url: c.url,
      price: c.price,
      currency: "KRW",
      stock_status: "in_stock",
      verification_status: "verified",
      is_official: true,
      verified_at: nowIso,
      last_checked_at: nowIso,
      source: "brand_official_kr_mall",
      active: true,
    });
    if (oErr) console.log(`  ${productId} 오퍼 실패: ${oErr.message.slice(0, 60)}`);

    // 3) 이미지
    if (c.imageUrl) {
      const { error: mErr } = await client.from("catalog_product_media").insert({
        product_id: productId,
        media_type: "product_front",
        image_url: c.imageUrl,
        canonical_image_url: c.imageUrl,
        source_page_url: c.url,
        source_domain: new URL(c.url).hostname,
        source_type: "official_brand",
        source_tier: 1,
        is_official_source: true,
        usage_rights_status: "licensed_copy_allowed",
        is_accessible: true,
        is_primary: true,
        display_order: 0,
        validation_status: "verified",
        validation_errors: [],
        verified_at: nowIso,
      });
      if (mErr) console.log(`  ${productId} 이미지 실패: ${mErr.message.slice(0, 60)}`);
    }

    created += 1;
    console.log(`  ${String(productId).padStart(4)} 등록 «${c.mallName.slice(0, 34)}»`);
  }
  console.log(`\n제품 ${created}건 등록. 활성화는 npm run apply:activate-ready 로 게이트에 태운다.`);
}

main().catch((e) => {
  console.error("[register-kr-mall-products] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

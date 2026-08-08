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
const DUPLICATE_MIN = 0.7;

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

/**
 * **조건부 가격·단종 버전은 등록하지 않는다.**
 *
 * 국내몰은 같은 제품을 여러 «판매 조건» 으로 나란히 올린다. 2026-08-08 달바
 * 수집에서 나온 실제 사례:
 *
 *   `[주주우대] 화이트 트러플 … 세럼 로션 100ml`   9,900원   ← 주주만 살 수 있는 값
 *   `[홈트라이 전용] 화이트 트러플 더블 세럼 앤 크림`         ← 특정 행사 참가자 전용
 *   `비타 토닝 캡슐 크림 (튜브형) - 리뉴얼 전버전`           ← 단종된 옛 버전
 *
 * 이 값들은 **거짓이 아니지만 조건부**다. 그대로 화면에 올리면 「9,900원」 을 보고
 * 들어간 사람이 살 수 없는 값을 만난다. 우리가 지어낸 가격이 아니라도 결과는
 * 같으므로 넣지 않는다.
 *
 * 판정은 **이름에 드러난 것만** 본다. 조건을 추측하지 않는다 — 이름에 표시가
 * 없으면 정상 판매로 본다.
 */
const CONDITIONAL_SALE_MARKERS = [
  /주주\s*우대/,
  /\[\s*미운영[^\]]*\]/,
  /임직원/,
  /홈\s*트라이/,
  /체험\s*단/,
  /리뉴얼\s*전\s*버전/,
  /구\s*버전/,
  /단종/,
  /샘플/,
  /비매품/,
  /증정\s*용/,
];

function conditionalSaleReason(name: string): string | null {
  for (const re of CONDITIONAL_SALE_MARKERS) {
    const m = name.match(re);
    if (m) return m[0].replace(/\s+/g, "");
  }
  return null;
}


/**
 * **얼굴 스킨케어가 아닌 제품은 등록하지 않는다.**
 *
 * 브랜드 자사몰을 통째로 훑으면 메이크업·헤어·바디가 같이 딸려 온다. 문제는
 * 유형 추정이 이름의 «세럼» · «크림» 같은 낱말을 보기 때문에 **엉뚱한 유형으로
 * 들어온다**는 것이다. 2026-08-08 달바 수집 실측:
 *
 *   `스킨 핏 커버 세럼 비비 크림`        → toner   ← BB 크림이 토너로
 *   `글로우 핏 세럼 커버 쿠션 (미니)`      → serum   ← 쿠션이 세럼으로
 *   `프로페셔널 리페어링 헤어 퍼퓸 세럼`     → serum   ← 헤어 제품이 세럼으로
 *   `화이트 트러플 세럼 바디 크림`         → serum   ← 바디 크림이 세럼으로
 *
 * `isOutsideFaceTrack` 은 **카테고리**로 거르므로 이건 못 잡는다. 카테고리가
 * 이미 틀렸기 때문이다. 그래서 들어오는 자리에서 **이름으로** 막는다.
 *
 * 카테고리를 고치는 것과는 다른 문제다 — 여기서 막는 것은 «얼굴 스킨케어가
 * 아닌 것» 이고, 얼굴 제품의 유형이 틀린 것은 별개로 다룬다.
 */
const NON_FACE_SKINCARE_MARKERS = [
  // 메이크업
  /메이크업/,
  /쿠션/,
  /비비\s*크림|비비크림|BB/i,
  /씨씨\s*크림|씨씨크림|CC\s*크림/i,
  /파운데이션/,
  /틴티드/,
  /컨실러/,
  /픽서/,
  /파우더\s*팩트|팩트/,
  /아이섀도|마스카라|아이라이너|아이브로우/,
  /립\s*스틱|립스틱|립\s*틴트|립틴트|립\s*밤|립밤/,
  // 헤어·향수
  /헤어/,
  /샴푸/,
  /린스/,
  /퍼퓸|향수/,
  // 바디·핸드·풋
  /바디/,
  /핸드\s*크림|핸드크림/,
  /풋\s*크림|풋크림/,
];

function nonFaceSkincareReason(name: string): string | null {
  for (const re of NON_FACE_SKINCARE_MARKERS) {
    const m = name.match(re);
    if (m) return m[0].replace(/\s+/g, "");
  }
  return null;
}


/** 포장·수량 표기를 지운 비교용 키. 용량(ml·g)은 남긴다. */
function packagingNeutralKey(name: string): string {
  return name
    .replace(/\d+\s*BOX/gi, " ")
    .replace(/총\s*\d+\s*개/g, " ")
    .replace(/\d+\s*개\s*(SET|세트)/gi, " ")
    .replace(/\d+\s*회분/g, " ")
    .replace(/\(\s*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
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

      const dupe = mine.some((p) => {
        const a = nameSimilarity(nameTokens(cmp, brand), nameTokens(String(p.name ?? ""), brand));
        const b = nameSimilarity(nameTokens(it.name, brand), nameTokens(String(p.name_ko ?? ""), brand));
        return Math.max(a, b) >= DUPLICATE_MIN;
      });
      if (dupe) continue;

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

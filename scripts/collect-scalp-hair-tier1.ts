/**
 * 단계 5.5/6.5 — 두피·헤어 카테고리 1순위(브랜드 직판몰) 실수집.
 *
 * docs/product-sourcing-policy.md 1순위. 브랜드 공식 제품 페이지에서만
 * 가져오고, 오픈 DB·OCR 은 쓰지 않는다. 기존 파이프라인 함수만 호출하며
 * 품질 게이트·점수 공식은 건드리지 않는다 (PROJECT_RULE §5-6).
 *
 * Staging 전용. Production ref 면 즉시 중단한다.
 *
 * 실행:
 *   node --import ./scripts/register-server-only.mjs --import tsx/esm \
 *     scripts/collect-scalp-hair-tier1.ts
 */
import { createClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const STAGING_REF = "jfnjufmldiqlgvgyugfd";
const PROD_REF = "rhfrmvkjsummaylpzmns";

/** 두피·헤어로 인정할 이름 (얼굴 오탐 제외) */
const HAIR_RE = /샴푸|컨디셔너|트리트먼트|두피|헤어|shampoo|conditioner|scalp|hair|필업|토닉/i;
const FACE_FALSE_POSITIVE_RE = /립|lip|시카페어|유스 인핸싱/i;

/**
 * 제품명에서만 카테고리를 유추한다. 확신이 없으면 null 을 돌려 비워 둔다.
 * 여기서 나온 값은 beautyDomainForCategory 의 별칭 계층이 도메인으로 흡수한다.
 */
function categoryFromName(name: string): string | null {
  const n = name.toLowerCase();
  if (/두피\s*토닉|scalp\s*tonic|헤어\s*토닉/.test(n)) return "scalp_tonic";
  if (/스케일러|scaler/.test(n)) return "scalp_scaler";
  if (/샴푸|shampoo/.test(n)) return "shampoo";
  if (/컨디셔너|conditioner|린스/.test(n)) return "conditioner";
  if (/트리트먼트|treatment|헤어팩|hair\s*pack/.test(n)) return "hair_treatment";
  if (/헤어\s*오일|hair\s*oil/.test(n)) return "hair_oil";
  if (/헤어\s*에센스|hair\s*essence|헤어\s*세럼/.test(n)) return "hair_essence";
  if (/헤어\s*젤|hair\s*gel|왁스|wax|스프레이|spray/.test(n)) return "hair_styling";
  return null;
}

const robotsCache = new Map<string, boolean>();
async function robotsAllows(origin: string): Promise<boolean> {
  if (robotsCache.has(origin)) return robotsCache.get(origin)!;
  try {
    const res = await fetch(`${origin}/robots.txt`, { redirect: "follow" });
    if (!res.ok) {
      robotsCache.set(origin, true);
      return true;
    }
    const text = await res.text();
    let relevant = false;
    let disallowAll = false;
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim().toLowerCase();
      if (line.startsWith("user-agent:")) relevant = line.includes("*");
      if (relevant && line === "disallow: /") disallowAll = true;
    }
    robotsCache.set(origin, !disallowAll);
    return !disallowAll;
  } catch {
    robotsCache.set(origin, false);
    return false;
  }
}

async function main() {
  const { extractOfficialProductFromUrl } = await import(
    "../src/lib/catalog/officialCrawl"
  );
  const { discoverAndPersistOffers } = await import(
    "../src/lib/pipeline/offers/offer-persist"
  );
  const { linkProductIngredients } = await import(
    "../src/lib/pipeline/ingredient-link"
  );
  const { parseIngredientList } = await import(
    "../src/lib/pipeline/ingredient-normalize"
  );
  const { verifyAndActivateProduct } = await import(
    "../src/lib/pipeline/product-verify/product-activate"
  );

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const ref = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? "";
  if (ref === PROD_REF) throw new Error("ABORT_PRODUCTION");
  if (ref !== STAGING_REF) throw new Error(`ABORT_NOT_STAGING:${ref}`);

  const client = createClient(url, key, { auth: { persistSession: false } });
  const batchId = `scalp-hair-tier1-${new Date().toISOString().slice(0, 10)}`;

  const { data: rows, error } = await client
    .from("product_discovery_candidates")
    .select(
      "id, discovered_name, discovered_brand, discovered_url, workflow_status, linked_product_id"
    )
    .neq("workflow_status", "rejected")
    .limit(3000);
  if (error) throw error;

  const targets = (rows ?? []).filter(
    (r) =>
      r.discovered_url &&
      HAIR_RE.test(r.discovered_name ?? "") &&
      !FACE_FALSE_POSITIVE_RE.test(r.discovered_name ?? "")
  );

  const results: Array<Record<string, unknown>> = [];

  for (const cand of targets) {
    const out: Record<string, unknown> = {
      candidateId: String(cand.id).slice(0, 8),
      brand: cand.discovered_brand,
      name: cand.discovered_name,
    };

    let origin: string;
    try {
      origin = new URL(cand.discovered_url as string).origin;
    } catch {
      out.skipped = "bad_url";
      results.push(out);
      continue;
    }
    if (!(await robotsAllows(origin))) {
      out.skipped = "robots_disallow";
      results.push(out);
      continue;
    }

    // 1순위: 브랜드 공식 페이지에서 직접 추출
    const extracted = await extractOfficialProductFromUrl(
      cand.discovered_url as string
    );
    if (!extracted.ok) {
      out.skipped = "extract_failed";
      out.code = extracted.code ?? extracted.httpStatus;
      results.push(out);
      continue;
    }
    out.ingredientsFound = extracted.ingredients.length;
    out.priceFound = extracted.price != null;
    out.imageFound = Boolean(extracted.imageUrl);
    if (extracted.hasMojibake) out.mojibake = true;

    // 기존 제품이 연결돼 있으면 그것을 쓰고, 없으면 draft 를 만든다.
    let productId = cand.linked_product_id as number | null;
    if (!productId) {
      const slugBase = `${cand.discovered_brand ?? "brand"}-${extracted.productName ?? cand.discovered_name}`
        .toLowerCase()
        .replace(/<br\s*\/?>/g, " ")
        .replace(/[^a-z0-9가-힣]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);

      const { data: created, error: insErr } = await client
        .from("products")
        .insert({
          name: extracted.productName ?? cand.discovered_name,
          brand: extracted.brandName ?? cand.discovered_brand,
          slug: `${slugBase}-${String(cand.id).slice(0, 4)}`,
          // 추출된 카테고리가 없으면 제품명에서만 유추하고, 그래도 모르면
          // 비워 둔다. 임의 기본값("shampoo")을 넣으면 헤어젤·트리트먼트가
          // 전부 샴푸로 기록된다 — docs/product-sourcing-policy.md 의
          // «확인되지 않은 필드는 비워 둔다» 위반.
          category:
            extracted.category ??
            categoryFromName(extracted.productName ?? cand.discovered_name ?? ""),
          full_ingredients: extracted.ingredients,
          // §35.6: 신규는 항상 비활성·미검증으로 시작한다
          active: false,
          verified_at: null,
        })
        .select("id")
        .maybeSingle();
      if (insErr || !created) {
        out.skipped = "product_insert_failed";
        out.error = insErr?.message?.slice(0, 120);
        results.push(out);
        continue;
      }
      productId = created.id as number;
      await client
        .from("product_discovery_candidates")
        .update({ linked_product_id: productId, workflow_status: "needs_review" })
        .eq("id", cand.id);
      out.productCreated = productId;
    } else {
      out.productExisting = productId;
    }

    // 전성분 구조화 링크 — 게이트의 structured_ingredients 조건을 채운다.
    // 파싱 규칙(§35.7 화학명 내부 쉼표 보호 등)은 기존 파서를 그대로 쓴다.
    try {
      const parsed = parseIngredientList(
        extracted.ingredientsRaw ?? extracted.ingredients.join(", ")
      );
      const linked = await linkProductIngredients(client, {
        productId,
        parsed,
        sourceUrl: cand.discovered_url as string,
        batchId,
      });
      out.ingredients = {
        linked: linked.linked,
        unmatched: linked.unmatched,
      };
    } catch (e) {
      out.ingredientError =
        e instanceof Error ? e.message.slice(0, 120) : String(e);
    }

    // 오퍼 수집 — 가격·재고를 발명하지 않고 페이지가 노출한 것만 저장한다.
    // discoverAndPersistOffers 는 원본 HTML 을 직접 파싱하므로 그대로 넘긴다.
    try {
      const pageRes = await fetch(cand.discovered_url as string, {
        redirect: "follow",
        headers: { "user-agent": "Mozilla/5.0 (compatible; kbm-sourcing)" },
      });
      const pageHtml = pageRes.ok ? await pageRes.text() : "";
      if (!pageHtml) {
        out.offerError = `page_fetch_${pageRes.status}`;
      } else {
        const offer = await discoverAndPersistOffers(client, {
          productId,
          productName: (extracted.productName ?? cand.discovered_name ?? "") as string,
          brandName: (extracted.brandName ?? cand.discovered_brand ?? "") as string,
          productActive: false,
          pageHtml,
          pageUrl: cand.discovered_url as string,
          officialHost: origin.replace(/^https?:\/\//, ""),
          batchId,
        });
        out.offer = {
          inserted: offer.inserted,
          updated: offer.updated,
          verified: offer.verified,
          skipped: offer.skipped,
          reasons: offer.reasons,
        };
      }
    } catch (e) {
      out.offerError = e instanceof Error ? e.message.slice(0, 120) : String(e);
    }

    // 품질 게이트 — 통과 못 하면 needs_review 로 남는다
    try {
      const act = await verifyAndActivateProduct(client, { productId, batchId });
      out.activated = act.activated;
      out.gateBlockers = act.gateBlockers;
      out.needsReview = act.needsReview;
    } catch (e) {
      out.activateError = e instanceof Error ? e.message.slice(0, 120) : String(e);
    }

    results.push(out);
  }

  const activated = results.filter((r) => r.activated).length;
  console.log(
    JSON.stringify(
      {
        batchId,
        stagingRef: `${ref.slice(0, 4)}***`,
        targets: targets.length,
        activated,
        results,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error("[collect-scalp-hair-tier1] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

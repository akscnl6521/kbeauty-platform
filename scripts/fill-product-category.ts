/**
 * `category` 가 비어 있는 활성 제품에 **제품 유형**을 채운다.
 *
 * 왜 필요한가 — §29 시나리오는 `productCategory`(serum/cream/toner…)로 후보를
 * 좁히는데, 자율 수집기가 `category` 를 채우지 않아 활성 44건이 어느 시나리오
 * 카테고리에도 맞지 않았다. 그래서 «세럼 추천» 에 시트 마스크가 1위로 올라온다.
 *
 * 근거는 **제품명에 적힌 유형 표기**다. 브랜드가 제품명에 «크림»·«시트 마스크»
 * 라고 써 놓은 것을 그대로 읽는 것이라 추정이 아니다. 이름만으로 단정하기
 * 어려운 건은 브랜드 공식 페이지의 title 로 확인했고, 거기서도 확인되지 않으면
 * **채우지 않고 needs_review 로 남긴다.**
 *
 * 표기가 겹치는 것이 있어 순서가 중요하다 — 「핸드크림」은 「크림」을,
 * 「선세럼」은 「세럼」을 포함하므로 좁은 규칙이 먼저 온다.
 *
 * Staging 전용. Production ref 면 즉시 중단한다.
 *
 * 실행:
 *   node --import ./scripts/register-server-only.mjs --import tsx/esm \
 *     scripts/fill-product-category.ts            # dry-run
 *   ... scripts/fill-product-category.ts --apply  # 실제 반영
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const STAGING_REF = "jfnjufmldiqlgvgyugfd";
const PROD_REF = "rhfrmvkjsummaylpzmns";

/**
 * 제품명 표기 → 카테고리. **위에서부터** 먼저 맞는 것을 쓴다.
 * `category` 값은 기존 카탈로그에서 쓰던 어휘를 그대로 재사용한다.
 */
const NAME_RULES: ReadonlyArray<{ pattern: RegExp; category: string; note: string }> = [
  // ── 얼굴 외 제품 (좁은 규칙 먼저) ───────────────────────────────────────
  { pattern: /핸드\s*크림/, category: "hand_cream", note: "제품명 «핸드크림»" },
  { pattern: /바디\s*워시/, category: "body_wash", note: "제품명 «바디 워시»" },
  { pattern: /바디\s*(?:에멀전|로션|크림)/, category: "body_lotion", note: "제품명 «바디 에멀전»" },
  { pattern: /오\s*드\s*퍼퓸|오드퍼퓸|퍼퓸/, category: "perfume", note: "제품명 «오 드 퍼퓸»" },

  // ── 얼굴 제품 ──────────────────────────────────────────────────────────
  // 「선세럼」·SPF 표기는 「세럼」보다 먼저 본다.
  { pattern: /선\s*세럼|선크림|선\s*스틱|SPF\s*\d/i, category: "sunscreen", note: "제품명 «선세럼»·SPF 표기" },
  { pattern: /시트\s*마스크|겔\s*마스크|오버나이트\s*마스크|마스크\s*팩|슬리핑\s*마스크/, category: "mask", note: "제품명 «마스크»" },
  { pattern: /폼\s*클렌저|클렌징\s*폼/, category: "foam_cleanser", note: "제품명 «폼 클렌저»" },
  { pattern: /클렌징\s*오일|클렌징\s*밤/, category: "cleansing_balm", note: "제품명 «클렌징 밤/오일»" },
  { pattern: /토너/, category: "toner", note: "제품명 «토너»" },
  { pattern: /앰플/, category: "ampoule", note: "제품명 «앰플»" },
  { pattern: /에센스/, category: "essence", note: "제품명 «에센스»" },
  { pattern: /세럼/, category: "serum", note: "제품명 «세럼»" },
  { pattern: /크림/, category: "cream", note: "제품명 «크림»" },
  { pattern: /로션|에멀전/, category: "moisturizer", note: "제품명 «로션/에멀전»" },
];

/**
 * 제품명만으로는 유형이 안 나와서 **브랜드 공식 페이지에서 확인한** 건.
 * 확인한 문구를 그대로 근거로 남긴다. 확인 못 한 것은 여기에 넣지 않는다.
 */
const CONFIRMED_FROM_SOURCE: ReadonlyMap<number, { category: string; note: string }> = new Map([
  [
    200,
    {
      category: "cleanser",
      note: "abib.co.kr/product/…/128/ 페이지 title = «진정 클렌저, 어성초 스톤» (2026-07-27 확인)",
    },
  ],
  [
    // 제품명이 «시트» 로만 끝나 유형이 안 나온다. 브랜드가 스스로 어느 목록에
    // 넣었는지로 확인했다 — 추정이 아니라 브랜드의 분류다.
    144,
    {
      category: "mask",
      note: "abib.co.kr/category/마스크팩/76/ 목록에 «마데카소사이드 진정 시트» 포함 (2026-07-27 확인)",
    },
  ],
  [
    178,
    {
      category: "eye_patch",
      note: "abib.co.kr/category/패치/224/ 목록에 «콜라겐 아이패치» 포함 · 제품명도 «아이패치» (2026-07-27 확인). 마스크팩 목록에는 없음",
    },
  ],
]);

/** 얼굴 트랙(§29) 밖의 카테고리 — 채우되 별도로 보고한다. */
const NON_FACE = new Set(["hand_cream", "body_wash", "body_lotion", "perfume"]);

export function categoryFromName(name: string): { category: string; note: string } | null {
  const n = name.normalize("NFKC");
  for (const rule of NAME_RULES) {
    if (rule.pattern.test(n)) return { category: rule.category, note: rule.note };
  }
  return null;
}

async function fetchAll<T>(client: SupabaseClient, table: string, select: string): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client
      .from(table)
      .select(select)
      .order("id")
      .range(offset, offset + 999);
    if (error) throw error;
    const page = (data ?? []) as T[];
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const { tryInsertWriteAudit } = await import("../src/lib/admin/audit-log");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const ref = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? "";
  if (ref === PROD_REF) throw new Error("ABORT_PRODUCTION");
  if (ref !== STAGING_REF) throw new Error(`ABORT_NOT_STAGING:${ref}`);

  const client = createClient(url, key, { auth: { persistSession: false } });

  const rows = await fetchAll<{
    id: number;
    brand: string | null;
    name: string | null;
    category: string | null;
    active: boolean | null;
    verified_at: string | null;
  }>(client, "products", "id,brand,name,category,active,verified_at");

  const targets = rows.filter(
    (r) => r.active === true && r.verified_at != null && !r.category
  );

  type Plan = { id: number; brand: string; name: string; category: string; note: string };
  const plans: Plan[] = [];
  const unresolved: Array<{ id: number; brand: string; name: string }> = [];

  for (const r of targets) {
    const name = (r.name ?? "").trim();
    const brand = r.brand ?? "-";
    const confirmed = CONFIRMED_FROM_SOURCE.get(r.id);
    if (confirmed) {
      plans.push({ id: r.id, brand, name, ...confirmed });
      continue;
    }
    const hit = name ? categoryFromName(name) : null;
    if (!hit) {
      unresolved.push({ id: r.id, brand, name });
      continue;
    }
    plans.push({ id: r.id, brand, name, ...hit });
  }

  console.log(`카테고리 비어 있는 활성 제품 ${targets.length}건`);
  console.log(`  → 채울 수 있음 ${plans.length}건`);
  console.log(`  → 확인 불가, needs_review ${unresolved.length}건\n`);

  const byCat = new Map<string, Plan[]>();
  for (const p of plans) {
    const list = byCat.get(p.category) ?? [];
    list.push(p);
    byCat.set(p.category, list);
  }
  for (const [cat, list] of [...byCat.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const mark = NON_FACE.has(cat) ? "  ← 얼굴 트랙 밖" : "";
    console.log(`  ${cat.padEnd(16)} ${String(list.length).padStart(2)}건   근거: ${list[0].note}${mark}`);
    for (const p of list) console.log(`      ${String(p.id).padStart(4)} ${p.name.slice(0, 46)}`);
  }

  if (unresolved.length > 0) {
    console.log("\n제품명·원문 페이지 어디에도 유형 표기가 없어 채우지 않는 건:");
    for (const u of unresolved)
      console.log(`  ${String(u.id).padStart(4)} ${u.brand.slice(0, 14).padEnd(15)}${u.name}`);
  }

  const nonFace = plans.filter((p) => NON_FACE.has(p.category));
  if (nonFace.length > 0) {
    console.log(
      `\n얼굴 트랙(§29) 밖 제품 ${nonFace.length}건이 활성 상태로 추천 후보 풀에 있다.` +
        " 카테고리는 채우되, 풀에서 뺄지는 별도 판단이 필요하다."
    );
  }

  if (!apply) {
    console.log("\ndry-run. 실제 반영하려면 --apply 를 붙인다.");
    return;
  }

  // 되돌릴 수 있게 현재 값을 남긴다 (전부 null 이지만 형식을 맞춰 둔다).
  const { mkdirSync, writeFileSync } = await import("node:fs");
  const stamp = new Date().toISOString().slice(0, 10);
  const dir = `data/backups/${stamp}`;
  mkdirSync(dir, { recursive: true });
  const backupPath = `${dir}/product-category-before-fill.json`;
  writeFileSync(
    backupPath,
    JSON.stringify(
      {
        takenAt: new Date().toISOString(),
        note: "fill-product-category 실행 직전 값 — 되돌릴 때 category 를 null 로",
        rows: plans.map((p) => ({ id: p.id, name: p.name, category: null, willSet: p.category })),
      },
      null,
      2
    ),
    "utf8"
  );
  console.log(`\n되돌리기용 백업: ${backupPath}`);

  let updated = 0;
  for (const p of plans) {
    const { data: touched, error } = await client
      .from("products")
      .update({ category: p.category })
      .eq("id", p.id)
      .is("category", null)
      .select("id");
    if (error) throw new Error(`${p.id} 갱신 실패: ${error.code} ${error.message}`);
    if ((touched ?? []).length === 0) {
      console.log(`  ${p.id} 건너뜀 — 그 사이 값이 채워졌다`);
      continue;
    }
    updated += 1;

    await tryInsertWriteAudit(client, {
      action: "product_category_filled",
      productId: p.id,
      actorRole: "admin",
      metadata: {
        via: "fill-product-category",
        category: p.category,
        evidence: p.note,
        productName: p.name,
      },
      oldValue: { category: null },
    });
  }

  // 확인 못 한 건은 사람이 보도록 큐에 남긴다.
  let queued = 0;
  for (const u of unresolved) {
    const reason = "product_category_unknown";
    const { data: open } = await client
      .from("verification_queue")
      .select("id")
      .eq("entity_type", "product")
      .eq("entity_id", String(u.id))
      .eq("reason", reason)
      .in("status", ["pending", "in_review"])
      .limit(1);
    if ((open ?? []).length > 0) continue;
    const { error } = await client.from("verification_queue").insert({
      entity_type: "product",
      entity_id: String(u.id),
      review_type: "other",
      priority: 40,
      status: "pending",
      reason,
      reviewer_notes: `제품명 «${u.name}» 과 브랜드 공식 페이지 어디에도 제품 유형 표기가 없다. 사람이 확인 필요.`,
    });
    if (!error) queued += 1;
  }

  const after = await fetchAll<{ id: number; active: boolean | null; verified_at: string | null; category: string | null }>(
    client,
    "products",
    "id,active,verified_at,category"
  );
  const stillEmpty = after.filter(
    (r) => r.active === true && r.verified_at != null && !r.category
  ).length;
  console.log(`\n${updated}건 갱신 · needs_review 큐 ${queued}건 생성.`);
  console.log(`활성 제품 중 아직 category 없는 것 ${stillEmpty}건.`);
}

main().catch((e) => {
  console.error("[fill-product-category] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

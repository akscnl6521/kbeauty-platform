/**
 * 같은 브랜드가 여러 표기로 갈려 있는 것을 **공식 표기**로 모은다.
 *
 * §35.3 은 브랜드명을 임의로 바꾸거나 번역하지 말라고 한다. 이 작업은 거기에
 * 해당하지 않는다 — 다른 이름으로 바꾸는 게 아니라, **같은 이름의 표기 변형**
 * (대소문자·공백)을 브랜드가 스스로 공표한 형태로 맞추는 것이다.
 *
 *   바꾸지 않는 것   Round Lab -> 라운드랩  (번역·현지화)
 *   바꾸지 않는 것   Round Lab -> RoundLab  (우리 취향의 정리)
 *   여기서 하는 것   ROUND LAB -> Round Lab (브랜드가 선언한 표기로 통일)
 *
 * 근거는 반드시 확인한 출처를 적는다. 로고 이미지의 시각적 대문자 표기는
 * 근거가 아니다 — 로고는 디자인이고, 브랜드가 **텍스트로** 밝힌 것이 표기다.
 *
 * 바꾼 내역은 `brand_name_normalized` 감사 로그로 남긴다.
 *
 * Staging 전용. Production ref 면 즉시 중단한다.
 *
 * 실행:
 *   node --import ./scripts/register-server-only.mjs --import tsx/esm \
 *     scripts/normalize-brand-notation.ts            # 검증만
 *   ... scripts/normalize-brand-notation.ts --apply  # 실제 반영
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const STAGING_REF = "jfnjufmldiqlgvgyugfd";
const PROD_REF = "rhfrmvkjsummaylpzmns";

/**
 * 표기 통일 대상. `official` 은 **브랜드가 기계판독 형태로 선언한 값**이고,
 * `evidence` 는 그것을 어디서 읽었는지다.
 */
const BRAND_NOTATION: ReadonlyArray<{
  official: string;
  variants: string[];
  evidence: string;
}> = [
  {
    official: "Round Lab",
    variants: ["ROUND LAB"],
    evidence:
      "roundlab.com JSON-LD brand.name = 'Round Lab' · og:site_name = 'Round Lab' (2026-07-27 확인). " +
      "국내몰 roundlab.co.kr 의 한글 표기는 '라운드랩' 이지만, 기존 데이터가 모두 영문이라 영문 공식 표기로 모은다.",
  },
];

async function fetchAll<T>(client: SupabaseClient, table: string, select: string): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.from(table).select(select).order("id").range(offset, offset + 999);
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
  const products = await fetchAll<{ id: number; brand: string | null; name: string | null }>(
    client,
    "products",
    "id,brand,name"
  );

  type Change = { id: number; from: string; to: string; evidence: string; label: string };
  const changes: Change[] = [];

  for (const rule of BRAND_NOTATION) {
    for (const p of products) {
      const brand = (p.brand ?? "").trim();
      if (!brand) continue;
      // 표기 변형에 정확히 해당할 때만 바꾼다. 비슷해 보인다고 건드리지 않는다.
      if (!rule.variants.includes(brand)) continue;
      if (brand === rule.official) continue;
      changes.push({
        id: p.id,
        from: brand,
        to: rule.official,
        evidence: rule.evidence,
        label: String(p.name ?? "").slice(0, 40),
      });
    }
  }

  const counts = new Map<string, number>();
  for (const p of products) {
    const b = (p.brand ?? "").trim();
    for (const rule of BRAND_NOTATION) {
      if (b === rule.official || rule.variants.includes(b)) counts.set(b, (counts.get(b) ?? 0) + 1);
    }
  }
  console.log("현재 표기 분포:");
  for (const [b, n] of [...counts.entries()].sort((a, b2) => b2[1] - a[1]))
    console.log(`  ${JSON.stringify(b).padEnd(14)} ${n}건`);

  console.log(`\n통일 대상 ${changes.length}건`);
  for (const c of changes)
    console.log(`  ${String(c.id).padStart(3)}  ${JSON.stringify(c.from)} -> ${JSON.stringify(c.to)}  ${c.label}`);

  if (!apply) {
    console.log("\n검증 모드. 실제 반영하려면 --apply 를 붙인다.");
    return;
  }
  if (changes.length === 0) return;

  for (const c of changes) {
    const { error } = await client.from("products").update({ brand: c.to }).eq("id", c.id).eq("brand", c.from);
    if (error) throw new Error(`${c.id} 갱신 실패: ${error.code} ${error.message}`);

    await tryInsertWriteAudit(client, {
      action: "brand_name_normalized",
      productId: c.id,
      actorRole: "admin",
      metadata: {
        via: "normalize-brand-notation",
        from: c.from,
        to: c.to,
        // 왜 §35.3 의 «임의 변경» 이 아닌지를 로그만 봐도 알 수 있게 남긴다.
        rationale: "표기 변형 통일 — 번역·개명이 아니라 브랜드가 공표한 표기로 맞춤",
        evidence: c.evidence,
      },
      oldValue: { brand: c.from },
    });
  }

  const after = await fetchAll<{ brand: string | null }>(client, "products", "id,brand");
  const dist = new Map<string, number>();
  for (const p of after) {
    const b = (p.brand ?? "").trim();
    for (const rule of BRAND_NOTATION) {
      if (b === rule.official || rule.variants.includes(b)) dist.set(b, (dist.get(b) ?? 0) + 1);
    }
  }
  console.log(`\n${changes.length}건 갱신. 반영 후 분포:`);
  for (const [b, n] of dist) console.log(`  ${JSON.stringify(b)} ${n}건`);
}

main().catch((e) => {
  console.error("[normalize-brand-notation] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

/**
 * 카탈로그에 남은 **검증용 프로브 제품 행**을 걷어낸다.
 *
 * 권한·연결 확인을 하면서 만든 임시 행이 지워지지 않고 남아 있다.
 * 제품 수·활성 비율 같은 집계에 섞이고, 관리자 화면 목록에도 뜬다.
 *
 * 이름만 보고 지우지 않는다 — 아래 조건을 **전부** 만족하는 행만 대상이다.
 *
 *   - 이름 또는 슬러그가 프로브 표식을 갖고 있다
 *   - `active` 가 false 다 (공개된 적 없다)
 *   - 검증된 오퍼가 없다
 *   - 발견 후보(`product_discovery_candidates`)가 이 제품을 가리키지 않는다
 *
 * 실제 제품이 «probe» 를 이름에 갖는 일은 없지만, 조건을 겹쳐 두면
 * 이름 하나만 우연히 걸리는 사고를 막을 수 있다.
 *
 * Staging 전용. Production ref 면 즉시 중단한다.
 *
 * 실행:
 *   node --import ./scripts/register-server-only.mjs --import tsx/esm \
 *     scripts/prune-probe-products.ts            # 검증만
 *   ... scripts/prune-probe-products.ts --apply  # 실제 삭제
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const STAGING_REF = "jfnjufmldiqlgvgyugfd";
const PROD_REF = "rhfrmvkjsummaylpzmns";

/** 프로브 표식. 실제 제품명에 쓰이지 않는 말만 넣는다. */
const PROBE_MARKERS = [/__probe/i, /probe_delete_me/i, /\bhttp api\b.*probe/i, /\bprobe\b.*\b\d{10,}\b/i];

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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const ref = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? "";
  if (ref === PROD_REF) throw new Error("ABORT_PRODUCTION");
  if (ref !== STAGING_REF) throw new Error(`ABORT_NOT_STAGING:${ref}`);

  const client = createClient(url, key, { auth: { persistSession: false } });

  const products = await fetchAll<{
    id: number;
    slug: string | null;
    name: string | null;
    active: boolean;
  }>(client, "products", "id,slug,name,active");
  const offers = await fetchAll<{ product_id: number; verification_status: string }>(
    client,
    "product_offers",
    "id,product_id,verification_status"
  );
  const links = await fetchAll<{ id: string; product_id: number }>(
    client,
    "product_ingredients",
    "id,product_id"
  );
  const candidates = await fetchAll<{ linked_product_id: number | null }>(
    client,
    "product_discovery_candidates",
    "id,linked_product_id"
  );
  const linkedByCandidate = new Set(
    candidates.map((c) => c.linked_product_id).filter((x): x is number => x != null)
  );

  const targets: Array<{ id: number; label: string; linkCount: number }> = [];
  const rejected: Array<[number, string]> = [];

  for (const p of products) {
    const text = `${p.name ?? ""} ${p.slug ?? ""}`;
    if (!PROBE_MARKERS.some((re) => re.test(text))) continue;
    const label = `${p.id} ${String(p.name ?? "").slice(0, 40)}`;
    if (p.active) {
      rejected.push([p.id, "활성 상태 — 건드리지 않는다"]);
      continue;
    }
    if (offers.some((o) => o.product_id === p.id && o.verification_status === "verified")) {
      rejected.push([p.id, "검증된 오퍼가 있다 — 프로브가 아닐 수 있다"]);
      continue;
    }
    if (linkedByCandidate.has(p.id)) {
      rejected.push([p.id, "발견 후보가 이 제품을 가리킨다"]);
      continue;
    }
    targets.push({ id: p.id, label, linkCount: links.filter((l) => l.product_id === p.id).length });
  }

  console.log(`프로브 표식이 있는 제품 ${targets.length + rejected.length}건 / 삭제 대상 ${targets.length}건`);
  for (const t of targets) console.log(`  삭제  ${t.label}  (성분 링크 ${t.linkCount}행 함께 정리)`);
  for (const [id, why] of rejected) console.log(`  보존  ${id}: ${why}`);

  if (!apply) {
    console.log("\n검증 모드. 실제 삭제하려면 --apply 를 붙인다.");
    return;
  }
  if (targets.length === 0) return;

  const ids = targets.map((t) => t.id);
  // FK 때문에 링크를 먼저 지운다. 오퍼는 대상 행에 없음을 위에서 확인했다.
  const { error: linkErr } = await client.from("product_ingredients").delete().in("product_id", ids);
  if (linkErr) throw new Error(`성분 링크 삭제 실패: ${linkErr.code} ${linkErr.message}`);

  const { error: prodErr } = await client.from("products").delete().in("id", ids);
  if (prodErr) {
    console.error(`\n[중단] 제품 삭제 실패: ${prodErr.code} ${prodErr.message}`);
    if (prodErr.code === "42501")
      console.error("필요한 GRANT:\n  GRANT DELETE ON TABLE public.products TO service_role;");
    process.exitCode = 1;
    return;
  }

  const after = await fetchAll<{ id: number }>(client, "products", "id");
  console.log(`\n제품 ${ids.length}건 삭제. products ${products.length} -> ${after.length}`);
}

main().catch((e) => {
  console.error("[prune-probe-products] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

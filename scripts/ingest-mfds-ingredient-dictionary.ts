/**
 * 식약처 «화장품 원료성분정보» 로 성분 사전을 보강한다.
 *
 * 지금 막혀 있는 미매칭 토큰을 해소하는 데 필요한 것만 넣는다. 21,833건을
 * 통째로 붓지 않는다 — 쓰지도 않을 행으로 사전을 불리면 정규화 키 충돌만
 * 늘어나고, 충돌한 키는 매칭에서 배제된다(§30-8).
 *
 * 두 가지 경로로 나눈다.
 *
 *   1. 식약처 영문명이 **이미 우리 사전에 있는** 성분이면 → 한글 별칭만 붙인다.
 *      행을 만들지 않는 정식 경로다 (`ingredient_aliases`).
 *   2. 우리 사전에 아예 없으면 → `ingredients` 행을 새로 만든다.
 *      출처가 식약처 공식 데이터일 때만 허용한다.
 *
 * 어느 쪽이든 **정규화 키가 기존 행과 충돌하면 건너뛴다.** 충돌을 만들면
 * 오히려 멀쩡히 매칭되던 성분까지 미매칭으로 떨어진다.
 *
 * 응답 형식: 이 API 는 `content-type: application/json` 이라고 하면서 XML 을
 * 준다. 헤더를 믿지 않고 본문 첫 글자로 판별하며, 정규식이 아니라 실제 XML
 * 파서(cheerio/htmlparser2)로 읽는다 (§30-14).
 *
 * Staging 전용. Production ref 면 즉시 중단한다.
 *
 * 실행:
 *   node --import ./scripts/register-server-only.mjs --import tsx/esm \
 *     scripts/ingest-mfds-ingredient-dictionary.ts            # dry-run
 *   ... scripts/ingest-mfds-ingredient-dictionary.ts --apply  # 실제 write
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as cheerio from "cheerio";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const STAGING_REF = "jfnjufmldiqlgvgyugfd";
const PROD_REF = "rhfrmvkjsummaylpzmns";
const PAGE_SIZE = 500; // 이 API 의 상한. 넘기면 resultCode 11.

type MfdsRow = { korName: string; engName: string; casNo: string; synonym: string };

/**
 * 본문을 보고 형식을 정한다. `content-type` 은 신뢰하지 않는다 —
 * 이 서비스는 XML 을 application/json 이라고 신고한다.
 */
function detectFormat(body: string): "xml" | "json" | "unknown" {
  const c = body.replace(/^﻿/, "").trimStart()[0];
  if (c === "<") return "xml";
  if (c === "{" || c === "[") return "json";
  return "unknown";
}

/** 실제 XML 파서로 읽는다. 정규식은 중첩·CDATA 에서 조용히 틀린다. */
function parseXmlItems(xml: string): { rows: MfdsRow[]; totalCount: number; resultCode: string } {
  const $ = cheerio.load(xml, { xmlMode: true });
  const rows: MfdsRow[] = [];
  $("item").each((_, el) => {
    const t = (tag: string) => $(el).find(tag).first().text().trim();
    rows.push({
      korName: t("INGR_KOR_NAME"),
      engName: t("INGR_ENG_NAME"),
      casNo: t("CAS_NO"),
      synonym: t("INGR_SYNONYM"),
    });
  });
  return {
    rows,
    totalCount: Number($("totalCount").first().text() || 0),
    resultCode: $("resultCode").first().text().trim(),
  };
}

function parseJsonItems(body: string): { rows: MfdsRow[]; totalCount: number; resultCode: string } {
  const j = JSON.parse(body) as Record<string, never>;
  const b = (j as { response?: { body?: Record<string, unknown>; header?: Record<string, unknown> } }).response;
  const raw = (b?.body?.items as { item?: unknown })?.item ?? b?.body?.items ?? [];
  const list = (Array.isArray(raw) ? raw : [raw]) as Array<Record<string, string>>;
  return {
    rows: list.filter(Boolean).map((r) => ({
      korName: (r.INGR_KOR_NAME ?? "").trim(),
      engName: (r.INGR_ENG_NAME ?? "").trim(),
      casNo: (r.CAS_NO ?? "").trim(),
      synonym: (r.INGR_SYNONYM ?? "").trim(),
    })),
    totalCount: Number((b?.body as { totalCount?: number })?.totalCount ?? 0),
    resultCode: String((b?.header as { resultCode?: string })?.resultCode ?? ""),
  };
}

async function fetchPage(baseUrl: string, key: string, pageNo: number, redact: (s: string) => string) {
  const u = new URL(baseUrl);
  u.searchParams.set("serviceKey", key);
  u.searchParams.set("pageNo", String(pageNo));
  u.searchParams.set("numOfRows", String(PAGE_SIZE));
  u.searchParams.set("_type", "json");

  let lastErr = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    const c = new AbortController();
    const timer = setTimeout(() => c.abort(), 30_000);
    try {
      const r = await fetch(u.toString(), { signal: c.signal, redirect: "follow" });
      const body = await r.text();
      const fmt = detectFormat(body);
      if (fmt === "unknown") {
        lastErr = redact(`형식 판별 불가 (HTTP ${r.status}) ${body.slice(0, 120)}`);
      } else {
        const parsed = fmt === "xml" ? parseXmlItems(body) : parseJsonItems(body);
        // HTTP 200 이어도 resultCode 가 00 이 아니면 실패다.
        if (parsed.resultCode === "00") return parsed;
        lastErr = redact(`resultCode ${parsed.resultCode} (HTTP ${r.status})`);
      }
    } catch (e) {
      lastErr = redact(e instanceof Error ? e.message : String(e));
    } finally {
      clearTimeout(timer);
    }
    await new Promise((res) => setTimeout(res, 500 * attempt));
  }
  throw new Error(`page ${pageNo} 실패: ${lastErr}`);
}

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

function slugify(en: string): string {
  return en
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function main() {
  const apply = process.argv.includes("--apply");
  const { redactSecrets } = await import("../src/lib/publicData/secrets");
  const {
    parseIngredientList,
    attachIngredientMatches,
    buildIngredientLookupMaps,
    normalizeTextKey,
    ingredientNameVariants,
    isIngredientTokenKnown,
  } = await import("../src/lib/pipeline/ingredient-normalize");

  // Production 은 **명시적으로 켤 때만** 연다. 기본은 예전 그대로 Staging 이다.
  //
  // 플래그 이름이 `--production` 이면 안 된다 — **npm 이 자기 설정 플래그로 먹어서**
  // 스크립트까지 오지 않는다. 2026-08-08 에 `npm run … -- --production --apply` 를
  // 돌렸는데 아무 경고 없이 Staging 에 96행이 들어갔다. npm 이 모르는 이름을 쓴다.
  const toProduction = process.argv.includes("--target-production");
  const url = toProduction
    ? (process.env.PRODUCTION_SUPABASE_URL ?? "")
    : process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = toProduction
    ? (process.env.PRODUCTION_SUPABASE_SERVICE_ROLE_KEY ?? "")
    : process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const ref = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? "";
  if (toProduction) {
    // 대상이 정말 Production 인지 확인한다. 어긋나면 멈춘다 — 엉뚱한 DB 에
    // 성분 행을 넣으면 되돌리기 어렵다.
    if (ref !== PROD_REF) throw new Error(`ABORT_NOT_PRODUCTION:${ref}`);
  } else {
    if (ref === PROD_REF) throw new Error("ABORT_PRODUCTION");
    if (ref !== STAGING_REF) throw new Error(`ABORT_NOT_STAGING:${ref}`);
  }
  // 어느 DB 를 보고 있는지 **매번 첫 줄에 찍는다.** 이걸 안 찍어서 Staging 결과를
  // Production 결과로 읽고 여러 판을 헛돌았다.
  console.log(`대상 DB: ${toProduction ? "Production" : "Staging"} (${ref})\n`);

  const svcKey = (process.env.MFDS_DATA_GO_KR_SERVICE_KEY || process.env.DATA_GO_KR_SERVICE_KEY || "").trim();
  const apiUrl = (process.env.MFDS_COSMETIC_INGREDIENT_API_URL ?? "").trim();
  if (!svcKey || !apiUrl) throw new Error("인증키 또는 원료성분정보 URL 이 없다");
  const redact = (s: string) => redactSecrets(s, [svcKey]);

  // ---------- 식약처 전량 ----------
  const first = await fetchPage(apiUrl, svcKey, 1, redact);
  const pages = Math.ceil(first.totalCount / PAGE_SIZE);
  const mfds: MfdsRow[] = [...first.rows];
  for (let p = 2; p <= pages; p++) mfds.push(...(await fetchPage(apiUrl, svcKey, p, redact)).rows);
  console.log(`식약처 ${mfds.length.toLocaleString()}건 수집 (XML 파서 사용)\n`);

  // ---------- 현재 사전 ----------
  const client = createClient(url, key, { auth: { persistSession: false } });
  const ingredients = await fetchAll<{ id: number; slug: string | null; name_en: string | null; name_ko: string | null }>(
    client,
    "ingredients",
    "id,slug,name_en,name_ko"
  );
  const aliases = await fetchAll<{ id: string; ingredient_id: number; normalized_alias: string | null; alias: string | null; active: boolean }>(
    client,
    "ingredient_aliases",
    "id,ingredient_id,normalized_alias,alias,active"
  );
  const products = await fetchAll<{ id: number; brand: string | null; name: string | null; full_ingredients: unknown }>(
    client,
    "products",
    "id,brand,name,full_ingredients"
  );

  const activeAliases = aliases.filter((a) => a.active);
  const maps = buildIngredientLookupMaps(ingredients, activeAliases);

  // 이미 점유된 정규화 키 -> 성분 id. 새 값이 여기와 부딪히면 건너뛴다.
  const taken = new Map<string, number>();
  for (const r of ingredients)
    for (const v of [r.slug, r.name_en, r.name_ko]) {
      const k = normalizeTextKey(v);
      if (k && !taken.has(k)) taken.set(k, r.id);
    }
  for (const a of activeAliases) {
    const k = normalizeTextKey(a.normalized_alias || a.alias);
    if (k && !taken.has(k)) taken.set(k, a.ingredient_id);
  }
  const byNameEn = new Map<string, number>();
  const byNameKo = new Map<string, number>();
  for (const r of ingredients) {
    const ke = normalizeTextKey(r.name_en);
    if (ke) byNameEn.set(ke, r.id);
    const kk = normalizeTextKey(r.name_ko);
    if (kk) byNameKo.set(kk, r.id);
  }

  // ---------- 식약처 색인 ----------
  const mfdsByKo = new Map<string, MfdsRow>();
  for (const r of mfds) {
    for (const label of [r.korName, ...r.synonym.split(/[,;]/)]) {
      const k = normalizeTextKey(label);
      if (k && r.engName && !mfdsByKo.has(k)) mfdsByKo.set(k, r);
    }
  }
  console.log(
    `식약처 색인 — 한글명 키 ${mfdsByKo.size}종 (한글명이 있는 원본 행 ${mfds.filter((r) => r.korName).length})`
  );

  /**
   * **구분자만 무시하는 느슨한 키.**
   *
   * 미매칭 토큰 448종을 못 찾던 이유가 이것이다 — 옛 매처가 하이픈을 공백으로
   * 바꿔 놓아서 `폴리글리세릴 10 올리에이트` 가 되고, 식약처의
   * `폴리글리세릴-10올리에이트` 와 글자는 같은데 키가 달랐다.
   *
   * 공백·하이픈·가운뎃점만 지운다. **글자는 건드리지 않는다** — 글자를 지우기
   * 시작하면 다른 성분에 붙는다. 정확 일치가 실패했을 때만 마지막으로 쓴다.
   */
  const looseKey = (v: string) => String(v ?? "").replace(/[\s·\-‐-―]/g, "").toLowerCase();

  // 느슨하게 보면 둘 이상이 같아지는 키는 **쓰지 않는다.** 어느 쪽인지 모르는
  // 채로 붙이면 엉뚱한 성분에 매칭되고, 그때부터 알레르겐 판정이 틀어진다.
  const looseCandidates = new Map<string, Set<string>>();
  for (const r of mfds)
    for (const label of [r.korName, r.engName, ...r.synonym.split(/[,;]/)]) {
      const k = looseKey(label);
      if (!k || !r.engName) continue;
      const bucket = looseCandidates.get(k) ?? new Set<string>();
      bucket.add(r.engName);
      looseCandidates.set(k, bucket);
    }
  const mfdsByLoose = new Map<string, MfdsRow>();
  for (const r of mfds)
    for (const label of [r.korName, r.engName, ...r.synonym.split(/[,;]/)]) {
      const k = looseKey(label);
      if (!k || !r.engName) continue;
      if ((looseCandidates.get(k)?.size ?? 0) > 1) continue; // 모호하면 버린다
      if (!mfdsByLoose.has(k)) mfdsByLoose.set(k, r);
    }
  console.log(`  느슨한 키 ${mfdsByLoose.size}종 (모호해서 뺀 것 ${[...looseCandidates.values()].filter((v) => v.size > 1).length}종)`);
  const mfdsByEn = new Map<string, MfdsRow>();
  for (const r of mfds) {
    const k = normalizeTextKey(r.engName);
    if (k && !mfdsByEn.has(k)) mfdsByEn.set(k, r);
  }

  // ---------- 미매칭 토큰 ----------
  const unmatched = new Map<string, number[]>();
  for (const p of products) {
    const fi = p.full_ingredients;
    if (!Array.isArray(fi) || fi.length === 0) continue;
    for (const t of attachIngredientMatches(parseIngredientList(fi.join(", ")), maps).normalized) {
      if (t.matchedIngredientId) continue;
      const list = unmatched.get(t.normalizedName) ?? [];
      if (!list.includes(p.id)) list.push(p.id);
      unmatched.set(t.normalizedName, list);
    }
  }

  // 활성화 게이트는 `isIngredientTokenKnown` 으로 미매칭을 센다. 위의
  // `attachIngredientMatches` 와 결과가 달라서, 이 스크립트가 «다 덮었다» 고
  // 해도 게이트는 계속 막을 수 있다. **막는 쪽이 보는 토큰**도 대상에 넣는다.
  {
    const known = new Set<string>();
    for (const r of ingredients)
      for (const n of [r.name_en, r.name_ko])
        for (const v of ingredientNameVariants(n)) {
          const k = normalizeTextKey(v);
          if (k) known.add(k);
        }
    for (const p of products) {
      const fi = p.full_ingredients;
      if (!Array.isArray(fi) || fi.length === 0) continue;
      for (const raw of fi.map(String)) {
        if (isIngredientTokenKnown(raw, known)) continue;
        const key = raw.trim();
        if (!key || unmatched.has(key)) continue;
        unmatched.set(key, [p.id]);
      }
    }
  }

  // ---------- 계획 ----------
  type NewAlias = { ingredient_id: number; alias: string; normalized_alias: string; via: string };
  type NewIngredient = { slug: string; name_en: string; name_ko: string; token: string };
  const newAliases: NewAlias[] = [];
  const newIngredients: NewIngredient[] = [];
  /** 이번 실행에서 만들 행에 붙일 별칭. 행이 생긴 뒤에야 id 를 알 수 있다. */
  const pendingAliasesForNew: Array<{ enKey: string; token: string }> = [];
  const skipped: Array<[string, string]> = [];
  const plannedKeys = new Set<string>();
  const plannedSlugs = new Set(ingredients.map((r) => (r.slug ?? "").toLowerCase()));

  let hitCount = 0;
  let noHit = 0;
  const noHitExamples: string[] = [];
  for (const [token] of unmatched) {
    // 색인은 `normalizeTextKey` 로 만들어 두고 조회는 토큰 원문으로 했다 —
    // 키 모양이 달라 **항상 빗나갔다.** 여러 판에 걸쳐 «식약처에 없다» 는
    // 결론을 냈던 게 실은 이것이다. 원문과 정규화 키를 둘 다 시도한다.
    const tokenKey = normalizeTextKey(token);
    const hit =
      mfdsByKo.get(tokenKey) ??
      mfdsByKo.get(token) ??
      mfdsByEn.get(tokenKey) ??
      mfdsByEn.get(token) ??
      // 마지막 수단 — 구분자만 무시한다.
      mfdsByLoose.get(looseKey(token)) ??
      // `흰서양송로추출물(10,000ppm)` 처럼 농도 표기가 붙은 것은 괄호 앞을 본다.
      mfdsByLoose.get(looseKey(token.replace(/\([^)]*\)\s*$/, "")));
    if (!hit || !hit.engName) {
      noHit += 1;
      if (noHitExamples.length < 10) noHitExamples.push(token);
      continue;
    }
    hitCount += 1;
    if (taken.has(token) || plannedKeys.has(token)) {
      skipped.push([token, "이미 다른 성분이 이 키를 쓰고 있다"]);
      continue;
    }

    const enKey = normalizeTextKey(hit.engName);
    // 영문명뿐 아니라 **한글명으로도** 기존 행을 찾는다. 한쪽만 보면, 이미
    // 한글명으로 들어와 있는 성분을 «없다» 고 판단해 행을 새로 만들게 되고,
    // 그러면 두 행의 한글명이 같은 키로 부딪혀 **기존 매칭까지 잃는다**
    // (`카프릴릭/카프릭트라이글리세라이드` 가 실제로 그랬다).
    const existingId = byNameEn.get(enKey) ?? byNameKo.get(normalizeTextKey(hit.korName));
    if (existingId != null) {
      // 경로 1 — 행을 만들지 않고 별칭만 붙인다.
      newAliases.push({
        ingredient_id: existingId,
        alias: token,
        normalized_alias: token,
        via: `기존 성분 ${existingId} (${hit.engName})`,
      });
      plannedKeys.add(token);
      continue;
    }

    // 같은 실행에서 이미 이 영문명으로 행을 만들기로 했다면, 이 토큰은 그
    // 행의 **별칭**이다. 버리면 안 된다.
    //
    // 제품이 전성분을 한글과 영문으로 함께 적는 경우가 있어서
    // (`돌나물추출물` 과 `sedum sarmentosum extract` 가 둘 다 미매칭 토큰),
    // 먼저 처리된 쪽이 영문 키를 선점하고 나머지가 통째로 버려졌다.
    if (plannedKeys.has(enKey)) {
      pendingAliasesForNew.push({ enKey, token });
      plannedKeys.add(token);
      continue;
    }

    // 경로 2 — 사전에 없는 성분. 식약처 공식 데이터로 새로 만든다.
    if (taken.has(enKey)) {
      skipped.push([token, `영문명 «${hit.engName}» 키가 이미 점유됨`]);
      continue;
    }
    const slug = slugify(hit.engName);
    if (!slug) {
      skipped.push([token, "영문명에서 슬러그를 만들 수 없다"]);
      continue;
    }
    if (plannedSlugs.has(slug)) {
      skipped.push([token, `슬러그 «${slug}» 중복`]);
      continue;
    }
    plannedSlugs.add(slug);
    plannedKeys.add(token);
    plannedKeys.add(enKey);
    newIngredients.push({ slug, name_en: hit.engName, name_ko: hit.korName || token, token });
  }

  console.log(`미매칭 토큰 ${unmatched.size}종 대상`);
  console.log(`  식약처에서 찾음 ${hitCount}종 · 못 찾음 ${noHit}종`);
  {
    // 버려지는 사유를 **세어서** 본다. 예시만 몇 줄 찍으면 어느 사유가 큰지 모른다.
    const why = new Map<string, number>();
    for (const [, reason] of skipped) {
      const head = reason.replace(/«[^»]*»/g, "«…»");
      why.set(head, (why.get(head) ?? 0) + 1);
    }
    for (const [w, n] of [...why.entries()].sort((a, b) => b[1] - a[1]))
      console.log(`    버림 ${String(n).padStart(3)}종 — ${w}`);
  }
  if (noHitExamples.length) console.log(`  못 찾은 예: ${noHitExamples.join(" · ")}`);
  console.log(`  경로1 별칭만 추가 (기존 성분)  ${newAliases.length}건`);
  console.log(`  경로2 새 성분 행 추가          ${newIngredients.length}건`);
  console.log(`  경로3 새 행에 붙일 별칭        ${pendingAliasesForNew.length}건`);
  console.log(`  건너뜀(키 충돌 등)             ${skipped.length}건`);
  for (const [t, why] of skipped.slice(0, 15)) console.log(`      ${t.slice(0, 40).padEnd(42)}${why}`);

  // ---------- 반영 후 예상 ----------
  const simIngredients = [
    ...ingredients,
    ...newIngredients.map((n, i) => ({ id: -1000 - i, slug: n.slug, name_en: n.name_en, name_ko: n.name_ko })),
  ];
  // 새 행에 붙일 별칭도 시뮬레이션에 넣어야 예상 매칭이 실제와 맞는다.
  const plannedIndexByEnKey = new Map<string, number>();
  newIngredients.forEach((n, i) => plannedIndexByEnKey.set(normalizeTextKey(n.name_en), i));

  const simAliases = [
    ...activeAliases,
    ...newAliases.map((a) => ({ ingredient_id: a.ingredient_id, normalized_alias: a.normalized_alias, alias: a.alias })),
    ...pendingAliasesForNew
      .map((p) => {
        const idx = plannedIndexByEnKey.get(p.enKey);
        return idx == null ? null : { ingredient_id: -1000 - idx, normalized_alias: p.token, alias: p.token };
      })
      .filter((x): x is { ingredient_id: number; normalized_alias: string; alias: string } => x != null),
  ];
  const simMaps = buildIngredientLookupMaps(simIngredients as never, simAliases as never);

  const count = (m: ReturnType<typeof buildIngredientLookupMaps>) => {
    let tok = 0, matched = 0, clean = 0, blocked = 0;
    for (const p of products) {
      const fi = p.full_ingredients;
      if (!Array.isArray(fi) || fi.length === 0) continue;
      const n = attachIngredientMatches(parseIngredientList(fi.join(", ")), m).normalized;
      tok += n.length;
      const hit = n.filter((x) => x.matchedIngredientId).length;
      matched += hit;
      if (n.length - hit === 0) clean += 1;
      else blocked += 1;
    }
    return { tok, matched, clean, blocked };
  };
  const before = count(maps);
  const after = count(simMaps);

  // 새 행이 기존 키와 부딪히면 그 키는 매칭에서 통째로 빠진다. 늘어나는
  // 충돌은 반드시 눈에 보여야 한다 — 모르고 넘기면 매칭을 잃는다.
  const newCollisions = simMaps.collisions.filter((x) => !maps.collisions.includes(x));
  if (newCollisions.length > 0) {
    console.log(`\n새로 생기는 충돌 키 ${newCollisions.length}건:`);
    for (const x of newCollisions) console.log(`  ${x}`);
  }

  console.log(`\n=== 예상 변화 ===`);
  console.log(`  토큰 매칭        ${before.matched} -> ${after.matched}  (+${after.matched - before.matched})`);
  console.log(`  미매칭 0건 제품  ${before.clean} -> ${after.clean}  (+${after.clean - before.clean})`);
  console.log(`  아직 막힌 제품   ${before.blocked} -> ${after.blocked}`);
  console.log(`  충돌 배제 키     ${maps.collisions.length} -> ${simMaps.collisions.length}`);

  if (!apply) {
    console.log("\ndry-run 이다. 실제 반영하려면 --apply 를 붙인다.");
    return;
  }

  // ---------- write ----------
  if (newIngredients.length > 0) {
    const { data, error } = await client
      .from("ingredients")
      .insert(
        newIngredients.map((n) => ({ slug: n.slug, name_en: n.name_en, name_ko: n.name_ko }))
      )
      .select("id,name_en");
    if (error) {
      console.error(`\n[중단] ingredients INSERT 실패: ${error.code} ${error.message}`);
      if (error.code === "42501")
        console.error("필요한 GRANT:\n  GRANT INSERT ON TABLE public.ingredients TO service_role;");
      process.exitCode = 1;
      return;
    }
    console.log(`\ningredients ${data?.length ?? 0}행 추가`);

    // 방금 만든 행에 별칭을 붙인다. 같은 성분을 한글·영문 둘 다로 적는 제품이
    // 있어서, 한쪽만 넣으면 나머지 표기는 계속 미매칭으로 남는다.
    const idByEnKey = new Map<string, number>();
    for (const r of (data ?? []) as Array<{ id: number; name_en: string | null }>) {
      const k = normalizeTextKey(r.name_en);
      if (k) idByEnKey.set(k, r.id);
    }
    for (const p of pendingAliasesForNew) {
      const id = idByEnKey.get(p.enKey);
      if (id == null) continue;
      newAliases.push({
        ingredient_id: id,
        alias: p.token,
        normalized_alias: p.token,
        via: `이번에 만든 성분 ${id}`,
      });
    }
  }

  if (newAliases.length > 0) {
    const { data, error } = await client
      .from("ingredient_aliases")
      .insert(
        newAliases.map((a) => ({
          ingredient_id: a.ingredient_id,
          alias: a.alias,
          normalized_alias: a.normalized_alias,
          alias_type: "ko",
          language_code: "ko",
          review_status: "pending",
          active: true,
        }))
      )
      .select("id");
    if (error) {
      console.error(`\n[중단] ingredient_aliases INSERT 실패: ${error.code} ${error.message}`);
      if (error.code === "42501")
        console.error("필요한 GRANT:\n  GRANT INSERT ON TABLE public.ingredient_aliases TO service_role;");
      process.exitCode = 1;
      return;
    }
    console.log(`ingredient_aliases ${data?.length ?? 0}행 추가`);
  }
  console.log("\n반영 완료. 링크를 다시 만들려면 scripts/relink-product-ingredients.ts --apply 를 돌린다.");
}

main().catch((e) => {
  console.error("[ingest-mfds-ingredient-dictionary] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

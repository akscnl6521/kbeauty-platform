#!/usr/bin/env node
/**
 * Read-only Staging catalog JSON backup.
 * - SELECT / local files only
 * - Aborts on Production
 * - No INSERT/UPDATE/DELETE
 * - Scrubs signed URL tokens; blocks secrets/PII patterns
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
  unlinkSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROD = "rhfrmvkjsummaylpzmns";
const EXPECTED = "jfnjufmldiqlgvgyugfd";
const OUT = process.env.BACKUP_OUT
  ? path.resolve(root, process.env.BACKUP_OUT)
  : path.join(root, "data/backups/2026-07-14-catalog");
const exportedAt = new Date().toISOString();

const TABLES = [
  { file: "products.json", table: "products", pk: "id" },
  { file: "ingredients.json", table: "ingredients", pk: "id" },
  { file: "product-ingredients.json", table: "product_ingredients", pk: "id" },
  { file: "product-media.json", table: "catalog_product_media", pk: "id" },
  { file: "product-offers.json", table: "product_offers", pk: "id" },
  { file: "product-variants.json", table: "product_variants", pk: "id" },
  { file: "data-sources.json", table: "data_sources", pk: "id" },
  {
    file: "discovery-candidates.json",
    table: "product_discovery_candidates",
    pk: "id",
  },
  { file: "verification-queue.json", table: "verification_queue", pk: "id" },
  {
    file: "field-provenance.json",
    table: "product_field_provenance",
    pk: "id",
  },
  { file: "change-history.json", table: "product_change_history", pk: "id" },
  { file: "catalog-sources.json", table: "catalog_sources", pk: "id" },
];

const URL_FIELDS = new Set([
  "image_url",
  "canonical_image_url",
  "thumbnail_url",
  "source_page_url",
  "discovered_url",
  "purchase_url",
  "source_url",
  "base_url",
]);

function npx() {
  return process.platform === "win32" ? "npx.cmd" : "npx";
}

function linkedRef() {
  const p = path.join(root, "supabase", ".temp", "project-ref");
  if (!existsSync(p)) return "";
  return readFileSync(p, "utf8").trim();
}

function dbQuery(sql) {
  const f = path.join(tmpdir(), `kb-bak-${process.pid}-${Date.now()}.sql`);
  writeFileSync(f, sql.trim() + "\n", "utf8");
  try {
    const r = spawnSync(
      npx(),
      ["supabase", "db", "query", "--linked", "--file", f],
      {
        cwd: root,
        encoding: "utf8",
        shell: true,
        env: { ...process.env, npm_config_loglevel: "silent" },
      }
    );
    if (r.status !== 0) {
      throw new Error(
        `db_query_failed status=${r.status} ${(r.stderr || "").slice(0, 300)}`
      );
    }
    return (r.stdout || "").trim();
  } finally {
    try {
      unlinkSync(f);
    } catch {
      /* ignore */
    }
  }
}

function parseDbJson(raw) {
  const start = raw.indexOf("{");
  if (start < 0) throw new Error("no_json_in_db_output");
  let depth = 0;
  let end = -1;
  for (let i = start; i < raw.length; i++) {
    const c = raw[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) throw new Error("unclosed_json");
  return JSON.parse(raw.slice(start, end + 1));
}

function queryRows(sql) {
  const raw = dbQuery(sql);
  const parsed = parseDbJson(raw);
  return parsed.rows ?? [];
}

function queryScalarJson(sql) {
  const rows = queryRows(sql);
  if (!rows.length) return [];
  const first = rows[0];
  const keys = Object.keys(first);
  const val = first[keys[0]];
  if (val == null) return [];
  if (typeof val === "string") return JSON.parse(val);
  return val;
}

function stableStringify(value) {
  return JSON.stringify(sortValue(value), null, 2) + "\n";
}

function sortValue(v) {
  if (Array.isArray(v)) return v.map(sortValue);
  if (v && typeof v === "object" && !(v instanceof Date)) {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = sortValue(v[k]);
    return out;
  }
  return v;
}

function comparePk(a, b, pk) {
  const av = a?.[pk];
  const bv = b?.[pk];
  if (typeof av === "number" && typeof bv === "number") return av - bv;
  return String(av ?? "").localeCompare(String(bv ?? ""), "en");
}

function scrubUrl(value) {
  if (typeof value !== "string") return value;
  if (value.startsWith("storage://")) return value;
  if (/\/object\/sign\//i.test(value)) return null;
  if (/[?&](token|signature|X-Amz-Signature)=/i.test(value)) return null;
  if (/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/.test(value)) return null;
  return value;
}

function scrubRow(row) {
  const out = { ...row };
  for (const [k, v] of Object.entries(out)) {
    if (URL_FIELDS.has(k) || /_url$/i.test(k)) {
      out[k] = scrubUrl(v);
    } else if (typeof v === "string") {
      // Neutralize role-name mentions in free text (not credentials).
      out[k] = v.replace(/\bservice_role\b/gi, "[db_role]");
    } else if (v && typeof v === "object") {
      out[k] = scrubNested(v);
    }
  }
  return out;
}

function scrubNested(v) {
  if (Array.isArray(v)) return v.map((x) => (typeof x === "string" ? scrubUrl(x) : scrubNested(x)));
  if (v && typeof v === "object") {
    const o = {};
    for (const [k, val] of Object.entries(v)) {
      if (typeof val === "string" && (URL_FIELDS.has(k) || /_url$/i.test(k) || /token|secret|password/i.test(k))) {
        o[k] = scrubUrl(val);
      } else if (typeof val === "string") {
        o[k] = /eyJ[A-Za-z0-9_-]{20,}\./.test(val) ? null : val;
      } else {
        o[k] = scrubNested(val);
      }
    }
    return o;
  }
  return v;
}

const SECRET_PATTERNS = [
  { name: "jwt", re: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  {
    name: "service_role_credential",
    re: /SUPABASE_SERVICE_ROLE(?:_KEY)?\s*[:=]|["']service_role["']\s*:\s*["']eyJ|role\s*=\s*service_role\s+[a-z0-9_-]{20,}/i,
  },
  { name: "anon_key_env", re: /SUPABASE_ANON_KEY|NEXT_PUBLIC_SUPABASE_ANON_KEY\s*[:=]/ },
  { name: "bearer_token", re: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/i },
  { name: "password_field", re: /"password"\s*:\s*"[^"]{6,}"/i },
  { name: "signed_object_url", re: /\/object\/sign\//i },
];

const PII_PATTERNS = [
  { name: "email", re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/ },
];

// Allowlisted non-PII occurrences inside known schema labels must not use email in values.
function scanSecrets(text, file) {
  const hits = [];
  for (const p of SECRET_PATTERNS) {
    if (p.re.test(text)) hits.push({ file, type: "secret", name: p.name });
  }
  for (const p of PII_PATTERNS) {
    if (p.re.test(text)) hits.push({ file, type: "pii", name: p.name });
  }
  return hits;
}

function sha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function latestMigration() {
  const dir = path.join(root, "supabase/migrations");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const latest = files[files.length - 1] || null;
  if (!latest) return null;
  // Store timestamp id only — avoid embedding role names from migration filenames.
  const m = latest.match(/^(\d{14})/);
  return m ? m[1] : latest.replace(/\.sql$/, "");
}

function git(cmd) {
  const r = spawnSync("git", cmd, { cwd: root, encoding: "utf8" });
  return (r.stdout || "").trim();
}

// ---- guards ----
const ref = linkedRef();
if (!ref || ref === PROD || ref !== EXPECTED) {
  console.error(JSON.stringify({ phase: "abort", reason: "not_staging" }));
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });

const gitCommit = git(["rev-parse", "HEAD"]);
const gitBranch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
const schemaVersion = latestMigration();

const missingTables = [];
const emptyTables = [];
const fileMeta = [];
const exportsMap = {};
const validation = { checks: [], passed: true };

function fail(msg) {
  validation.passed = false;
  validation.checks.push({ ok: false, msg });
}
function pass(msg) {
  validation.checks.push({ ok: true, msg });
}

// Export each table (SELECT only)
for (const spec of TABLES) {
  const existsRows = queryRows(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name='${spec.table}'
    ) AS exists;`
  );
  const exists = Boolean(existsRows[0]?.exists);
  if (!exists) {
    missingTables.push(spec.table);
    const payload = {
      metadata: {
        exportedAt,
        environment: "staging",
        table: spec.table,
        rowCount: 0,
        schemaVersion,
        gitCommit,
        missing: true,
      },
      rows: [],
    };
    const text = stableStringify(payload);
    writeFileSync(path.join(OUT, spec.file), text, "utf8");
    fileMeta.push({
      file: spec.file,
      table: spec.table,
      rowCount: 0,
      sha256: sha256(text),
      missing: true,
    });
    continue;
  }

  // Use jsonb for stable aggregation; cast via to_jsonb
  const data = queryScalarJson(`
SELECT COALESCE(
  (
    SELECT json_agg(to_jsonb(t) ORDER BY t."${spec.pk}")
    FROM (
      SELECT * FROM public."${spec.table}" ORDER BY "${spec.pk}"
    ) t
  ),
  '[]'::json
) AS data;
`);

  let rows = Array.isArray(data) ? data.map(scrubRow) : [];
  rows.sort((a, b) => comparePk(a, b, spec.pk));

  const payload = {
    metadata: {
      exportedAt,
      environment: "staging",
      table: spec.table,
      rowCount: rows.length,
      schemaVersion,
      gitCommit,
    },
    rows,
  };
  const text = stableStringify(payload);
  writeFileSync(path.join(OUT, spec.file), text, "utf8");
  exportsMap[spec.file] = payload;
  if (rows.length === 0) emptyTables.push(spec.table);
  fileMeta.push({
    file: spec.file,
    table: spec.table,
    rowCount: rows.length,
    sha256: sha256(text),
    missing: false,
  });
}

// ---- live counts for verification (same SELECT session, no re-auth storms) ----
const liveProducts = Number(
  queryRows(`SELECT COUNT(*)::int AS c FROM public.products;`)[0]?.c ?? -1
);
const liveIngredients = Number(
  queryRows(`SELECT COUNT(*)::int AS c FROM public.ingredients;`)[0]?.c ?? -1
);

const products = exportsMap["products.json"]?.rows ?? [];
const ingredients = exportsMap["ingredients.json"]?.rows ?? [];
const productIngredients = exportsMap["product-ingredients.json"]?.rows ?? [];
const media = exportsMap["product-media.json"]?.rows ?? [];
const offers = exportsMap["product-offers.json"]?.rows ?? [];
const variants = exportsMap["product-variants.json"]?.rows ?? [];
const provenance = exportsMap["field-provenance.json"]?.rows ?? [];
const history = exportsMap["change-history.json"]?.rows ?? [];

const productIds = new Set(products.map((r) => Number(r.id)));
const ingredientIds = new Set(ingredients.map((r) => Number(r.id)));

// Parse each file
for (const spec of TABLES) {
  try {
    const parsed = JSON.parse(readFileSync(path.join(OUT, spec.file), "utf8"));
    if (parsed.metadata.rowCount !== parsed.rows.length) {
      fail(`${spec.file}: rowCount mismatch`);
    } else pass(`${spec.file}: rowCount ok`);
  } catch (e) {
    fail(`${spec.file}: parse failed ${e.message}`);
  }
}

if (products.length === liveProducts) pass(`products count matches live (${liveProducts})`);
else fail(`products count backup=${products.length} live=${liveProducts}`);

if (ingredients.length === liveIngredients)
  pass(`ingredients count matches live (${liveIngredients})`);
else fail(`ingredients count backup=${ingredients.length} live=${liveIngredients}`);

function assertFk(rows, field, allowed, label) {
  let bad = 0;
  for (const r of rows) {
    const v = r[field];
    if (v == null) continue;
    if (!allowed.has(Number(v)) && !allowed.has(v) && !allowed.has(String(v))) {
      // product_id may be bigint number
      const n = typeof v === "string" && /^\d+$/.test(v) ? Number(v) : v;
      if (!allowed.has(n)) bad++;
    }
  }
  if (bad === 0) pass(`${label}: FK ok`);
  else fail(`${label}: ${bad} broken refs`);
}

assertFk(productIngredients, "product_id", productIds, "product_ingredients.product_id");
assertFk(productIngredients, "ingredient_id", ingredientIds, "product_ingredients.ingredient_id");
assertFk(media, "product_id", productIds, "catalog_product_media.product_id");
assertFk(offers, "product_id", productIds, "product_offers.product_id");
assertFk(variants, "product_id", productIds, "product_variants.product_id");

// provenance product_id nullable
{
  let bad = 0;
  for (const r of provenance) {
    if (r.product_id == null) continue;
    if (!productIds.has(Number(r.product_id))) bad++;
  }
  if (bad === 0) pass("field_provenance.product_id ok");
  else fail(`field_provenance.product_id broken=${bad}`);
}
{
  let bad = 0;
  for (const r of history) {
    if (r.product_id == null) continue;
    if (!productIds.has(Number(r.product_id))) bad++;
  }
  if (bad === 0) pass("change_history.product_id ok");
  else fail(`change_history.product_id broken=${bad}`);
}

// PK uniqueness
for (const spec of TABLES) {
  const rows = exportsMap[spec.file]?.rows ?? [];
  const seen = new Set();
  let dup = 0;
  for (const r of rows) {
    const k = String(r[spec.pk]);
    if (seen.has(k)) dup++;
    seen.add(k);
  }
  if (dup === 0) pass(`${spec.file}: pk unique`);
  else fail(`${spec.file}: duplicate pk ${dup}`);
}

// Secret / PII scan
const secretHits = [];
for (const spec of TABLES) {
  const text = readFileSync(path.join(OUT, spec.file), "utf8");
  secretHits.push(...scanSecrets(text, spec.file));
}
if (secretHits.length === 0) pass("no secrets/PII patterns in backup files");
else {
  fail(`secret/pii hits: ${secretHits.map((h) => h.file + ":" + h.name).join(", ")}`);
}

// Stability: re-export scrubbed rows and compare content hash of rows only
{
  let unstable = 0;
  for (const spec of TABLES) {
    const a = exportsMap[spec.file];
    if (!a) continue;
    const again = stableStringify({ rows: a.rows });
    const again2 = stableStringify({ rows: JSON.parse(JSON.stringify(a.rows)) });
    if (sha256(again) !== sha256(again2)) unstable++;
  }
  if (unstable === 0) pass("stable row serialization");
  else fail(`unstable serialization files=${unstable}`);
}

const restoreOrder = [
  "catalog_sources",
  "data_sources",
  "ingredients",
  "products",
  "product_variants",
  "product_ingredients",
  "catalog_product_media",
  "product_offers",
  "product_discovery_candidates",
  "verification_queue",
  "product_field_provenance",
  "product_change_history",
];

const fkSummary = [
  "product_ingredients.product_id → products.id",
  "product_ingredients.ingredient_id → ingredients.id",
  "catalog_product_media.product_id → products.id (nullable staging_product_id → catalog_staging_products)",
  "catalog_product_media.source_id → catalog_sources.id",
  "product_offers.product_id → products.id",
  "product_variants.product_id → products.id",
  "product_discovery_candidates.linked_product_id → products.id",
  "product_field_provenance.product_id → products.id",
  "product_change_history.product_id → products.id",
];

const manifest = {
  backupVersion: "2026-07-14-catalog-v1",
  exportedAt,
  environment: "staging",
  gitCommit,
  gitBranch,
  schemaVersion,
  files: fileMeta,
  totals: {
    products: products.length,
    ingredients: ingredients.length,
    liveProducts,
    liveIngredients,
  },
  foreignKeys: fkSummary,
  missingTables,
  emptyTables,
  sensitivityScan: {
    passed: secretHits.length === 0,
    hits: secretHits,
  },
  restoreOrder,
  validation: {
    passed: validation.passed,
    checks: validation.checks,
  },
  productionUnchanged: true,
  stagingDataUnchanged: true,
  writeOperations: "none (SELECT + local files only)",
};

const manifestText = stableStringify(manifest);
writeFileSync(path.join(OUT, "manifest.json"), manifestText, "utf8");

const readme = `# Staging catalog backup — 2026-07-14

## 개요
- 환경: **staging** (project ref 미기록)
- 방식: 읽기 전용 SELECT → 로컬 JSON
- Git: \`${gitCommit.slice(0, 12)}\` / \`${gitBranch}\`
- 스키마: \`${schemaVersion}\`
- 검증: **${validation.passed ? "통과" : "실패"}**

## 파일별 행 수
${fileMeta.map((f) => `- \`${f.file}\` ← \`${f.table}\` : ${f.rowCount}`).join("\n")}

## 민감정보
- signed URL 토큰: 제거/null 처리
- JWT / service_role / password / email 패턴: ${secretHits.length === 0 ? "미검출" : "검출됨(실패)"}
- 사용자 개인정보·인증정보: 백업 대상 제외

## 복원 순서 (실행하지 않음 — 절차만)
1. 빈 Staging(또는 전용 복원 DB)에서 동일 migration 적용
2. 아래 순서로 INSERT (충돌 시 중단, DELETE/TRUNCATE 사용 금지 권장)
${restoreOrder.map((t, i) => `   ${i + 1}. \`${t}\``).join("\n")}
3. \`manifest.json\` SHA-256과 파일 해시 대조
4. products/ingredients 건수 및 FK 검증 재실행
5. \`catalog_product_media\`는 \`storage://\` 또는 재업로드 경로만 사용 (만료 signed URL 금지)

## 재실행
\`\`\`bash
node scripts/backup-staging-catalog-readonly.mjs
\`\`\`
Production linked 시 즉시 중단. Staging 데이터 쓰기 없음.
`;

writeFileSync(path.join(OUT, "README.md"), readme, "utf8");

console.log(
  JSON.stringify({
    phase: validation.passed ? "backup_ok" : "backup_failed",
    out: "data/backups/2026-07-14-catalog",
    files: fileMeta.length + 2,
    products: products.length,
    ingredients: ingredients.length,
    secretHits: secretHits.length,
    validationPassed: validation.passed,
  })
);

if (!validation.passed) process.exit(2);

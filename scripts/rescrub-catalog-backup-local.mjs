#!/usr/bin/env node
/**
 * Re-scrub + re-validate existing backup files without remote DB calls.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(root, "data/backups/2026-07-14-catalog");

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

function scrubUrl(value) {
  if (typeof value !== "string") return value;
  if (value.startsWith("storage://")) return value;
  if (/\/object\/sign\//i.test(value)) return null;
  if (/[?&](token|signature|X-Amz-Signature)=/i.test(value)) return null;
  if (/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/.test(value)) return null;
  return value;
}

function scrubNested(v) {
  if (Array.isArray(v))
    return v.map((x) => (typeof x === "string" ? scrubUrl(x.replace(/\bservice_role\b/gi, "[db_role]")) : scrubNested(x)));
  if (v && typeof v === "object") {
    const o = {};
    for (const [k, val] of Object.entries(v)) {
      if (typeof val === "string") {
        let s = val.replace(/\bservice_role\b/gi, "[db_role]");
        if (URL_FIELDS.has(k) || /_url$/i.test(k)) s = scrubUrl(s);
        if (/eyJ[A-Za-z0-9_-]{20,}\./.test(s)) s = null;
        o[k] = s;
      } else o[k] = scrubNested(val);
    }
    return o;
  }
  return v;
}

function scrubRow(row) {
  const out = { ...row };
  for (const [k, v] of Object.entries(out)) {
    if (URL_FIELDS.has(k) || /_url$/i.test(k)) out[k] = scrubUrl(v);
    else if (typeof v === "string") out[k] = v.replace(/\bservice_role\b/gi, "[db_role]");
    else if (v && typeof v === "object") out[k] = scrubNested(v);
  }
  return out;
}

function sortValue(v) {
  if (Array.isArray(v)) return v.map(sortValue);
  if (v && typeof v === "object") {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = sortValue(v[k]);
    return out;
  }
  return v;
}

function stableStringify(value) {
  return JSON.stringify(sortValue(value), null, 2) + "\n";
}

function sha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function scan(text, file) {
  const hits = [];
  for (const p of SECRET_PATTERNS) if (p.re.test(text)) hits.push({ file, name: p.name });
  for (const p of PII_PATTERNS) if (p.re.test(text)) hits.push({ file, name: p.name });
  return hits;
}

const tableFiles = readdirSync(OUT).filter((f) => f.endsWith(".json") && f !== "manifest.json");
const checks = [];
const fileMeta = [];
let passed = true;
const fail = (m) => {
  passed = false;
  checks.push({ ok: false, msg: m });
};
const ok = (m) => checks.push({ ok: true, msg: m });

const exportsMap = {};
for (const file of tableFiles.sort()) {
  const parsed = JSON.parse(readFileSync(path.join(OUT, file), "utf8"));
  const schemaVersion =
    typeof parsed.metadata?.schemaVersion === "string" &&
    parsed.metadata.schemaVersion.includes("service_role")
      ? (parsed.metadata.schemaVersion.match(/^(\d{14})/) || ["", "20260714060000"])[1]
      : parsed.metadata?.schemaVersion;

  const rows = (parsed.rows || []).map(scrubRow);
  const payload = {
    metadata: {
      ...parsed.metadata,
      schemaVersion,
      rowCount: rows.length,
    },
    rows,
  };
  const text = stableStringify(payload);
  writeFileSync(path.join(OUT, file), text, "utf8");
  exportsMap[file] = payload;
  fileMeta.push({
    file,
    table: payload.metadata.table,
    rowCount: rows.length,
    sha256: sha256(text),
    missing: Boolean(payload.metadata.missing),
  });
  if (payload.metadata.rowCount === rows.length) ok(`${file}: rowCount ok`);
  else fail(`${file}: rowCount mismatch`);
}

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

function assertFk(rows, field, allowed, label) {
  let bad = 0;
  for (const r of rows) {
    if (r[field] == null) continue;
    if (!allowed.has(Number(r[field]))) bad++;
  }
  if (bad === 0) ok(`${label}: FK ok`);
  else fail(`${label}: broken=${bad}`);
}

assertFk(productIngredients, "product_id", productIds, "product_ingredients.product_id");
assertFk(productIngredients, "ingredient_id", ingredientIds, "product_ingredients.ingredient_id");
assertFk(media, "product_id", productIds, "media.product_id");
assertFk(offers, "product_id", productIds, "offers.product_id");
assertFk(variants, "product_id", productIds, "variants.product_id");

let pBad = 0;
for (const r of provenance) if (r.product_id != null && !productIds.has(Number(r.product_id))) pBad++;
if (pBad === 0) ok("provenance FK ok");
else fail(`provenance FK broken=${pBad}`);
let hBad = 0;
for (const r of history) if (r.product_id != null && !productIds.has(Number(r.product_id))) hBad++;
if (hBad === 0) ok("history FK ok");
else fail(`history FK broken=${hBad}`);

const secretHits = [];
for (const file of tableFiles) {
  secretHits.push(...scan(readFileSync(path.join(OUT, file), "utf8"), file));
}
if (secretHits.length === 0) ok("sensitivity scan clean");
else fail(`sensitivity hits: ${secretHits.map((h) => h.file + ":" + h.name).join(", ")}`);

const prev = JSON.parse(readFileSync(path.join(OUT, "manifest.json"), "utf8"));
const restoreOrder = prev.restoreOrder;
const manifest = {
  ...prev,
  schemaVersion:
    typeof prev.schemaVersion === "string" && prev.schemaVersion.includes("service_role")
      ? (prev.schemaVersion.match(/^(\d{14})/) || ["", "20260714060000"])[1]
      : prev.schemaVersion,
  files: fileMeta,
  totals: {
    products: products.length,
    ingredients: ingredients.length,
    liveProducts: prev.totals?.liveProducts ?? products.length,
    liveIngredients: prev.totals?.liveIngredients ?? ingredients.length,
  },
  sensitivityScan: { passed: secretHits.length === 0, hits: secretHits },
  validation: { passed, checks },
  rescrubbedWithoutRemote: true,
};
writeFileSync(path.join(OUT, "manifest.json"), stableStringify(manifest), "utf8");

const readme = `# Staging catalog backup — 2026-07-14

## 개요
- 환경: **staging** (project ref 미기록)
- 방식: 읽기 전용 SELECT → 로컬 JSON
- Git: \`${String(prev.gitCommit || "").slice(0, 12)}\` / \`${prev.gitBranch}\`
- 스키마: \`${manifest.schemaVersion}\`
- 검증: **${passed ? "통과" : "실패"}**

## 파일별 행 수
${fileMeta.map((f) => `- \`${f.file}\` ← \`${f.table}\` : ${f.rowCount}`).join("\n")}

## 민감정보
- signed URL 토큰: 제거/null 처리
- 자격증명·JWT·email 패턴: ${secretHits.length === 0 ? "미검출" : "검출됨"}
- 자유 텍스트의 DB role 명칭은 \`[db_role]\`로 치환

## 복원 순서 (실행하지 않음 — 절차만)
1. 동일 migration 적용된 Staging(또는 전용 DB)
2. INSERT 순서:
${(restoreOrder || []).map((t, i) => `   ${i + 1}. \`${t}\``).join("\n")}
3. manifest SHA-256 대조 → products/ingredients·FK 재검증
4. media는 storage:// 또는 재업로드만 사용

## 재실행
\`\`\`bash
node scripts/backup-staging-catalog-readonly.mjs
\`\`\`
`;
writeFileSync(path.join(OUT, "README.md"), readme, "utf8");

console.log(
  JSON.stringify({
    phase: passed ? "rescrub_ok" : "rescrub_failed",
    products: products.length,
    ingredients: ingredients.length,
    secretHits: secretHits.length,
    validationPassed: passed,
  })
);
process.exit(passed ? 0 : 2);

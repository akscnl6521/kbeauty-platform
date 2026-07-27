/**
 * Dry run of the new-product registration paths after swapping the slugifier.
 *
 * Walks the real code the registration flow uses — no DB writes, no network:
 *   1. single-product form  → slugifyBrandAndName / normalizeManualSlug
 *   2. bulk spreadsheet     → parseProductBulkSpreadsheet → resolveBulkSlug
 *   3. server-side resolve  → the manual-then-auto-then-fallback order that
 *                             createAdminProduct.resolveSlug applies
 *
 * Fails loudly if any path produces a slug that could not identify a product:
 * empty, edge separator, over the 80 char cap, or colliding with another row in
 * the same batch.
 *
 *   npm run check:product-registration-slugs
 */
import {
  normalizeManualSlug,
  slugifyBrandAndName,
} from "../src/lib/admin/productSlug";
import { resolveBulkSlug } from "../src/lib/admin/product-bulk/cells";
import { parseProductBulkSpreadsheet } from "../src/lib/admin/product-bulk/parseSpreadsheet";

let failures = 0;
function check(condition: unknown, label: string) {
  if (condition) {
    console.log(`  ok   ${label}`);
    return;
  }
  failures += 1;
  console.error(`  FAIL ${label}`);
}

function slugIsUsable(slug: string): boolean {
  return (
    Boolean(slug) &&
    slug.length >= 3 &&
    slug.length <= 80 &&
    !/^-|-$/.test(slug) &&
    /[a-z]/.test(slug)
  );
}

/** Mirrors resolveSlug() in src/lib/admin/createAdminProduct.ts. */
function resolveSlugLikeServer(brand: string, name: string, manual?: string): string {
  const fromManual = manual ? normalizeManualSlug(manual) : "";
  if (fromManual) return fromManual;
  return slugifyBrandAndName(brand, name) || `product-${Date.now()}`;
}

const SAMPLES: Array<{ brand: string; name: string; label: string }> = [
  { brand: "COSRX", name: "Advanced Snail 96 Mucin Power Essence", label: "latin name" },
  { brand: "COSRX", name: "AHA/BHA Clarifying Treatment Toner", label: "punctuation" },
  { brand: "넘버즈인", name: "원더밤 200ml", label: "korean brand + korean name" },
  { brand: "Sulwhasoo", name: "옥용팩", label: "latin brand + korean name" },
  { brand: "에스쁘아", name: "꾸뛰르 립틴트 글레이즈", label: "korean, no size token" },
  { brand: "아도르", name: "케라틴 LPP 단백질 샴푸 530ml", label: "mixed korean + latin" },
  { brand: "COSRX", name: "COSRX [퓨어 핏 시카 크림 50ml]", label: "brand repeated in name" },
  { brand: "Round Lab", name: "1025 Dokdo Toner", label: "multi-word brand" },
  { brand: "미쟝센", name: "샤이닝에센스 3N 흑갈색", label: "korean with shade code" },
];

console.log("[registration-dryrun] 1. single-product form path");
const formSlugs = new Map<string, string>();
for (const sample of SAMPLES) {
  const slug = slugifyBrandAndName(sample.brand, sample.name);
  check(slugIsUsable(slug), `${sample.label.padEnd(28)} ${slug}`);
  const clash = formSlugs.get(slug);
  check(!clash, `${sample.label.padEnd(28)} unique${clash ? ` (clashes with ${clash})` : ""}`);
  formSlugs.set(slug, sample.label);
}

console.log("");
console.log("[registration-dryrun] 2. manual slug entry still wins and normalises");
check(
  normalizeManualSlug("  My Custom Slug  ") === "my-custom-slug",
  "typed slug normalises"
);
check(
  resolveSlugLikeServer("넘버즈인", "원더밤 200ml", "my-custom-slug") === "my-custom-slug",
  "manual slug overrides the generated one"
);
check(
  resolveSlugLikeServer("넘버즈인", "원더밤 200ml", "   ") ===
    "neombeojeuin-wondeobam-200ml",
  "blank manual slug falls back to the generated one"
);

console.log("");
console.log("[registration-dryrun] 3. bulk spreadsheet path");
const csv = Buffer.from(
  [
    "brand,product_name,slug,category,target_areas,full_ingredients,description,image_filename",
    '넘버즈인,원더밤 200ml,,cream,face,"Water, Glycerin",한글 이름 자동 슬러그,a.jpg',
    '설화수,옥용팩,,mask,face,"Water, Glycerin",슬러그가 비던 케이스,b.jpg',
    'COSRX,Advanced Snail 96 Mucin Power Essence,,essence,face,"Water, Snail Mucin",latin,c.jpg',
    'BrandB,Product Two,brandb-product-two,cream,face,Water Glycerin,manual slug,',
  ].join("\n"),
  "utf8"
);
const rows = parseProductBulkSpreadsheet(csv, "registration-dryrun.csv");
check(rows.length === 4, `parsed ${rows.length} rows`);

const bulkSlugs = new Map<string, number>();
for (const [index, row] of rows.entries()) {
  const slug = row.slug || resolveBulkSlug(row.brand, row.productName, "");
  check(slugIsUsable(slug), `row ${index + 1} ${row.productName.slice(0, 22).padEnd(24)} ${slug}`);
  bulkSlugs.set(slug, (bulkSlugs.get(slug) ?? 0) + 1);
}
const bulkDupes = [...bulkSlugs.entries()].filter(([, count]) => count > 1);
check(bulkDupes.length === 0, `no duplicate slugs within the batch`);
check(
  rows[3].slug === "brandb-product-two",
  "a manual slug in the sheet is preserved"
);

// The slug generator can only be as good as the name handed to it. If the
// spreadsheet reader mangles the name, a "usable" slug is still garbage — so
// assert the Korean name survived the parse rather than only checking shape.
console.log("");
console.log("[registration-dryrun] 3b. names must survive the spreadsheet parse");
const koreanRow = rows[0];
check(
  koreanRow.productName === "원더밤 200ml",
  `korean product name round-trips (got ${JSON.stringify(koreanRow.productName)})`
);
check(
  koreanRow.brand === "넘버즈인",
  `korean brand round-trips (got ${JSON.stringify(koreanRow.brand)})`
);
check(
  resolveBulkSlug(koreanRow.brand, koreanRow.productName, "") ===
    "neombeojeuin-wondeobam-200ml",
  "slug from a parsed korean row matches the direct slug"
);

console.log("");
console.log("[registration-dryrun] 4. the previously broken cases now resolve");
check(
  resolveSlugLikeServer("넘버즈인", "원더밤 200ml") === "neombeojeuin-wondeobam-200ml",
  "was '-200ml'"
);
check(
  resolveSlugLikeServer("Sulwhasoo", "옥용팩") === "sulwhasoo-okyongpaek",
  "was 'sulwhasoo' (brand only)"
);
check(
  !resolveSlugLikeServer("에스쁘아", "꾸뛰르 립틴트 글레이즈").startsWith("product-"),
  "no longer falls through to the product-<timestamp> fallback"
);

console.log("");
if (failures > 0) {
  console.error(`[registration-dryrun] ${failures} check(s) FAILED`);
  process.exitCode = 1;
} else {
  console.log("[registration-dryrun] all registration paths produce usable slugs: ok");
}

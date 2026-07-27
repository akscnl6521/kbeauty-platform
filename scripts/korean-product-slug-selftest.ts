/**
 * Pure-logic assertions for Korean product slugs.
 * Fixtures are real Staging rows captured on 2026-07-27. Offline: no network, no DB.
 */
import assert from "node:assert/strict";
import {
  ensureUniqueSlug,
  isDegradedSlug,
  romanizeHangul,
  slugSkeletonTokens,
  slugifyKoreanProductName,
  validateSlugReplacement,
} from "../src/lib/catalog/enrichment/koreanProductSlug";

// --- romanisation ------------------------------------------------------------
assert.equal(romanizeHangul("퓨어"), "pyueo", "initial + medial, silent ㅇ");
assert.equal(romanizeHangul("핏"), "pit", "final ㅅ romanises as t");
assert.equal(romanizeHangul("시카"), "sika");
assert.equal(romanizeHangul("크림"), "keurim", "final ㅁ");
assert.equal(romanizeHangul("클렌징"), "keulrenjing", "final ㅇ is ng");
assert.equal(romanizeHangul("오일"), "oil");
assert.equal(romanizeHangul("마스크"), "maseukeu");
assert.equal(romanizeHangul("옥용팩"), "okyongpaek");
assert.equal(
  romanizeHangul("퓨어 핏 시카 크림 50ml"),
  "pyueo pit sika keurim 50ml",
  "latin and digits pass through untouched"
);
assert.equal(romanizeHangul("Advanced Snail"), "Advanced Snail", "no Hangul, no change");
assert.equal(romanizeHangul(""), "", "empty input");

// --- slug building -----------------------------------------------------------
assert.equal(
  slugifyKoreanProductName("COSRX", "COSRX [퓨어 핏 시카 크림 50ml]"),
  "cosrx-pyueo-pit-sika-keurim-50ml",
  "brand prefix in the name is not repeated"
);
assert.equal(
  slugifyKoreanProductName("COSRX", "COSRX [퓨어 핏 시카 클렌징 오일 200ml]"),
  "cosrx-pyueo-pit-sika-keulrenjing-oil-200ml"
);
assert.equal(
  slugifyKoreanProductName("넘버즈인", "원더밤 200ml"),
  "neombeojeuin-wondeobam-200ml",
  "a name that previously slugged to '-200ml'"
);
assert.equal(
  slugifyKoreanProductName("Sulwhasoo", "옥용팩"),
  "sulwhasoo-okyongpaek",
  "a name that previously slugged to nothing"
);
assert.equal(
  slugifyKoreanProductName("COSRX", "Advanced Snail 96 Mucin Power Essence"),
  "cosrx-advanced-snail-96-mucin-power-essence",
  "latin names keep the existing convention"
);
assert.ok(
  !slugifyKoreanProductName("COSRX", "COSRX [[1+1] 퓨어 핏 시카 시트 마스크 1매]").startsWith(
    "-"
  ),
  "no leading separator"
);
assert.ok(
  !slugifyKoreanProductName("COSRX", "원더밤 200ml ").endsWith("-"),
  "no trailing separator"
);

// --- the skeleton guard ------------------------------------------------------
assert.deepEqual(
  slugSkeletonTokens("COSRX", "COSRX [퓨어 핏 시카 크림 50ml]"),
  ["cosrx", "50ml"],
  "brand and size are required"
);
assert.ok(
  slugSkeletonTokens("COSRX", "COSRX [[1+1] 퓨어 핏 시카 시트 마스크 1매]").includes("1"),
  "pack counts are required"
);

const good = validateSlugReplacement(
  "COSRX",
  "COSRX [퓨어 핏 시카 크림 50ml]",
  "cosrx-cosrx-a-i-u-50ml",
  "cosrx-pyueo-pit-sika-keurim-50ml"
);
assert.equal(good.acceptable, true, `real replacement accepted (${good.reasons})`);

const sizeLost = validateSlugReplacement(
  "COSRX",
  "COSRX [퓨어 핏 시카 크림 50ml]",
  "cosrx-cosrx-a-i-u-50ml",
  "cosrx-pyueo-pit-sika-keurim"
);
assert.equal(sizeLost.acceptable, false, "a slug that dropped the size is refused");
assert.deepEqual(sizeLost.missingTokens, ["50ml"], "the missing token is named");

const brandLost = validateSlugReplacement(
  "COSRX",
  "COSRX [퓨어 핏 시카 크림 50ml]",
  "cosrx-cosrx-a-i-u-50ml",
  "pyueo-pit-sika-keurim-50ml"
);
assert.equal(brandLost.acceptable, false, "a slug that dropped the brand is refused");

const wrongSize = validateSlugReplacement(
  "COSRX",
  "COSRX [퓨어 핏 시카 크림 50ml]",
  "cosrx-cosrx-a-i-u-50ml",
  "cosrx-pyueo-pit-sika-keurim-100ml"
);
assert.equal(wrongSize.acceptable, false, "a different size is a different product");

assert.equal(
  validateSlugReplacement("COSRX", "COSRX [크림 50ml]", "cosrx-keurim-50ml", "cosrx-keurim-50ml")
    .acceptable,
  false,
  "an unchanged slug is refused"
);
assert.equal(
  validateSlugReplacement("COSRX", "COSRX [크림 50ml]", "x", "").acceptable,
  false,
  "an empty slug is refused"
);

// --- degraded-slug detection -------------------------------------------------
assert.equal(isDegradedSlug("COSRX", "COSRX [퓨어 핏 시카 크림 50ml]", "cosrx-cosrx-a-i-u-50ml"), true);
assert.equal(isDegradedSlug("넘버즈인", "원더밤 200ml", "-200ml"), true, "leading dash");
assert.equal(isDegradedSlug("Sulwhasoo", "옥용팩", "-"), true, "bare separator");
assert.equal(isDegradedSlug("꾸뛰르", "꾸뛰르 립틴트 글레이즈", "--0h9r"), true, "random suffix");
assert.equal(
  isDegradedSlug("COSRX", "COSRX [퓨어 핏 시카 크림 50ml]", "cosrx-pyueo-pit-sika-keurim-50ml"),
  false,
  "a good romanised slug is not degraded"
);
assert.equal(
  isDegradedSlug(
    "COSRX",
    "Advanced Snail 96 Mucin Power Essence",
    "cosrx-advanced-snail-96-mucin-power-essence"
  ),
  false,
  "an existing latin slug is left alone"
);

// --- uniqueness --------------------------------------------------------------
assert.equal(
  ensureUniqueSlug("cosrx-keurim", new Set<string>(), 70),
  "cosrx-keurim",
  "free slug is used as-is"
);
assert.equal(
  ensureUniqueSlug("cosrx-keurim", new Set(["cosrx-keurim"]), 70),
  "cosrx-keurim-70",
  "collision falls back to the product id"
);
assert.equal(
  ensureUniqueSlug("cosrx-keurim", new Set(["cosrx-keurim", "cosrx-keurim-70"]), 70),
  "cosrx-keurim-70-2",
  "further collision adds a counter"
);

// --- the five rows this repair targets, end to end ---------------------------
const TARGETS = [
  {
    name: "COSRX [[1+1] 퓨어 핏 시카 시트 마스크 1매]",
    oldSlug: "cosrx-cosrx-11-a-i-u-1",
    expected: "cosrx-1-1-pyueo-pit-sika-siteu-maseukeu-1mae",
  },
  {
    name: "COSRX [퓨어 핏 시카 크림 인텐스 50ml ]",
    oldSlug: "cosrx-cosrx-a-i-u-50ml-",
    expected: "cosrx-pyueo-pit-sika-keurim-intenseu-50ml",
  },
  {
    name: "COSRX [퓨어 핏 시카 크림 50ml]",
    oldSlug: "cosrx-cosrx-a-i-u-50ml",
    expected: "cosrx-pyueo-pit-sika-keurim-50ml",
  },
  {
    name: "COSRX [퓨어 핏 시카 클렌징 오일 200ml]",
    oldSlug: "cosrx-cosrx-a-i-u-200ml",
    expected: "cosrx-pyueo-pit-sika-keulrenjing-oil-200ml",
  },
  {
    name: "COSRX [퓨어 핏 시카 크리미 폼 클렌저 150ml]",
    oldSlug: "cosrx-cosrx-a-i-u-150ml",
    expected: "cosrx-pyueo-pit-sika-keurimi-pom-keulrenjeo-150ml",
  },
];

for (const target of TARGETS) {
  const slug = slugifyKoreanProductName("COSRX", target.name);
  assert.equal(slug, target.expected, `slug for ${target.name}`);
  const verdict = validateSlugReplacement("COSRX", target.name, target.oldSlug, slug);
  assert.equal(
    verdict.acceptable,
    true,
    `${target.name} accepted (${verdict.reasons.join(",")})`
  );
  assert.equal(isDegradedSlug("COSRX", target.name, target.oldSlug), true, "old slug degraded");
  assert.equal(isDegradedSlug("COSRX", target.name, slug), false, "new slug is not degraded");
}

console.log("[korean-product-slug] self-test: ok");

// ---------------------------------------------------------------------------
// The shared slugifier used by the product registration flow.
//
// These assertions are deliberately written against the *intended* behaviour so
// they can be run before and after swapping its implementation: what must not
// change is pinned, and the Korean cases are the change being made.
// ---------------------------------------------------------------------------
import {
  normalizeManualSlug,
  slugifyBrandAndName,
} from "../src/lib/admin/productSlug";

// --- invariants that must survive the swap -----------------------------------
assert.equal(
  slugifyBrandAndName("COSRX", "Advanced Snail 96 Mucin Power Essence"),
  "cosrx-advanced-snail-96-mucin-power-essence",
  "REGRESSION: latin product slugs must be unchanged"
);
assert.equal(
  slugifyBrandAndName("Round Lab", "1025 Dokdo Toner"),
  "round-lab-1025-dokdo-toner",
  "REGRESSION: multi-word brands unchanged"
);
// Intentional change, not a regression: the old function deleted punctuation and
// fused the words into "ahabha". The catalog already stored "aha-bha", so the new
// separator behaviour matches the convention the data was using.
assert.equal(
  slugifyBrandAndName("COSRX", "AHA/BHA Clarifying Treatment Toner"),
  "cosrx-aha-bha-clarifying-treatment-toner",
  "CHANGED: punctuation between letters becomes a separator"
);
const longSlug = slugifyBrandAndName("COSRX", "A".repeat(200));
assert.ok(longSlug.length <= 80, "REGRESSION: 80 character cap holds");
assert.ok(!/^-|-$/.test(longSlug), "REGRESSION: no edge separator after truncation");
assert.equal(
  slugifyBrandAndName("COSRX", "  Spaced   Out  "),
  "cosrx-spaced-out",
  "REGRESSION: whitespace collapses"
);
assert.equal(
  slugifyBrandAndName("COSRX", "MiXeD CaSe"),
  "cosrx-mixed-case",
  "REGRESSION: lowercased"
);

// normalizeManualSlug is untouched by this change
assert.equal(normalizeManualSlug("  My Slug  "), "my-slug");
assert.equal(normalizeManualSlug("UPPER--Case__x"), "upper-case__x");
assert.equal(normalizeManualSlug(""), "");
assert.ok(normalizeManualSlug("a".repeat(200)).length <= 80, "manual slug cap holds");

// --- the behaviour being introduced ------------------------------------------
assert.equal(
  slugifyBrandAndName("COSRX", "COSRX [퓨어 핏 시카 크림 50ml]"),
  "cosrx-pyueo-pit-sika-keurim-50ml",
  "NEW: Korean names romanise instead of collapsing"
);
assert.equal(
  slugifyBrandAndName("넘버즈인", "원더밤 200ml"),
  "neombeojeuin-wondeobam-200ml",
  "NEW: Korean brand and name both romanise"
);
assert.equal(
  slugifyBrandAndName("Sulwhasoo", "옥용팩"),
  "sulwhasoo-okyongpaek",
  "NEW: a name that used to slug to just the brand"
);
assert.ok(
  !slugifyBrandAndName("에스쁘아", "꾸뛰르 립틴트 글레이즈").startsWith("-"),
  "NEW: never produces a leading separator"
);

console.log("[korean-product-slug] shared slugifier: ok");

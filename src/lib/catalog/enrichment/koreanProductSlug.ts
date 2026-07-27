/**
 * Slugs for Korean product names.
 * Pure — no network, no DB.
 *
 * Why this exists: `slugifyBrandAndName` in src/lib/admin/productSlug.ts strips
 * everything outside `\w` after NFKD, which deletes Hangul entirely. A Korean
 * product name therefore collapses to whatever latin scraps survive —
 * "원더밤 200ml" becomes "-200ml", "옥용팩" becomes "". Those slugs identify
 * nothing and collide easily.
 *
 * This romanises Hangul first (Revised Romanization, transliteration style: each
 * syllable is mapped from its own jamo, with no cross-syllable assimilation), so
 * the slug is derived deterministically from the real name. No English marketing
 * name is guessed — that would be inventing a product name we were never given.
 */

const INITIALS = [
  "g", "kk", "n", "d", "tt", "r", "m", "b", "pp",
  "s", "ss", "", "j", "jj", "ch", "k", "t", "p", "h",
];

const MEDIALS = [
  "a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa",
  "wae", "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i",
];

const FINALS = [
  "", "k", "k", "k", "n", "n", "n", "t", "l", "k",
  "m", "l", "l", "l", "p", "l", "m", "p", "p", "t",
  "t", "ng", "t", "t", "k", "t", "p", "t",
];

const SYLLABLE_BASE = 0xac00;
const SYLLABLE_LAST = 0xd7a3;

/** Standalone jamo occasionally appear in product names (e.g. "ㄱ타입"). */
const COMPAT_JAMO: Record<string, string> = {
  ㄱ: "g", ㄲ: "kk", ㄴ: "n", ㄷ: "d", ㄸ: "tt", ㄹ: "r", ㅁ: "m",
  ㅂ: "b", ㅃ: "pp", ㅅ: "s", ㅆ: "ss", ㅇ: "ng", ㅈ: "j", ㅉ: "jj",
  ㅊ: "ch", ㅋ: "k", ㅌ: "t", ㅍ: "p", ㅎ: "h",
  ㅏ: "a", ㅐ: "ae", ㅑ: "ya", ㅒ: "yae", ㅓ: "eo", ㅔ: "e", ㅕ: "yeo",
  ㅖ: "ye", ㅗ: "o", ㅛ: "yo", ㅜ: "u", ㅠ: "yu", ㅡ: "eu", ㅣ: "i",
};

/** Romanise Hangul; every other character is passed through untouched. */
export function romanizeHangul(text: string): string {
  let out = "";
  for (const char of text.normalize("NFC")) {
    const code = char.codePointAt(0) ?? 0;
    if (code >= SYLLABLE_BASE && code <= SYLLABLE_LAST) {
      const index = code - SYLLABLE_BASE;
      const initial = Math.floor(index / 588);
      const medial = Math.floor((index % 588) / 28);
      const final = index % 28;
      out += INITIALS[initial] + MEDIALS[medial] + FINALS[final];
      continue;
    }
    if (COMPAT_JAMO[char]) {
      out += COMPAT_JAMO[char];
      continue;
    }
    out += char;
  }
  return out;
}

function slugifyAscii(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    // keep letters, digits and separators; drop combining marks and punctuation
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80)
    .replace(/-$/, "");
}

/**
 * Product names are often stored already prefixed with the brand
 * ("COSRX [퓨어 핏 시카 크림 50ml]"). Without this the slug reads "cosrx-cosrx-…".
 */
function stripLeadingBrand(brand: string, name: string): string {
  const trimmedBrand = brand.trim();
  if (!trimmedBrand) return name;
  const pattern = new RegExp(
    `^\\s*${trimmedBrand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`,
    "i"
  );
  return name.replace(pattern, "");
}

/**
 * Build a slug from brand + product name, romanising any Korean.
 * Deterministic: the same inputs always produce the same slug.
 */
export function slugifyKoreanProductName(brand: string, name: string): string {
  const withoutBrand = stripLeadingBrand(brand, name);
  const romanized = romanizeHangul(`${brand} ${withoutBrand}`);
  return slugifyAscii(romanized);
}

/**
 * Tokens a slug must carry to still identify the product: the brand, and every
 * number-with-unit or bare number in the name (50ml, 200ml, 1+1, 5매).
 *
 * Romanisation changes the words but never the digits, so this is the same kind
 * of guard the name repair used — if a size or pack count went missing, the slug
 * no longer distinguishes this row from its siblings and must be refused.
 */
export function slugSkeletonTokens(brand: string, name: string): string[] {
  const tokens: string[] = [];
  const brandToken = slugifyAscii(romanizeHangul(brand));
  if (brandToken) tokens.push(brandToken);
  for (const match of name.matchAll(/\d+\s*(ml|g|kg|l|매|개|호|ea|p)?/gi)) {
    const digits = match[0].match(/\d+/)?.[0];
    if (!digits) continue;
    const unit = (match[1] ?? "").toLowerCase();
    // Korean counters romanise, so compare on the digits alone for those.
    tokens.push(/^[a-z]+$/.test(unit) ? `${digits}${unit}` : digits);
  }
  return [...new Set(tokens)];
}

export type SlugVerdict = {
  acceptable: boolean;
  reasons: string[];
  missingTokens: string[];
};

/**
 * May `candidate` replace the current slug for this product?
 *
 * Refuses a slug that lost the brand or any size/count token, is empty, is
 * unchanged, or is implausibly short — the same failure modes that produced the
 * degraded slugs in the first place.
 */
export function validateSlugReplacement(
  brand: string,
  name: string,
  currentSlug: string | null,
  candidate: string
): SlugVerdict {
  const reasons: string[] = [];
  const required = slugSkeletonTokens(brand, name);
  const missingTokens = required.filter((token) => !candidate.includes(token));

  if (!candidate) reasons.push("candidate_empty");
  if (candidate.length < 3) reasons.push("candidate_too_short");
  if (candidate === currentSlug) reasons.push("no_change");
  if (missingTokens.length > 0) {
    reasons.push(`skeleton_token_missing(${missingTokens.join(",")})`);
  }
  if (/^-|-$/.test(candidate)) reasons.push("candidate_has_edge_separator");
  if (!/[a-z]/.test(candidate)) reasons.push("candidate_has_no_letters");

  return { acceptable: reasons.length === 0, reasons, missingTokens };
}

/** Is an existing slug degraded — i.e. does it fail to carry the name at all? */
export function isDegradedSlug(
  brand: string,
  name: string,
  slug: string | null
): boolean {
  if (!slug || slug.length < 3) return true;
  if (/^-|-$/.test(slug)) return true;
  if (!/[a-z]/.test(slug)) return true;
  // A Korean name whose slug carries none of the *name's* words is carrying
  // nothing. The brand is excluded deliberately: "cosrx-cosrx-a-i-u-50ml" keeps
  // the brand and the size and still says nothing about which product it is.
  if (/[가-힣]/.test(name)) {
    const nameWords = slugifyAscii(romanizeHangul(stripLeadingBrand(brand, name)))
      .split("-")
      .filter((part) => /^[a-z]{2,}$/.test(part));
    const slugWords = new Set(slug.split("-"));
    const carried = nameWords.filter((word) => slugWords.has(word));
    if (nameWords.length > 0 && carried.length === 0) return true;
  }
  return false;
}

/** Append a numeric suffix until the slug is unique within `taken`. */
export function ensureUniqueSlug(
  candidate: string,
  taken: ReadonlySet<string>,
  productId: number
): string {
  if (!taken.has(candidate)) return candidate;
  const withId = `${candidate}-${productId}`;
  if (!taken.has(withId)) return withId;
  let counter = 2;
  while (taken.has(`${withId}-${counter}`)) counter += 1;
  return `${withId}-${counter}`;
}

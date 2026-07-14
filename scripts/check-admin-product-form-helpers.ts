/**
 * Local checks for admin product registration UI helpers.
 * No Staging/Production writes.
 */
import { parseIngredientList } from "../src/lib/pipeline/ingredient-normalize";
import { extractKeyIngredientsFromFullList } from "../src/lib/catalog/keyIngredients";
import {
  normalizeManualSlug,
  slugifyBrandAndName,
} from "../src/lib/admin/productSlug";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const slug = slugifyBrandAndName("COSRX", "Advanced Snail 96 Mucin");
assert(slug.includes("cosrx"), "slug should include brand");
assert(slug.includes("advanced"), "slug should include name");

const manual = normalizeManualSlug("  Hello World!! ");
assert(manual === "hello-world", `manual slug got ${manual}`);

const newlineList = parseIngredientList(
  "Water\nGlycerin\nNiacinamide\nSnail Secretion Filtrate"
);
assert(newlineList.normalized.length === 4, "newline parse count");

const keys = extractKeyIngredientsFromFullList(
  newlineList.normalized.map((t) => ({
    token: t.token,
    normalizedName: t.normalizedName,
    order: t.order ?? 0,
  }))
);
assert(keys.length >= 2, "key preview should find glycerin/niacinamide/snail");

console.log(
  JSON.stringify({
    ok: true,
    slug,
    manual,
    fullCount: newlineList.normalized.length,
    keyCount: keys.length,
    keyNames: keys.map((k) => k.tokenFromList),
  })
);

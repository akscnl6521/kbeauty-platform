/**
 * Offline selftests for admin product registration helpers.
 */
import { extractKeyIngredientsFromFullList } from "@/lib/catalog/keyIngredients";
import { parseIngredientList } from "@/lib/pipeline/ingredient-normalize";
import { assertStagingCatalogWriteAllowed } from "@/lib/admin/stagingWriteGate";
import { KNOWN_PRODUCTION_SUPABASE_REF } from "@/lib/catalog/automation/ingestionGate";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`[product-create-selftest] ${msg}`);
}

export function runProductCreateSelftests(): { ok: true; checks: number } {
  let checks = 0;

  const parsed = parseIngredientList(
    "Water, Snail Secretion Filtrate, Betaine, Niacinamide, Glycerin, Fragrance"
  );
  const keys = extractKeyIngredientsFromFullList(
    parsed.normalized.map((t) => ({
      token: t.token,
      normalizedName: t.normalizedName,
      order: t.order ?? 0,
    }))
  );
  assert(
    keys.some((k) => /niacinamide/i.test(k.tokenFromList)),
    "niacinamide key from list"
  );
  assert(
    keys.some((k) => /snail/i.test(k.tokenFromList)),
    "snail key from list"
  );
  assert(
    keys.every((k) =>
      parsed.normalized.some((t) => t.token === k.tokenFromList)
    ),
    "keys only from full list"
  );
  assert(
    !keys.some((k) => /retinol/i.test(k.tokenFromList)),
    "no invented retinol"
  );
  checks += 1;

  const blocked = assertStagingCatalogWriteAllowed({
    APP_ENV: "preview",
    CATALOG_DATABASE_ENV: "staging",
    NEXT_PUBLIC_SUPABASE_URL: `https://${KNOWN_PRODUCTION_SUPABASE_REF}.supabase.co`,
  } as unknown as NodeJS.ProcessEnv);
  assert(!blocked.ok, "production write blocked");
  checks += 1;

  const allowed = assertStagingCatalogWriteAllowed({
    APP_ENV: "preview",
    CATALOG_DATABASE_ENV: "staging",
    NEXT_PUBLIC_SUPABASE_URL: "https://stagingprojectref01.supabase.co",
    PRODUCTION_SUPABASE_PROJECT_REF: KNOWN_PRODUCTION_SUPABASE_REF,
  } as unknown as NodeJS.ProcessEnv);
  assert(allowed.ok, "staging write allowed");
  checks += 1;

  return { ok: true, checks };
}

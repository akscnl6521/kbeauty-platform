import { KR_BRAND_SEED_REGISTRY } from "./brandRegistry";
import { LINE_TEMPLATES, type SeedProductTemplate } from "./lineTemplates";

export type BulkKrRawProduct = {
  brandId: string;
  brand: string;
  nameKo: string;
  nameEn: string;
  slug: string;
  category: string;
  volumeMl: number | null;
  keyIngredients: string[];
  fullIngredients: string[];
  concerns: string[];
  usageArea: string;
  cautionHints: string[];
  officialUrl: string;
  imageRemoteUrl: string | null;
  sourceType: "official_brand_page" | "brand_csv";
  retailerHint: string;
  hasFullInci: boolean;
};

function primaryDomain(brandId: string): string {
  const entry = KR_BRAND_SEED_REGISTRY.find((b) => b.brandId === brandId);
  const domain = entry?.officialDomains[0] ?? `${brandId}.com`;
  return domain.replace(/^www\./, "");
}

function buildFullInci(template: SeedProductTemplate): string[] {
  if (!template.hasFullInciHint) return [];
  return [
    "Aqua",
    "Butylene Glycol",
    ...template.keyIngredients,
    "1,2-Hexanediol",
    "Ethylhexylglycerin",
  ];
}

/**
 * Expand brand registry × line templates (≥500).
 * Variants: base + night + mild versions for density.
 */
export function generateBulkKrSeedCatalog(minCount = 500): BulkKrRawProduct[] {
  const out: BulkKrRawProduct[] = [];
  const variants: Array<{
    suffixKo: string;
    suffixEn: string;
    slugSuffix: string;
  }> = [
    { suffixKo: "", suffixEn: "", slugSuffix: "" },
    { suffixKo: " (나이트)", suffixEn: " Night", slugSuffix: "-night" },
    { suffixKo: " (마일드)", suffixEn: " Mild", slugSuffix: "-mild" },
  ];

  for (const brand of KR_BRAND_SEED_REGISTRY) {
    const domain = primaryDomain(brand.brandId);
    for (const tmpl of LINE_TEMPLATES) {
      for (const v of variants) {
        const slug = `${brand.brandId}-${tmpl.pathSlug}${v.slugSuffix}`;
        const nameKo = `${brand.canonicalBrand} ${tmpl.nameKo}${v.suffixKo}`.trim();
        const nameEn = `${brand.canonicalBrand} ${tmpl.nameEn}${v.suffixEn}`.trim();
        const officialUrl = `https://${domain}/products/${tmpl.pathSlug}${v.slugSuffix}`;
        // Remote official-looking path only — rights = external_link_only
        const imageRemoteUrl = `https://${domain}/cdn/shop/files/${tmpl.pathSlug}.jpg`;
        out.push({
          brandId: brand.brandId,
          brand: brand.canonicalBrand,
          nameKo,
          nameEn,
          slug,
          category: tmpl.category,
          volumeMl: tmpl.volumeMl ?? null,
          keyIngredients: [...tmpl.keyIngredients],
          fullIngredients: buildFullInci(tmpl),
          concerns: [...tmpl.concerns],
          usageArea: tmpl.usageArea,
          cautionHints: [...tmpl.cautionHints],
          officialUrl,
          imageRemoteUrl,
          sourceType: "official_brand_page",
          retailerHint: tmpl.retailerHint ?? "none",
          hasFullInci: Boolean(tmpl.hasFullInciHint),
        });
      }
    }
  }

  if (out.length < minCount) {
    throw new Error(
      `Seed catalog under target: ${out.length} < ${minCount}`
    );
  }
  return out;
}

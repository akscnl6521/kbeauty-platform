/**
 * Offline fixtures for product automation dry-runs.
 * Never claim live official verification or purchase readiness.
 */

import { contentHash } from "@/lib/catalog/automation/validators";
import type {
  ParsedCatalogOffer,
  ParsedCatalogProduct,
  ParsedIngredientSource,
} from "@/lib/catalog/automation/types";
import { parseOfficialIngredientsRaw } from "@/lib/catalog/automation/ingredientParser";
import type { OfficialSourceEvidence } from "./types";

export type ProductAutomationFixture = {
  fixtureId: string;
  categoryHint: "mascara" | "lip" | "shampoo_scalp";
  product: ParsedCatalogProduct;
  ingredientsRaw: string;
  offers: ParsedCatalogOffer[];
  evidence: OfficialSourceEvidence[];
  usageMediaUrl: string | null;
};

function fixtureEvidence(
  url: string,
  fields: string[]
): OfficialSourceEvidence {
  const host = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return "fixture.local";
    }
  })();
  return {
    sourceUrl: url,
    sourceHost: host,
    sourceTier: 1,
    isOfficialBrandSource: true,
    evidenceKind: "fixture_offline",
    contentHash: contentHash(url),
    fetchedAt: null,
    verifiedFields: fields,
    liveVerified: false,
  };
}

export const PRODUCT_AUTOMATION_FIXTURES: ProductAutomationFixture[] = [
  {
    fixtureId: "fx-mascara-curl-wp",
    categoryHint: "mascara",
    product: {
      brandRaw: "ETUDE",
      brandCanonical: "ETUDE",
      productNameRaw: "Lash Perm Curl Fix Mascara Waterproof",
      productNameEn: "Lash Perm Curl Fix Mascara Waterproof",
      productNameKo: "래쉬팜 컬픽스 마스카라 워터프루프",
      categoryRaw: "mascara",
      categoryCanonical: "mascara",
      productType: "mascara",
      sizeValue: 8,
      sizeUnit: "g",
      descriptionRaw: "curl volume longlash waterproof mascara",
      imageUrls: ["https://www.etude.com/fixture/mascara-curl.png"],
      primaryImageUrl: "https://www.etude.com/fixture/mascara-curl.png",
      officialProductUrl: "https://www.etude.com/fixture/mascara-curl",
      barcode: "8800000001001",
      sku: "ETUDE-MSC-CURL-WP",
      sourceUrls: ["https://www.etude.com/fixture/mascara-curl"],
      sourceTier: 1,
    },
    ingredientsRaw:
      "Aqua, Synthetic Beeswax, Copernicia Cerifera Cera, Iron Oxides, Glycerin, Panthenol",
    offers: [
      {
        retailerNameRaw: "ETUDE Official KR",
        retailerNameCanonical: "ETUDE",
        countryCode: "KR",
        currency: "KRW",
        price: 15000,
        inStock: true,
        shipsTo: ["KR"],
        purchaseUrl: "https://www.etude.com/fixture/mascara-curl",
        isOfficialStore: true,
        isAuthorizedRetailer: true,
        sourceVerified: false,
      },
    ],
    evidence: [
      fixtureEvidence("https://www.etude.com/fixture/mascara-curl", [
        "brand",
        "name",
        "size",
        "image",
        "inci",
      ]),
    ],
    usageMediaUrl: "https://www.etude.com/fixture/mascara-curl-howto.mp4",
  },
  {
    fixtureId: "fx-lip-cool-matte",
    categoryHint: "lip",
    product: {
      brandRaw: "PERIPERA",
      brandCanonical: "PERIPERA",
      productNameRaw: "Ink Velvet Cool Tone Matte Tint",
      productNameEn: "Ink Velvet Cool Tone Matte Tint",
      productNameKo: "잉크 벨벳 쿨톤 매트 틴트",
      categoryRaw: "lip_tint",
      categoryCanonical: "lip_tint",
      productType: "lip_tint",
      sizeValue: 4,
      sizeUnit: "g",
      finish: "matte",
      shadeFamily: "pink",
      descriptionRaw: "cool undertone matte stain tint",
      imageUrls: ["https://www.peripera.com/fixture/lip-cool-matte.png"],
      primaryImageUrl: "https://www.peripera.com/fixture/lip-cool-matte.png",
      officialProductUrl: "https://www.peripera.com/fixture/lip-cool-matte",
      barcode: "8800000002002",
      sku: "PERI-LIP-COOL-01",
      sourceUrls: ["https://www.peripera.com/fixture/lip-cool-matte"],
      sourceTier: 1,
    },
    ingredientsRaw:
      "Aqua, Dimethicone, Caprylic/Capric Triglyceride, Red 7 Lake, Fragrance",
    offers: [
      {
        retailerNameRaw: "PERIPERA Official",
        countryCode: "KR",
        currency: "KRW",
        price: 12000,
        inStock: true,
        shipsTo: ["KR"],
        purchaseUrl: "https://www.peripera.com/fixture/lip-cool-matte",
        isOfficialStore: true,
        isAuthorizedRetailer: true,
        sourceVerified: false,
      },
    ],
    evidence: [
      fixtureEvidence("https://www.peripera.com/fixture/lip-cool-matte", [
        "brand",
        "name",
        "shade",
        "image",
        "inci",
      ]),
    ],
    usageMediaUrl: null,
  },
  {
    fixtureId: "fx-shampoo-sensitive-scalp",
    categoryHint: "shampoo_scalp",
    product: {
      brandRaw: "mise en scène",
      brandCanonical: "mise en scène",
      productNameRaw: "Sensitive Scalp Mild Shampoo",
      productNameEn: "Sensitive Scalp Mild Shampoo",
      productNameKo: "민감 두피 마일드 샴푸",
      categoryRaw: "sensitive_scalp_shampoo",
      categoryCanonical: "sensitive_scalp_shampoo",
      productType: "shampoo",
      sizeValue: 500,
      sizeUnit: "ml",
      descriptionRaw: "sensitive scalp mild shampoo anti itch",
      imageUrls: ["https://www.miseenscene.com/fixture/sensitive-shampoo.png"],
      primaryImageUrl:
        "https://www.miseenscene.com/fixture/sensitive-shampoo.png",
      officialProductUrl:
        "https://www.miseenscene.com/fixture/sensitive-shampoo",
      barcode: "8800000003003",
      sku: "MISE-SCALP-SENS-500",
      sourceUrls: ["https://www.miseenscene.com/fixture/sensitive-shampoo"],
      sourceTier: 1,
    },
    ingredientsRaw:
      "Aqua, Sodium Laureth Sulfate, Cocamidopropyl Betaine, Panthenol, Glycerin, Menthol",
    offers: [
      {
        retailerNameRaw: "mise en scène Official",
        countryCode: "KR",
        currency: "KRW",
        price: 18000,
        inStock: true,
        shipsTo: ["KR"],
        purchaseUrl: "https://www.miseenscene.com/fixture/sensitive-shampoo",
        isOfficialStore: true,
        isAuthorizedRetailer: true,
        sourceVerified: false,
      },
    ],
    evidence: [
      fixtureEvidence(
        "https://www.miseenscene.com/fixture/sensitive-shampoo",
        ["brand", "name", "size", "image", "inci"]
      ),
    ],
    usageMediaUrl:
      "https://www.miseenscene.com/fixture/sensitive-shampoo-howto.mp4",
  },
  {
    fixtureId: "fx-mascara-dup-size",
    categoryHint: "mascara",
    product: {
      brandRaw: "ETUDE",
      brandCanonical: "ETUDE",
      productNameRaw: "Lash Perm Curl Fix Mascara Waterproof",
      productNameEn: "Lash Perm Curl Fix Mascara Waterproof",
      productNameKo: "래쉬팜 컬픽스 마스카라 워터프루프",
      categoryRaw: "mascara",
      categoryCanonical: "mascara",
      productType: "mascara",
      sizeValue: 4,
      sizeUnit: "g",
      descriptionRaw: "curl waterproof mascara mini",
      imageUrls: ["https://www.etude.com/fixture/mascara-curl-mini.png"],
      primaryImageUrl: "https://www.etude.com/fixture/mascara-curl-mini.png",
      officialProductUrl: "https://www.etude.com/fixture/mascara-curl-mini",
      barcode: "8800000001002",
      sku: "ETUDE-MSC-CURL-WP-MINI",
      sourceUrls: ["https://www.etude.com/fixture/mascara-curl-mini"],
      sourceTier: 1,
    },
    ingredientsRaw:
      "Aqua, Synthetic Beeswax, Copernicia Cerifera Cera, Iron Oxides, Glycerin",
    offers: [
      {
        retailerNameRaw: "ETUDE Official KR",
        countryCode: "KR",
        currency: "KRW",
        price: 9000,
        inStock: true,
        shipsTo: ["KR"],
        purchaseUrl: "https://www.etude.com/fixture/mascara-curl-mini",
        isOfficialStore: true,
        isAuthorizedRetailer: true,
        sourceVerified: false,
      },
    ],
    evidence: [
      fixtureEvidence("https://www.etude.com/fixture/mascara-curl-mini", [
        "brand",
        "name",
        "size",
      ]),
    ],
    usageMediaUrl: null,
  },
];

export function parseFixtureIngredients(
  fixture: ProductAutomationFixture
): ParsedIngredientSource {
  return parseOfficialIngredientsRaw({
    ingredientsRaw: fixture.ingredientsRaw,
    sourceUrl: fixture.product.officialProductUrl ?? fixture.evidence[0]!.sourceUrl,
    sourceType: "fixture_offline",
    sourceTier: 1,
    sourceVerified: false,
  });
}

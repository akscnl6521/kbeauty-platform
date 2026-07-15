/**
 * Curated official PDP URL overrides — only hand-verified sources.
 * Used when Shopify-style /products/ paths 404 but Korean official mall URLs exist.
 */

export type OfficialUrlOverride = {
  externalProductIdPrefix?: string;
  nameIncludes?: string[];
  brandId: string;
  officialUrl: string;
  sourceNote: string;
};

export const OFFICIAL_URL_OVERRIDES: OfficialUrlOverride[] = [
  {
    brandId: "cosrx",
    externalProductIdPrefix: "cosrx-advanced-snail-96",
    nameIncludes: ["snail 96", "스네일 96"],
    officialUrl: "https://www.cosrx.co.kr/shop/shopdetail.html?branduid=196",
    sourceNote: "cosrx-products.json verifiedOfficialNames",
  },
  {
    brandId: "cosrx",
    externalProductIdPrefix: "cosrx-advanced-snail-92",
    nameIncludes: ["snail 92", "스네일 92"],
    officialUrl: "https://www.cosrx.co.kr/shop/shopdetail.html?branduid=202",
    sourceNote: "cosrx-products.json verifiedOfficialNames",
  },
  {
    brandId: "cosrx",
    externalProductIdPrefix: "cosrx-one-step-original-blemish",
    nameIncludes: ["blemish clear pad", "블레미쉬", "one step original"],
    officialUrl:
      "https://www.cosrx.co.kr/shop/shopdetail.html?branduid=1177512",
    sourceNote: "cosrx-products.json verified sourceUrl",
  },
];

export function resolveOfficialUrlOverride(input: {
  brandIdHint: string;
  externalProductId: string;
  nameRaw: string;
}): OfficialUrlOverride | null {
  const name = input.nameRaw.toLowerCase();
  const id = input.externalProductId.toLowerCase();
  for (const row of OFFICIAL_URL_OVERRIDES) {
    if (row.brandId !== input.brandIdHint) continue;
    if (
      row.externalProductIdPrefix &&
      id.startsWith(row.externalProductIdPrefix.toLowerCase())
    ) {
      return row;
    }
    if (
      row.nameIncludes?.some((n) => name.includes(n.toLowerCase()))
    ) {
      return row;
    }
  }
  return null;
}

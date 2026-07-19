import assert from "node:assert/strict";
import { compareProductIdentity } from "@/lib/catalog/automation/productIdentity";
import type { ParsedCatalogProduct } from "@/lib/catalog/automation/types";

function product(input: Partial<ParsedCatalogProduct>): ParsedCatalogProduct {
  return {
    brandRaw: "COSRX",
    productNameRaw: "Advanced Snail 96 Mucin Power Essence",
    imageUrls: [],
    sourceUrls: ["https://www.cosrx.com/product"],
    sourceTier: 1,
    ...input,
  };
}

assert.equal(
  compareProductIdentity(
    product({ gtin: "8809416470001", sizeValue: 100, sizeUnit: "ml" }),
    product({ gtin: "880-941647-0001", sizeValue: 80, sizeUnit: "ml" })
  ).kind,
  "exact_duplicate"
);

assert.equal(
  compareProductIdentity(
    product({ sku: "COSRX-SNAIL-96", sizeValue: 100, sizeUnit: "ml" }),
    product({ sku: "cosrx snail 96", sizeValue: 100, sizeUnit: "ml" })
  ).kind,
  "exact_duplicate"
);

assert.equal(
  compareProductIdentity(
    product({ sizeValue: 100, sizeUnit: "ml" }),
    product({ productNameRaw: "NEW Advanced Snail 96 Mucin Power Essence", sizeValue: 100, sizeUnit: "milliliters" })
  ).kind,
  "exact_duplicate"
);

assert.equal(
  compareProductIdentity(
    product({ sizeValue: 100, sizeUnit: "ml" }),
    product({ sizeValue: 30, sizeUnit: "ml" })
  ).kind,
  "same_product_different_size"
);

assert.equal(
  compareProductIdentity(
    product({ productNameRaw: "Advanced Snail 96 Mucin Power Essence", sizeValue: 100, sizeUnit: "ml" }),
    product({ productNameRaw: "Advanced Snail Mucin Essence Renewal", sizeValue: 100, sizeUnit: "ml" })
  ).kind,
  "renewal_suspect"
);

assert.equal(
  compareProductIdentity(
    product({}),
    product({ brandRaw: "Beauty of Joseon", brandCanonical: "Beauty of Joseon" })
  ).kind,
  "distinct"
);

console.log("product-identity-selftest: ok");

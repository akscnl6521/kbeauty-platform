import assert from "node:assert/strict";
import {
  buildFixtureDocument,
  parseJsonLdOffers,
  parseJsonLdProductDocument,
} from "@/lib/catalog/automation/jsonLdParser";

const document = buildFixtureDocument({
  url: "https://brand.example/products/barrier-cream",
  json: {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        name: "Barrier Cream",
        brand: { "@type": "Brand", name: "Example" },
        image: [
          "https://cdn.example/product.jpg",
          "http://cdn.example/insecure.jpg",
          "https://cdn.example/product.jpg",
        ],
        offers: {
          "@type": "AggregateOffer",
          lowPrice: "23000",
          priceCurrency: "KRW",
          offers: [
            {
              "@type": "Offer",
              price: "23,000원",
              priceCurrency: "KRW",
              availability: "https://schema.org/InStock",
              url: "/products/barrier-cream",
              seller: { "@type": "Organization", name: "Example 공식몰" },
            },
            {
              "@type": "Offer",
              price: "23,000원",
              priceCurrency: "KRW",
              availability: "https://schema.org/InStock",
              url: "/products/barrier-cream",
              seller: { "@type": "Organization", name: "Example 공식몰" },
            },
            {
              "@type": "Offer",
              price: "0",
              priceCurrency: "KRW",
              url: "https://brand.example/free",
            },
          ],
        },
      },
    ],
  },
});

const product = parseJsonLdProductDocument(document);
assert.ok(product);
assert.deepEqual(product.imageUrls, ["https://cdn.example/product.jpg"]);

const offers = parseJsonLdOffers(document, product);
assert.equal(offers.length, 1);
assert.equal(offers[0]?.price, 23000);
assert.equal(offers[0]?.currency, "KRW");
assert.equal(offers[0]?.countryCode, "KR");
assert.equal(offers[0]?.inStock, true);
assert.equal(
  offers[0]?.purchaseUrl,
  "https://brand.example/products/barrier-cream"
);

console.log("jsonld-offer-extraction-selftest: ok");

/**
 * Non-public onboarding fixtures for P2-T04 dry-run eligibility tests.
 * Never claim as live official catalog or publishable clinics.
 */

import { buildProvenanceRecord } from "./fieldProvenance";
import type { DryRunRowInput } from "./types";

const FRESH = "2026-07-20T00:00:00.000Z";
const STALE = "2025-01-01T00:00:00.000Z";

/** Complete product fixture — non-public only. */
export function fixtureKoreanProductComplete(): DryRunRowInput {
  return {
    rowId: "fx-kr-product-complete",
    lane: "korean_product",
    isFixture: true,
    sourceKind: "fixture_offline",
    sourceUrl: "https://fixture.local/products/toner",
    accessMode: "offline_fixture",
    lastVerifiedAt: FRESH,
    fields: {
      brand: "FixtureBrand",
      product_name: "Fixture Toner 150ml",
      size: "150ml",
      full_ingredients: "Water, Glycerin, Niacinamide",
      official_source_url: "https://fixture.local/products/toner",
      source_kind: "fixture_offline",
      sale_page_url: "",
      price: "",
      country: "KR",
    },
    provenance: [
      buildProvenanceRecord({
        fieldKey: "brand",
        valuePreview: "FixtureBrand",
        sourceKind: "fixture_offline",
        sourceUrl: "https://fixture.local/products/toner",
        status: "unverified",
        verifiedAt: FRESH,
      }),
      buildProvenanceRecord({
        fieldKey: "product_name",
        valuePreview: "Fixture Toner 150ml",
        sourceKind: "fixture_offline",
        sourceUrl: "https://fixture.local/products/toner",
        status: "unverified",
        verifiedAt: FRESH,
      }),
      buildProvenanceRecord({
        fieldKey: "full_ingredients",
        valuePreview: "Water, Glycerin, Niacinamide",
        sourceKind: "fixture_offline",
        sourceUrl: "https://fixture.local/products/toner",
        status: "unverified",
        verifiedAt: FRESH,
      }),
      buildProvenanceRecord({
        fieldKey: "official_source_url",
        valuePreview: "https://fixture.local/products/toner",
        sourceKind: "fixture_offline",
        sourceUrl: "https://fixture.local/products/toner",
        status: "unverified",
        verifiedAt: FRESH,
      }),
    ],
  };
}

/**
 * Dry-run shape of a would-be official KR product.
 * Not live-verified — used only to exercise eligibility gates.
 */
export function dryRunOfficialKoreanProductReady(): DryRunRowInput {
  return {
    rowId: "dry-kr-product-official",
    lane: "korean_product",
    isFixture: false,
    sourceKind: "official_product_page",
    sourceUrl: "https://brand.example/products/toner",
    accessMode: "public_https",
    lastVerifiedAt: FRESH,
    fields: {
      brand: "ExampleBrand",
      product_name: "Hydrating Toner 150ml",
      size: "150ml",
      full_ingredients: "Water, Glycerin, Panthenol",
      official_source_url: "https://brand.example/products/toner",
      source_kind: "official_product_page",
      sale_page_url: "https://brand.example/products/toner",
      price: "",
      country: "KR",
    },
    provenance: [
      buildProvenanceRecord({
        fieldKey: "brand",
        valuePreview: "ExampleBrand",
        sourceKind: "official_brand_site",
        sourceUrl: "https://brand.example",
        status: "verified",
        verifiedAt: FRESH,
      }),
      buildProvenanceRecord({
        fieldKey: "product_name",
        valuePreview: "Hydrating Toner 150ml",
        sourceKind: "official_product_page",
        sourceUrl: "https://brand.example/products/toner",
        status: "verified",
        verifiedAt: FRESH,
      }),
      buildProvenanceRecord({
        fieldKey: "full_ingredients",
        valuePreview: "Water, Glycerin, Panthenol",
        sourceKind: "official_inci_label",
        sourceUrl: "https://brand.example/products/toner#inci",
        status: "verified",
        verifiedAt: FRESH,
      }),
      buildProvenanceRecord({
        fieldKey: "official_source_url",
        valuePreview: "https://brand.example/products/toner",
        sourceKind: "official_product_page",
        sourceUrl: "https://brand.example/products/toner",
        status: "verified",
        verifiedAt: FRESH,
      }),
    ],
  };
}

/** Marketplace-only — must reject (official priority). */
export function dryRunMarketplaceOnlyProduct(): DryRunRowInput {
  return {
    rowId: "dry-kr-marketplace-only",
    lane: "korean_product",
    isFixture: false,
    sourceKind: "marketplace_listing",
    sourceUrl: "https://market.example/item/1",
    accessMode: "public_https",
    lastVerifiedAt: FRESH,
    fields: {
      brand: "MarketBrand",
      product_name: "Unknown Serum",
      full_ingredients: "",
      official_source_url: "",
      source_kind: "marketplace_listing",
      sale_page_url: "https://market.example/item/1",
      price: "TBD",
    },
    provenance: [
      buildProvenanceRecord({
        fieldKey: "brand",
        valuePreview: "MarketBrand",
        sourceKind: "marketplace_listing",
        status: "unverified",
      }),
      buildProvenanceRecord({
        fieldKey: "product_name",
        status: "missing",
      }),
      buildProvenanceRecord({
        fieldKey: "full_ingredients",
        status: "missing",
      }),
      buildProvenanceRecord({
        fieldKey: "official_source_url",
        status: "missing",
      }),
    ],
  };
}

/** Paid API access — must block. */
export function dryRunPaidApiBlockedProduct(): DryRunRowInput {
  const base = dryRunOfficialKoreanProductReady();
  return {
    ...base,
    rowId: "dry-kr-paid-api-blocked",
    accessMode: "blocked_paid_api",
  };
}

/** Invented price — must reject. */
export function dryRunInventedPriceProduct(): DryRunRowInput {
  const base = dryRunOfficialKoreanProductReady();
  return {
    ...base,
    rowId: "dry-kr-invented-price",
    fields: {
      ...base.fields,
      price: "invented",
      invented: "true",
    },
  };
}

export function fixtureClinicComplete(): DryRunRowInput {
  return {
    rowId: "fx-clinic-complete",
    lane: "clinic_professional",
    isFixture: true,
    sourceKind: "fixture_offline",
    sourceUrl: "https://fixture-clinic.example/ko",
    accessMode: "offline_fixture",
    lastVerifiedAt: FRESH,
    fields: {
      clinic_name: "Fixture Skin Clinic",
      specialties: "dermatology",
      symptom_tags: "redness",
      address: "Seoul Fixture District",
      operating_hours: "Mon-Fri 10-18",
      official_site_url: "https://fixture-clinic.example/ko",
      booking_url: "",
      languages: "ko;en",
      is_partner: "false",
      partnership_disclosure: "",
      source_kind: "fixture_offline",
      evidence_verified_at: FRESH,
    },
    provenance: [
      buildProvenanceRecord({
        fieldKey: "clinic_name",
        valuePreview: "Fixture Skin Clinic",
        sourceKind: "fixture_offline",
        status: "unverified",
        verifiedAt: FRESH,
      }),
      buildProvenanceRecord({
        fieldKey: "specialties",
        valuePreview: "dermatology",
        sourceKind: "fixture_offline",
        status: "unverified",
        verifiedAt: FRESH,
      }),
      buildProvenanceRecord({
        fieldKey: "address",
        valuePreview: "Seoul Fixture District",
        sourceKind: "fixture_offline",
        status: "unverified",
        verifiedAt: FRESH,
      }),
      buildProvenanceRecord({
        fieldKey: "operating_hours",
        valuePreview: "Mon-Fri 10-18",
        sourceKind: "fixture_offline",
        status: "unverified",
        verifiedAt: FRESH,
      }),
      buildProvenanceRecord({
        fieldKey: "official_site_url",
        valuePreview: "https://fixture-clinic.example/ko",
        sourceKind: "fixture_offline",
        status: "unverified",
        verifiedAt: FRESH,
      }),
      buildProvenanceRecord({
        fieldKey: "symptom_tags",
        valuePreview: "redness",
        sourceKind: "fixture_offline",
        status: "unverified",
        verifiedAt: FRESH,
      }),
    ],
  };
}

export function dryRunOfficialClinicReady(): DryRunRowInput {
  return {
    rowId: "dry-clinic-official",
    lane: "clinic_professional",
    isFixture: false,
    sourceKind: "clinic_official_site",
    sourceUrl: "https://clinic.example",
    accessMode: "public_https",
    lastVerifiedAt: FRESH,
    fields: {
      clinic_name: "Example Dermatology",
      specialties: "dermatology;allergy",
      symptom_tags: "redness;irritation",
      address: "Seoul, Gangnam",
      operating_hours: "Mon-Fri 10-19",
      official_site_url: "https://clinic.example",
      booking_url: "https://clinic.example/book",
      languages: "ko;en",
      is_partner: "false",
      partnership_disclosure: "",
      source_kind: "clinic_official_site",
      evidence_verified_at: FRESH,
    },
    provenance: [
      buildProvenanceRecord({
        fieldKey: "clinic_name",
        valuePreview: "Example Dermatology",
        sourceKind: "clinic_official_site",
        sourceUrl: "https://clinic.example",
        status: "verified",
        verifiedAt: FRESH,
      }),
      buildProvenanceRecord({
        fieldKey: "specialties",
        valuePreview: "dermatology;allergy",
        sourceKind: "clinic_official_site",
        status: "verified",
        verifiedAt: FRESH,
      }),
      buildProvenanceRecord({
        fieldKey: "address",
        valuePreview: "Seoul, Gangnam",
        sourceKind: "clinic_official_site",
        status: "verified",
        verifiedAt: FRESH,
      }),
      buildProvenanceRecord({
        fieldKey: "operating_hours",
        valuePreview: "Mon-Fri 10-19",
        sourceKind: "clinic_official_site",
        status: "verified",
        verifiedAt: FRESH,
      }),
      buildProvenanceRecord({
        fieldKey: "official_site_url",
        valuePreview: "https://clinic.example",
        sourceKind: "clinic_official_site",
        status: "verified",
        verifiedAt: FRESH,
      }),
      buildProvenanceRecord({
        fieldKey: "symptom_tags",
        valuePreview: "redness;irritation",
        sourceKind: "clinic_official_site",
        status: "verified",
        verifiedAt: FRESH,
      }),
    ],
  };
}

export function dryRunStaleClinicEvidence(): DryRunRowInput {
  const base = dryRunOfficialClinicReady();
  return {
    ...base,
    rowId: "dry-clinic-stale",
    lastVerifiedAt: STALE,
    fields: {
      ...base.fields,
      evidence_verified_at: STALE,
    },
  };
}

export function dryRunPartnerClinicMissingDisclosure(): DryRunRowInput {
  const base = dryRunOfficialClinicReady();
  return {
    ...base,
    rowId: "dry-clinic-partner-no-disclosure",
    fields: {
      ...base.fields,
      is_partner: "true",
      partnership_disclosure: "",
    },
  };
}

export function dryRunCaptchaBypassClinic(): DryRunRowInput {
  const base = dryRunOfficialClinicReady();
  return {
    ...base,
    rowId: "dry-clinic-captcha-blocked",
    accessMode: "blocked_captcha",
  };
}

export function allOnboardingFixtures(): DryRunRowInput[] {
  return [
    fixtureKoreanProductComplete(),
    dryRunOfficialKoreanProductReady(),
    dryRunMarketplaceOnlyProduct(),
    dryRunPaidApiBlockedProduct(),
    dryRunInventedPriceProduct(),
    fixtureClinicComplete(),
    dryRunOfficialClinicReady(),
    dryRunStaleClinicEvidence(),
    dryRunPartnerClinicMissingDisclosure(),
    dryRunCaptchaBypassClinic(),
  ];
}

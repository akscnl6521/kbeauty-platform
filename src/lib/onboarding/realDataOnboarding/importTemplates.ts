/**
 * Import templates for Korean products and clinic/professional listings.
 * Sample rows are non-public fixtures — never claim as live catalog data.
 */

import type { ImportTemplateDefinition } from "./types";

export const KOREAN_PRODUCT_IMPORT_TEMPLATE: ImportTemplateDefinition = {
  templateId: "kr-product-onboarding-v1",
  lane: "korean_product",
  format: "csv",
  publicClaimForbidden: true,
  columns: [
    {
      key: "brand",
      required: true,
      descriptionKo: "브랜드명",
      example: "ExampleBrand",
    },
    {
      key: "product_name",
      required: true,
      descriptionKo: "제품명",
      example: "Hydrating Toner 150ml",
    },
    {
      key: "size",
      required: false,
      descriptionKo: "용량",
      example: "150ml",
    },
    {
      key: "full_ingredients",
      required: true,
      descriptionKo: "전성분(INCI)",
      example: "Water, Glycerin, ...",
    },
    {
      key: "official_source_url",
      required: true,
      descriptionKo: "공식 출처 URL",
      example: "https://brand.example/products/toner",
    },
    {
      key: "source_kind",
      required: true,
      descriptionKo: "출처 종류",
      example: "official_product_page",
    },
    {
      key: "sale_page_url",
      required: false,
      descriptionKo: "판매 확인 URL(미확인 시 공란)",
      example: "",
    },
    {
      key: "price",
      required: false,
      descriptionKo: "가격(확인된 경우만 · 미발명)",
      example: "",
    },
    {
      key: "country",
      required: false,
      descriptionKo: "국가 코드",
      example: "KR",
    },
    {
      key: "notes",
      required: false,
      descriptionKo: "검수 메모",
      example: "라벨 사진 대기",
    },
  ],
  headerRow:
    "brand,product_name,size,full_ingredients,official_source_url,source_kind,sale_page_url,price,country,notes",
  sampleRows: [
    [
      "FixtureBrand",
      "Fixture Toner 150ml",
      "150ml",
      "Water, Glycerin, Niacinamide",
      "https://fixture.local/products/toner",
      "fixture_offline",
      "",
      "",
      "KR",
      "non-public fixture — do not publish",
    ],
  ],
};

export const CLINIC_PROFESSIONAL_IMPORT_TEMPLATE: ImportTemplateDefinition = {
  templateId: "clinic-professional-onboarding-v1",
  lane: "clinic_professional",
  format: "csv",
  publicClaimForbidden: true,
  columns: [
    {
      key: "clinic_name",
      required: true,
      descriptionKo: "병원/클리닉명",
      example: "Example Dermatology",
    },
    {
      key: "specialties",
      required: true,
      descriptionKo: "진료 분야(세미콜론 구분)",
      example: "dermatology;allergy",
    },
    {
      key: "symptom_tags",
      required: true,
      descriptionKo: "증상 태그",
      example: "redness;irritation",
    },
    {
      key: "address",
      required: true,
      descriptionKo: "주소",
      example: "Seoul, ...",
    },
    {
      key: "operating_hours",
      required: true,
      descriptionKo: "진료시간",
      example: "Mon-Fri 10-19",
    },
    {
      key: "official_site_url",
      required: true,
      descriptionKo: "공식 사이트 HTTPS",
      example: "https://clinic.example",
    },
    {
      key: "booking_url",
      required: false,
      descriptionKo: "예약 URL(확인된 경우만)",
      example: "https://clinic.example/book",
    },
    {
      key: "languages",
      required: true,
      descriptionKo: "지원 언어",
      example: "ko;en",
    },
    {
      key: "is_partner",
      required: false,
      descriptionKo: "제휴 여부 true/false",
      example: "false",
    },
    {
      key: "partnership_disclosure",
      required: false,
      descriptionKo: "제휴 고지(제휴 시 필수)",
      example: "",
    },
    {
      key: "source_kind",
      required: true,
      descriptionKo: "출처 종류",
      example: "clinic_official_site",
    },
    {
      key: "evidence_verified_at",
      required: true,
      descriptionKo: "근거 확인일(ISO)",
      example: "2026-07-01T00:00:00.000Z",
    },
  ],
  headerRow:
    "clinic_name,specialties,symptom_tags,address,operating_hours,official_site_url,booking_url,languages,is_partner,partnership_disclosure,source_kind,evidence_verified_at",
  sampleRows: [
    [
      "Fixture Skin Clinic",
      "dermatology",
      "redness",
      "Seoul Fixture District",
      "Mon-Fri 10-18",
      "https://fixture-clinic.example/ko",
      "",
      "ko;en",
      "false",
      "",
      "fixture_offline",
      "2026-07-01T00:00:00.000Z",
    ],
  ],
};

export const IMPORT_TEMPLATES: readonly ImportTemplateDefinition[] = [
  KOREAN_PRODUCT_IMPORT_TEMPLATE,
  CLINIC_PROFESSIONAL_IMPORT_TEMPLATE,
];

export function renderTemplateCsv(template: ImportTemplateDefinition): string {
  const lines = [template.headerRow, ...template.sampleRows.map((row) => row.join(","))];
  return `${lines.join("\n")}\n`;
}

export function assertImportTemplateIntegrity(): string[] {
  const errors: string[] = [];
  for (const template of IMPORT_TEMPLATES) {
    if (!template.publicClaimForbidden) {
      errors.push(`public_claim_allowed:${template.templateId}`);
    }
    const keys = template.columns.map((c) => c.key);
    const headerKeys = template.headerRow.split(",");
    if (keys.join(",") !== headerKeys.join(",")) {
      errors.push(`header_mismatch:${template.templateId}`);
    }
    for (const row of template.sampleRows) {
      if (row.length !== headerKeys.length) {
        errors.push(`sample_width:${template.templateId}`);
      }
    }
    const required = template.columns.filter((c) => c.required).map((c) => c.key);
    if (required.length === 0) {
      errors.push(`no_required_columns:${template.templateId}`);
    }
  }
  return errors;
}

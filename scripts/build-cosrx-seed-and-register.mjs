/**
 * Build COSRX official seed pack (≤10) and optionally register to Staging.
 * Does NOT write to Production. Never prints secrets.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "data/catalog-import/2026-07-cosrx-seed");
const IMG = path.join(OUT, "images");
const CHECKED_AT = "2026-07-14";

/** Official cosrx.com products — Snail 96 Mucin Essence excluded (already registered). */
const PRODUCTS = [
  {
    brand: "COSRX",
    product_name: "Low pH Good Morning Gel Cleanser",
    product_name_ko: "약산성 굿모닝 젤 클렌저",
    product_name_en: "Low pH Good Morning Gel Cleanser",
    slug: "cosrx-low-ph-good-morning-gel-cleanser",
    category: "foam_cleanser",
    target_areas: "face",
    description:
      "Mildly acidic gel cleanser that cleans without stripping. Official COSRX.com formulalisting.",
    full_ingredients:
      "Water, Cocamidopropyl Betaine, Sodium Lauroyl Methyl Isethionate, Sodium Chloride, Polysorbate 20, Styrax Japonicus Branch/Fruit/Leaf Extract, Butylene Glycol, Saccharomyces Ferment, Cryptomeria Japonica Leaf Extract, Nelumbo Nucifera Leaf Extract, Pinus Palustris Leaf Extract, Ulmus Davidiana Root Extract, Oenothera Biennis (Evening Primrose) Flower Extract, Pueraria Lobata Root Extract, Melaleuca Alternifolia (Tea Tree) Leaf Oil, Allantoin, Caprylyl Glycol, Ethylhexylglycerin, Betaine Salicylate, Citric Acid, Ethyl Hexanediol, 1,2-Hexanediol, Trisodium Ethylenediamine Disuccinate, Sodium Benzoate, Disodium EDTA",
    size: "150ml",
    usage: "Morning and night after makeup removal; rinse with warm water.",
    warnings: "",
    source_url: "https://www.cosrx.com/products/low-ph-good-morning-gel-cleanser",
    source_type: "official_brand_page",
    image_url:
      "https://www.cosrx.com/cdn/shop/files/low-ph-good-morning-gel-cleanser-cosrx-official-1.jpg?v=1768785801",
    country: "KR",
    verified: "true",
    active: "true",
    data_confidence: "high",
    needs_review: false,
  },
  {
    brand: "COSRX",
    product_name: "AHA/BHA Clarifying Treatment Toner",
    product_name_ko: "AHA BHA 클라리파잉 트리트먼트 토너",
    product_name_en: "AHA/BHA Clarifying Treatment Toner",
    slug: "cosrx-aha-bha-clarifying-treatment-toner",
    category: "toner",
    target_areas: "face",
    description:
      "AHA+BHA clarifying toner for texture and pores. Official COSRX.com full ingredients.",
    full_ingredients:
      "Water, Salix Alba (Willow) Bark Water, Pyrus Malus (Apple) Fruit Water, Butylene Glycol, 1,2-Hexanediol, Sodium Lactate, Glycolic Acid, Betaine Salicylate, Allantoin, Panthenol, Ethyl Hexanediol",
    size: "150ml",
    usage: "After cleansing, wipe with cotton pad; use sunscreen in daytime.",
    warnings:
      "Avoid combining with other acids/retinols/vitamin C; avoid during pregnancy/breastfeeding.",
    source_url: "https://www.cosrx.com/products/aha-bha-clarifying-treatment-toner",
    source_type: "official_brand_page",
    image_url:
      "https://www.cosrx.com/cdn/shop/files/ahabha-clarifying-treatment-toner-cosrx-official-1.jpg?v=1724835581",
    country: "KR",
    verified: "true",
    active: "true",
    data_confidence: "high",
    needs_review: false,
  },
  {
    brand: "COSRX",
    product_name: "Hydrium Watery Toner",
    product_name_ko: "하이드리움 워터리 토너",
    product_name_en: "Hydrium Watery Toner",
    slug: "cosrx-hydrium-watery-toner",
    category: "toner",
    target_areas: "face",
    description:
      "Hydrating watery toner with panthenol and multi hyaluronic acids. Official COSRX.com.",
    full_ingredients:
      "Water, Butylene Glycol, Glycerin, 1,2-Hexanediol, Allantoin, Panthenol, Sodium Hyaluronate, Pentylene Glycol, Sodium hyaluronate Crosspolymer, Hydrolyzed Hyaluronic Acid, Hyaluronic Acid, Ethylhexylglycerin, Hydrolyzed Sodium Hyaluronate",
    size: "150ml",
    usage: "First step after cleansing; pat for absorption.",
    warnings: "",
    source_url: "https://www.cosrx.com/products/hydrium-watery-toner",
    source_type: "official_brand_page",
    image_url:
      "https://www.cosrx.com/cdn/shop/files/hydrium-watery-toner-cosrx-official-1.jpg?v=1724836011",
    country: "KR",
    verified: "true",
    active: "true",
    data_confidence: "high",
    needs_review: false,
  },
  {
    brand: "COSRX",
    product_name: "The Niacinamide 15 Serum",
    product_name_ko: "더 나이아신아마이드 15 세럼",
    product_name_en: "The Niacinamide 15 Serum",
    slug: "cosrx-the-niacinamide-15-serum",
    category: "serum",
    target_areas: "face",
    description:
      "15% niacinamide serum with zinc PCA for sebum and pores. Official COSRX.com.",
    full_ingredients:
      "Water, Pentylene Glycol, Niacinamide(15%), Butylene Glycol, Acetyl Glucosamine, 1,2-Hexanediol, Zinc PCA, Trehalose, Xanthan Gum, Pullulan, Allantoin, Ethylhexylglycerin, Sodium Phytate, Citric Acid, Tocopherol",
    size: "20ml",
    usage: "After toner, apply a few drops; use SPF daytime. Patch test recommended.",
    warnings: "Prefer not layering same-time with strong AHA/BHA, vitamin C, or retinol.",
    source_url: "https://www.cosrx.com/products/the-niacinamide-15-serum",
    source_type: "official_brand_page",
    image_url: "https://www.cosrx.com/cdn/shop/files/niacin.png?v=1748420816",
    country: "KR",
    verified: "true",
    active: "true",
    data_confidence: "high",
    needs_review: false,
  },
  {
    brand: "COSRX",
    product_name: "Advanced The Vitamin C 23 Serum",
    product_name_ko: "어드밴스드 더 비타민C 23 세럼",
    product_name_en: "Advanced The Vitamin C 23 Serum",
    slug: "cosrx-advanced-the-vitamin-c-23-serum",
    category: "serum",
    target_areas: "face",
    description:
      "23% ascorbic acid brightening serum. Official COSRX.com ingredient list.",
    full_ingredients:
      "Aqua/Water, Ascorbic Acid(23%), Butylene Glycol, Dimethicone, Panthenol, 3-O-Ethyl Ascorbic Acid, Squalane, Sodium Hydroxide, Caffeine, Sodium Hyaluronate, Sodium Metaphosphate, Adenosine, Acetyl Glucosamine, Gardenia Florida Fruit Extract, Allantoin, Dextrin, Tocotrienols, Tocopherol, Elaeis Guineensis (Palm) Oil, Arginine, Niacinamide, Pentylene Glycol, Glutathione, Helianthus Annuus (Sunflower) Seed Oil, Methyl Trimethicone, Carthamus Tinctorius (Safflower) Seed Oil, Camellia Japonica Seed Oil, Daucus Carota Sativa (Carrot) Root Extract, Glycyrrhiza Glabra (Licorice) Root Extract, Beta-Carotene",
    size: "20g",
    usage: "Use after cleansing; follow with moisturizer and SPF.",
    warnings: "High-strength vitamin C; store carefully; may separate oil layer by design.",
    source_url: "https://www.cosrx.com/products/cosrx-advanced-the-vitamin-c-23-serum",
    source_type: "official_brand_page",
    image_url:
      "https://www.cosrx.com/cdn/shop/files/01__AD_C_23_8998780b-3124-400e-95c8-b9a619cc13ca.jpg?v=1772785652",
    country: "KR",
    verified: "true",
    active: "true",
    data_confidence: "high",
    needs_review: false,
  },
  {
    brand: "COSRX",
    product_name: "The 6 Peptide Skin Booster Serum",
    product_name_ko: "더 6 펩타이드 스킨 부스터 세럼",
    product_name_en: "The 6 Peptide Skin Booster Serum",
    slug: "cosrx-the-6-peptide-skin-booster-serum",
    category: "serum",
    target_areas: "face",
    description:
      "Toner-like peptide booster with six peptides. Official COSRX.com.",
    full_ingredients:
      "Water, Dipropylene Glycol, Glycerin, Pentylene Glycol, 1,2-Hexanediol, Niacinamide, Acetyl Hexapeptide-8, Copper Tripeptide-1, sh-Polypeptide-121, Dipeptide Diaminobutyroyl Benzylamide Diacetate, Oligopeptide-68, Palmitoyl Tripeptide-8, Allantoin, Sodium Hyaluronate, Acetyl Glucosamine, Serine, Alanine, Glycine, Threonine, Arginine, Proline, Betaine, Sodium PCA, Sodium Lactate, PCA, Glutamic Acid, Lysine HCl, Tocopherol, Dextran, Glycine Soja (Soybean) Oil, Hydrogenated Lecithin, Ammonium Acryloyldimethyltaurate/VP Copolymer, Polyacrylate Crosspolymer-6, Butylene Glycol, Xanthan Gum, Ethylhexylglycerin, Adenosine, Polyquaternium-51, Disodium EDTA, Citric Acid, Caprylyl Glycol, t-Butyl Alcohol, Potassium Sorbate, Sodium Oleate",
    size: "150ml",
    usage: "After cleansing as first leave-on booster; pat gently.",
    warnings: "",
    source_url: "https://www.cosrx.com/products/the-6-peptide-skin-booster-serum",
    source_type: "official_brand_page",
    image_url:
      "https://www.cosrx.com/cdn/shop/files/1_23a79a66-a967-4533-9e71-cd88b0c6efb2.jpg?v=1724837008",
    country: "KR",
    verified: "true",
    active: "true",
    data_confidence: "high",
    needs_review: false,
  },
  {
    brand: "COSRX",
    product_name: "Advanced Snail 92 All in One Cream",
    product_name_ko: "어드밴스드 스네일 92 올인원 크림",
    product_name_en: "Advanced Snail 92 All in One Cream",
    slug: "cosrx-advanced-snail-92-all-in-one-cream",
    category: "cream",
    target_areas: "face",
    description:
      "92% snail secretion filtrate all-in-one cream. Official COSRX.com.",
    full_ingredients:
      "Snail Secretion Filtrate, Betaine, Caprylic/Capric Triglyceride, Butylene Glycol, Cetearyl Olivate, Sorbitan Olivate, Cetearyl Alcohol, Carbomer, Ethyl Hexanediol, Phenoxyethanol, Arginine, Dimethicone, Sodium Polyacrylate, Sodium Hyaluronate, Allantoin, Palmitic Acid, Panthenol, Xanthan Gum, Stearic acid, Adenosine, Water, Myristic Acid",
    size: "100g",
    usage: "After cleansing and toning, apply evenly and pat.",
    warnings: "",
    source_url: "https://www.cosrx.com/products/advanced-snail-92-all-in-one-cream",
    source_type: "official_brand_page",
    image_url:
      "https://www.cosrx.com/cdn/shop/files/advanced-snail-92-all-in-one-cream-cosrx-official-4.jpg?v=1762909943",
    country: "KR",
    verified: "true",
    active: "true",
    data_confidence: "high",
    needs_review: false,
  },
  {
    brand: "COSRX",
    product_name: "The Retinol 0.1 Cream",
    product_name_ko: "더 레티놀 0.1 크림",
    product_name_en: "The Retinol 0.1 Cream",
    slug: "cosrx-the-retinol-0-1-cream",
    category: "cream",
    target_areas: "face",
    description:
      "0.1% pure retinol cream for beginners. Official COSRX.com full ingredients.",
    full_ingredients:
      "Water, Caprylic/Capric Triglyceride, Propanediol, Glycerin, Tocopheryl Acetate, Cetearyl Alcohol, Trehalose, Panthenol, Butyrospermum Parkii (Shea) Butter, Glycine Soja (Soybean) Oil, Ammonium Acryloyldimethyltaurate/VP Copolymer, Dimethicone, Glyceryl Polymethacrylate, Helianthus Annuus (Sunflower) Seed Oil, Polyglyceryl-10 Stearate, Hydrogenated Lecithin, Hydroxyethyl Acrylate/Sodium Acryloyldimethyl Taurate Copolymer, Carbomer, Tromethamine, Glyceryl Stearate, Polysilicone-11, Sodium Sulfite, Tocopherol, Daucus Carota Sativa (Carrot) Root Extract, Retinol(0.1%), Allantoin, Glyceryl Caprylate, Oryza Sativa (Rice) Bran Wax, Tocotrienols, Stearic Acid, Polyglyceryl-3 Methylglucose Distearate, Palmitic Acid, Disodium EDTA, Ethylhexylglycerin, Adenosine, Sorbitan Isostearate, Elaeis Guineensis (Palm) Oil, BHT, Beta-Carotene, Myristic Acid, Lauric Acid, Ascorbic Acid, Limnanthes Alba (Meadowfoam) Seed Oil, 3-O-Ethyl Ascorbic Acid, Glutathione, Sodium Hyaluronate, 1,2-Hexanediol, Hydrolyzed Hyaluronic Acid, Sodium Hyaluronate Crosspolymer, Hyaluronic Acid, Sodium Acetylated Hyaluronate",
    size: "20ml",
    usage: "Night use; start every other day; build tolerance slowly.",
    warnings:
      "Avoid pregnancy/breastfeeding; use sunscreen; do not combine with strong exfoliants initially.",
    source_url: "https://www.cosrx.com/products/the-retinol-0-1-cream",
    source_type: "official_brand_page",
    image_url:
      "https://www.cosrx.com/cdn/shop/files/RetinolCream_800x1067_7e167f9b-dc45-4d41-babf-65b26b14cf23.jpg?v=1746679017",
    country: "KR",
    verified: "true",
    active: "true",
    data_confidence: "high",
    needs_review: false,
  },
  {
    brand: "COSRX",
    product_name: "Ultra-Light Invisible Sunscreen SPF50 PA++++",
    product_name_ko: "울트라 라이트 인비저블 선스크린 SPF50 PA++++",
    product_name_en: "Ultra-Light Invisible Sunscreen SPF50 PA++++",
    slug: "cosrx-ultra-light-invisible-sunscreen-spf50",
    category: "sunscreen",
    target_areas: "face",
    description:
      "Sheer chemical sunscreen SPF50 PA++++. Official COSRX.com full ingredients.",
    full_ingredients:
      "Aloe Barbadensis Leaf Water, Diethylhexyl Succinate, Propanediol, Aqua/Water, Drometrizole Trisiloxane, Ethylhexyl Triazone, Niacinamide, Diethylamino Hydroxybenzoyl Hexyl Benzoate, Terephthalylidene Dicamphor Sulfonic Acid, 1,2-Hexanediol, Behenyl Alcohol, Methyl Trimethicone, Sodium Polyacryloyldimethyl Taurate, Hamamelis Virginiana (Witch Hazel) Leaf Water, Tromethamine, Polyacrylate Crosspolymer-6, Arachidyl Alcohol, Caprylyl Glycol, Ethylhexylglycerin, Arachidyl Glucoside, Sodium Metaphosphate, Adenosine, Tocopherol, Sodium Hyaluronate, Allantoin, Citric Acid, Sodium Benzoate, Potassium Sorbate",
    size: "50ml",
    usage: "Apply before sun exposure; reapply after sweating/swimming.",
    warnings: "Listed sold out on cosrx.com at collection time; formula from official page.",
    source_url: "https://www.cosrx.com/products/ultra-light-invisible-sunscreen-spf50",
    source_type: "official_brand_page",
    image_url:
      "https://www.cosrx.com/cdn/shop/files/0_Ultra_light_invisible_800x1067_3b3f194c-15a5-4c66-92ec-58275778c6c9.jpg?v=1714098876",
    country: "KR",
    verified: "true",
    active: "true",
    data_confidence: "high",
    needs_review: true, // stock / regional availability note
  },
  {
    brand: "COSRX",
    product_name: "Full Fit Propolis Synergy Toner",
    product_name_ko: "풀핏 프로폴리스 시너지 토너",
    product_name_en: "Full Fit Propolis Synergy Toner",
    slug: "cosrx-full-fit-propolis-synergy-toner",
    category: "toner",
    target_areas: "face",
    description:
      "Propolis and honey boosting toner. Official COSRX.com.",
    full_ingredients:
      "Propolis Extract, Honey Extract, Butylene Glycol, 1,2-Hexanediol, Glycerin, Betaine, Cassia Obtusifolia Seed Extract, Panthenol, Polyglyceryl-10 Laurate, Polyglyceryl-10 Myristate, Ethylhexylglycerin, Sodium Hyaluronate, Hydroxyethyl Acrylate/Sodium Acryloyldimethyl Taurate Copolymer, Caprylic/Capric Triglyceride",
    size: "150ml",
    usage: "First step after cleansing.",
    warnings: "Bee-derived ingredients; allergy caution.",
    source_url: "https://www.cosrx.com/products/full-fit-propolis-synergy-toner",
    source_type: "official_brand_page",
    image_url:
      "https://www.cosrx.com/cdn/shop/files/full-fit-propolis-synergy-toner-cosrx-official-1.jpg?v=1724835800",
    country: "KR",
    verified: "true",
    active: "true",
    data_confidence: "medium",
    needs_review: true, // confirm image URL if download fails
  },
];

function csvEscape(v) {
  const s = String(v ?? "");
  return `"${s.replace(/"/g, '""')}"`;
}

async function downloadImage(url, destBase) {
  const res = await fetch(url, {
    headers: { Accept: "image/*", "User-Agent": "kbeauty-catalog-seed/1.0" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const mime = (res.headers.get("content-type") || "").split(";")[0].trim();
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0 || buf.length > 5 * 1024 * 1024) {
    throw new Error("bad_size");
  }
  if (!mime.startsWith("image/")) throw new Error("bad_mime");
  const ext =
    mime.includes("png")
      ? "png"
      : mime.includes("webp")
        ? "webp"
        : mime.includes("gif")
          ? "gif"
          : "jpg";
  const fileName = `${destBase}.${ext}`;
  fs.writeFileSync(path.join(IMG, fileName), buf);
  return {
    fileName,
    bytes: buf.length,
    hash: createHash("sha256").update(buf).digest("hex"),
    mime,
  };
}

async function main() {
  fs.mkdirSync(IMG, { recursive: true });
  const sources = [];
  const validationItems = [];
  const csvRows = [];
  const headers = [
    "brand",
    "product_name",
    "slug",
    "category",
    "target_areas",
    "full_ingredients",
    "description",
    "image_filename",
    "product_name_ko",
    "product_name_en",
    "product_name_ja",
    "country",
    "size",
    "usage",
    "warnings",
    "source_url",
    "source_type",
    "verified",
    "active",
    "image_url",
  ];

  const excluded = [
    {
      slug: "cosrx-advanced-snail-96-mucin-power-essence",
      reason: "Already registered / excluded by brief",
    },
  ];

  if (PRODUCTS.length > 10) throw new Error("Too many products");

  for (const p of PRODUCTS) {
    if (p.slug.includes("snail-96-mucin-power-essence")) {
      throw new Error("Forbidden duplicate snail 96 essence");
    }
    let imageMeta = null;
    let imageError = null;
    try {
      imageMeta = await downloadImage(p.image_url, p.slug);
    } catch (e) {
      imageError = String(e?.message || e);
      p.needs_review = true;
    }

    const image_filename = imageMeta?.fileName || "";
    csvRows.push({
      ...p,
      image_filename,
      product_name_ja: "",
    });

    sources.push({
      slug: p.slug,
      brand: p.brand,
      product_name: p.product_name,
      source_url: p.source_url,
      source_type: p.source_type,
      checked_at: CHECKED_AT,
      confidence: p.data_confidence,
      image_source_url: p.image_url,
      image_downloaded: Boolean(imageMeta),
      image_error: imageError,
      needs_review: p.needs_review,
    });

    const issues = [];
    if (!imageMeta) issues.push("image_missing_or_failed");
    if (!p.full_ingredients) issues.push("ingredients_missing");
    if (p.needs_review) issues.push("needs_review");
    validationItems.push({
      slug: p.slug,
      can_register: Boolean(imageMeta && p.full_ingredients && !p.needs_review),
      selectable_default: Boolean(imageMeta && p.full_ingredients && !p.needs_review),
      issues,
      ingredient_char_len: p.full_ingredients.length,
      image_bytes: imageMeta?.bytes || 0,
    });
  }

  // Prefer Propolis image fallback via official page pattern — if failed, leave needs_review
  const csv =
    headers.join(",") +
    "\n" +
    csvRows
      .map((r) =>
        [
          r.brand,
          r.product_name,
          r.slug,
          r.category,
          r.target_areas,
          r.full_ingredients,
          r.description,
          r.image_filename,
          r.product_name_ko,
          r.product_name_en,
          r.product_name_ja,
          r.country,
          r.size,
          r.usage,
          r.warnings,
          r.source_url,
          r.source_type,
          r.verified,
          r.active,
          "", // force ZIP matching; do not rely on public URL as canonical
        ]
          .map(csvEscape)
          .join(",")
      )
      .join("\n") +
    "\n";

  fs.writeFileSync(path.join(OUT, "products.csv"), csv, "utf8");
  fs.writeFileSync(
    path.join(OUT, "sources.json"),
    JSON.stringify({ checked_at: CHECKED_AT, products: sources, excluded }, null, 2),
    "utf8"
  );

  const zip = new JSZip();
  for (const f of fs.readdirSync(IMG)) {
    zip.file(f, fs.readFileSync(path.join(IMG, f)));
  }
  const zipBuf = await zip.generateAsync({ type: "nodebuffer" });
  fs.writeFileSync(path.join(OUT, "product-images.zip"), zipBuf);

  const ready = validationItems.filter((v) => v.can_register).length;
  const needsReview = validationItems.filter((v) =>
    v.issues.includes("needs_review")
  ).length;
  const imageMissing = validationItems.filter((v) =>
    v.issues.includes("image_missing_or_failed")
  ).length;

  const report = {
    checked_at: CHECKED_AT,
    brand: "COSRX",
    total: PRODUCTS.length,
    registerable: ready,
    needs_review: needsReview,
    image_missing: imageMissing,
    ingredients_missing: validationItems.filter((v) =>
      v.issues.includes("ingredients_missing")
    ).length,
    duplicates_excluded: excluded,
    forbidden_slug_blocked: ["cosrx-advanced-snail-96-mucin-power-essence"],
    productId_3_untouched: true,
    items: validationItems,
    files: {
      csv: "products.csv",
      zip: "product-images.zip",
      images_dir: "images/",
      sources: "sources.json",
    },
  };
  fs.writeFileSync(
    path.join(OUT, "validation-report.json"),
    JSON.stringify(report, null, 2),
    "utf8"
  );

  fs.writeFileSync(
    path.join(OUT, "README.md"),
    `# COSRX Seed Pack (2026-07)

## 기준
- 출처: cosrx.com 공식 제품 페이지 (확인일 ${CHECKED_AT})
- 제외: Advanced Snail 96 Mucin Power Essence (기존 등록)
- productId=3 변경·삭제 금지
- 외부 이미지 URL은 canonical로 쓰지 않음 → ZIP → private Storage

## 등록 방법
1. 관리자 → 제품 일괄등록
2. \`products.csv\` + \`product-images.zip\` 업로드 후 분석
3. needs_review / 이미지 실패 행은 선택 해제된 채 유지
4. Staging에만 등록

## 재검증
- \`validation-report.json\`의 registerable / needs_review 확인
- 같은 CSV 재실행 시 slug 중복 차단
`,
    "utf8"
  );

  console.log(
    JSON.stringify({
      phase: "files_ready",
      out: OUT,
      total: PRODUCTS.length,
      registerable: ready,
      needs_review: needsReview,
      image_missing: imageMissing,
      zip_bytes: zipBuf.length,
    })
  );
}

main().catch((e) => {
  console.error(JSON.stringify({ phase: "fatal", message: String(e?.message || e) }));
  process.exit(1);
});

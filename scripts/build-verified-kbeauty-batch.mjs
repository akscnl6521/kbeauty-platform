/**
 * Build offline verified KR product import bundle.
 * No DB writes. No invented prices/stock/INCI.
 * Staging write only if separate gate script allows (this script never writes).
 *
 * Usage: node scripts/build-verified-kbeauty-batch.mjs
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "imports", "verified-kbeauty-batch");
const imagesDir = path.join(outDir, "images");
const CHECKED_AT = "2026-07-18T10:00:00+09:00";
const PROD_REF = "rhfrmvkjsummaylpzmns";
const STAGING_REF = "jfnjufmldiqlgvgyugfd";

/** @typedef {"READY_FOR_REVIEW"|"REVIEW_REQUIRED"|"BLOCKED"|"DUPLICATE"} Status */

/**
 * Official KR mall snapshots collected 2026-07-18 (no invented fields).
 * stockEvidence: observed page signals only.
 */
const candidates = [
  {
    status: "READY_FOR_REVIEW",
    brand: "COSRX",
    product_name: "Low pH Good Morning Gel Cleanser",
    product_name_ko: "약산성 굿모닝 젤 클렌저",
    product_name_en: "Low pH Good Morning Gel Cleanser",
    slug: "cosrx-low-ph-good-morning-gel-cleanser-150ml",
    variant: "150ml",
    size: "150ml",
    category: "foam_cleanser",
    description:
      "약산성 젤 클렌저. COSRX 한국 공식몰(cosrx.co.kr) 상품정보 기준.",
    source_url:
      "http://www.cosrx.co.kr/shop/shopdetail.html?branduid=222",
    source_type: "official_brand_kr_mall",
    retailer: "COSRX Official KR Mall",
    purchase_url:
      "http://www.cosrx.co.kr/shop/shopdetail.html?branduid=222",
    price_krw: 7920,
    list_price_krw: 9900,
    stock_status: "in_stock",
    stock_evidence: "판매가·옵션 표시, 품절/구매불가 문구 없음 (2026-07-18)",
    image_url:
      "http://www.cosrx.co.kr/shopimages/cosrx/019000000591.jpg?1714461419",
    full_ingredients_ko:
      "정제수, 코카미도프로필베타인, 소듐라우로일메틸이세티오네이트, 소듐클로라이드, 폴리솔베이트20, 때죽나무가지/열매/잎추출물, 부틸렌글라이콜, 효모발효물, 삼나무잎추출물, 연꽃잎추출물, 대왕송잎추출물, 당느릅나무뿌리추출물, 달맞이꽃추출물, 칡뿌리추출물, 티트리잎오일, 알란토인, 카프릴릴글라이콜, 에틸헥실글리세린, 베타인살리실레이트, 시트릭애씨드, 에틸헥산다이올, 1,2-헥산다이올, 트라이소듐에틸렌다이아민다이석시네이트, 소듐벤조에이트, 다이소듐이디티에이",
    key_ingredients: ["Betaine Salicylate", "Melaleuca Alternifolia (Tea Tree) Leaf Oil", "Allantoin"],
    notes: "기존 seed slug와 유사 — KR offer·전성분 재확인 배치",
    seed_overlap: "cosrx-low-ph-good-morning-gel-cleanser",
  },
  {
    status: "READY_FOR_REVIEW",
    brand: "COSRX",
    product_name: "Full Fit Propolis Synergy Toner",
    product_name_ko: "풀핏 프로폴리스 시너지 토너",
    product_name_en: "Full Fit Propolis Synergy Toner",
    slug: "cosrx-full-fit-propolis-synergy-toner-280ml",
    variant: "280ml",
    size: "280ml",
    category: "toner",
    description: "프로폴리스 시너지 토너. COSRX 한국 공식몰 상품정보 기준.",
    source_url:
      "https://www.cosrx.co.kr/shop/shopdetail.html?branduid=1176488",
    source_type: "official_brand_kr_mall",
    retailer: "COSRX Official KR Mall",
    purchase_url:
      "https://www.cosrx.co.kr/shop/shopdetail.html?branduid=1176488",
    price_krw: 18500,
    list_price_krw: 22000,
    stock_status: "in_stock",
    stock_evidence: "판매가·옵션 표시, 품절 문구 없음 (2026-07-18)",
    image_url:
      "https://www.cosrx.co.kr/shopimages/cosrx/019000000661.jpg?1703729427",
    full_ingredients_ko:
      "정제수, 부틸렌글라이콜, 1,2-헥산다이올, 글리세린, 베타인, 프로폴리스추출물(7,645 ppm), 폴리글리세릴-10라우레이트, 판테놀, 폴리글리세릴-10미리스테이트, 꿀추출물, 에틸헥실글리세린, 소듐하이알루로네이트, 카프릴릭/카프릭트라이글리세라이드, 하이드록시에틸아크릴레이트/소듐아크릴로일다이메틸타우레이트코폴리머, 결명씨추출물, 솔비탄아이소스테아레이트, 폴리솔베이트60, 토코페롤",
    key_ingredients: ["Propolis Extract", "Panthenol", "Sodium Hyaluronate", "Honey Extract"],
    notes: "",
    seed_overlap: "cosrx-full-fit-propolis-synergy-toner",
  },
  {
    status: "READY_FOR_REVIEW",
    brand: "COSRX",
    product_name: "The Niacinamide 15 Serum",
    product_name_ko: "더 나이아신아마이드 15 세럼",
    product_name_en: "The Niacinamide 15 Serum",
    slug: "cosrx-the-niacinamide-15-serum-20ml",
    variant: "20ml",
    size: "20ml",
    category: "serum",
    description: "나이아신아마이드 15% 세럼. COSRX 한국 공식몰 상품정보 기준.",
    source_url:
      "https://www.cosrx.co.kr/shop/shopdetail.html?branduid=1177564",
    source_type: "official_brand_kr_mall",
    retailer: "COSRX Official KR Mall",
    purchase_url:
      "https://www.cosrx.co.kr/shop/shopdetail.html?branduid=1177564",
    price_krw: 20800,
    list_price_krw: 23000,
    stock_status: "in_stock",
    stock_evidence: "판매가·옵션 표시, 품절 문구 없음 (2026-07-18)",
    image_url:
      "https://www.cosrx.co.kr/shopimages/cosrx/019000000640.jpg?1722235788",
    full_ingredients_ko:
      "정제수, 펜틸렌글라이콜, 나이아신아마이드(15%), 부틸렌글라이콜, 아세틸글루코사민, 1,2-헥산다이올, 징크피씨에이, 트레할로오스, 잔탄검, 풀루란, 알란토인, 에틸헥실글리세린, 소듐파이테이트, 시트릭애씨드, 토코페롤",
    key_ingredients: ["Niacinamide", "Zinc PCA", "Acetyl Glucosamine", "Allantoin"],
    notes: "",
    seed_overlap: "cosrx-the-niacinamide-15-serum",
  },
  {
    status: "READY_FOR_REVIEW",
    brand: "COSRX",
    product_name: "Full Fit Propolis Light Ampoule",
    product_name_ko: "풀핏 프로폴리스 라이트 앰플",
    product_name_en: "Full Fit Propolis Light Ampoule",
    slug: "cosrx-full-fit-propolis-light-ampoule-30ml",
    variant: "30ml",
    size: "30ml",
    category: "essence",
    description: "프로폴리스 라이트 앰플. COSRX 한국 공식몰 상품정보 기준.",
    source_url:
      "https://www.cosrx.co.kr/shop/shopdetail.html?branduid=1176536",
    source_type: "official_brand_kr_mall",
    retailer: "COSRX Official KR Mall",
    purchase_url:
      "https://www.cosrx.co.kr/shop/shopdetail.html?branduid=1176536",
    price_krw: 20000,
    list_price_krw: 23500,
    stock_status: "in_stock",
    stock_evidence: "판매가·옵션 표시, 품절 문구 없음 (2026-07-18)",
    image_url:
      "https://www.cosrx.co.kr/shopimages/cosrx/019000000658.jpg?1703730437",
    full_ingredients_ko:
      "정제수, 부틸렌글라이콜, 글리세린, 베타인, 1,2-헥산다이올, 프로폴리스추출물(8,767 ppm), 소듐하이알루로네이트, 하이드록시에틸셀룰로오스, 카보머, 판테놀, 알지닌, 결명씨추출물",
    key_ingredients: ["Propolis Extract", "Sodium Hyaluronate", "Panthenol"],
    notes: "",
    seed_overlap: null,
  },
  {
    status: "READY_FOR_REVIEW",
    brand: "COSRX",
    product_name: "Advanced Snail 92 All In One Cream",
    product_name_ko: "어드벤스드 스네일 92 올인원 크림",
    product_name_en: "Advanced Snail 92 All In One Cream",
    slug: "cosrx-advanced-snail-92-all-in-one-cream-100g",
    variant: "100g jar/tube listing",
    size: "100g",
    category: "moisturizer",
    description:
      "스네일 92 올인원 크림. COSRX 한국 공식몰 상품정보 기준. 단지/튜브형 옵션 페이지.",
    source_url:
      "http://www.cosrx.co.kr/shop/shopdetail.html?branduid=202",
    source_type: "official_brand_kr_mall",
    retailer: "COSRX Official KR Mall",
    purchase_url:
      "http://www.cosrx.co.kr/shop/shopdetail.html?branduid=202",
    price_krw: 23000,
    list_price_krw: 23000,
    stock_status: "in_stock",
    stock_evidence: "판매가·옵션 표시, 품절 문구 없음 (2026-07-18)",
    image_url:
      "http://www.cosrx.co.kr/shopimages/cosrx/019000000650.jpg?1711329356",
    full_ingredients_ko:
      "달팽이점액여과물, 베타인, 카프릴릭/카프릭트라이글리세라이드, 세테아릴올리베이트, 솔비탄올리베이트, 세테아릴알코올, 카보머, 알지닌, 다이메티콘, 소듐폴리아크릴레이트, 페녹시에탄올, 소듐하이알루로네이트, 스테아릭애씨드, 알란토인, 판테놀, 잔탄검, 에틸헥산다이올, 아데노신",
    key_ingredients: ["Snail Secretion Filtrate", "Sodium Hyaluronate", "Panthenol", "Adenosine"],
    notes: "페이지 제목에 단지/튜브형 — import 시 variant 검수 필요",
    seed_overlap: "cosrx-advanced-snail-92-all-in-one-cream",
  },
  {
    status: "READY_FOR_REVIEW",
    brand: "COSRX",
    product_name: "Ultra-Light Invisible Sunserum SPF50+ PA++++",
    product_name_ko: "울트라 라이트 인비저블 선세럼",
    product_name_en: "Ultra-Light Invisible Sunserum SPF50+ PA++++",
    slug: "cosrx-ultra-light-invisible-sunserum-50ml",
    variant: "50ml",
    size: "50ml",
    category: "sunscreen",
    description: "울트라 라이트 인비저블 선세럼. COSRX 한국 공식몰 상품정보 기준.",
    source_url:
      "https://www.cosrx.co.kr/shop/shopdetail.html?branduid=1177686",
    source_type: "official_brand_kr_mall",
    retailer: "COSRX Official KR Mall",
    purchase_url:
      "https://www.cosrx.co.kr/shop/shopdetail.html?branduid=1177686",
    price_krw: 13000,
    list_price_krw: 15000,
    stock_status: "in_stock",
    stock_evidence: "판매가·옵션 표시, 품절 문구 없음 (2026-07-18)",
    image_url:
      "https://www.cosrx.co.kr/shopimages/cosrx/019000000670.jpg?1734659106",
    full_ingredients_ko:
      "알로에베라잎수, 다이에틸헥실석시네이트, 프로판다이올, 정제수, 드로메트리졸트리실록산, 에칠헥실트리아존, 나이아신아마이드, 디에칠아미노하이드록시벤조일헥실벤조에이트, 테레프탈릴리덴디캠퍼설포닉애씨드, 1,2-헥산다이올, 베헤닐알코올, 메틸트라이메티콘, 소듐폴리아크릴로일다이메틸타우레이트, 버지니아풍년화잎수, 트로메타민, 폴리아크릴레이트크로스폴리머-6, 아라키딜알코올, 카프릴릴글라이콜, 에틸헥실글리세린, 아라키딜글루코사이드, 소듐메타포스페이트, 아데노신, 토코페롤, 소듐하이알루로네이트, 알란토인, 시트릭애씨드, 포타슘솔베이트",
    key_ingredients: ["Niacinamide", "Sodium Hyaluronate", "Adenosine", "Aloe Barbadensis Leaf Water"],
    notes: "",
    seed_overlap: null,
  },
  {
    status: "READY_FOR_REVIEW",
    brand: "COSRX",
    product_name: "Full Fit Propolis Light Cream",
    product_name_ko: "풀핏 프로폴리스 라이트 크림",
    product_name_en: "Full Fit Propolis Light Cream",
    slug: "cosrx-full-fit-propolis-light-cream-65g",
    variant: "65g",
    size: "65g",
    category: "moisturizer",
    description: "프로폴리스 라이트 크림. COSRX 한국 공식몰 상품정보 기준.",
    source_url:
      "https://www.cosrx.co.kr/shop/shopdetail.html?branduid=1176505",
    source_type: "official_brand_kr_mall",
    retailer: "COSRX Official KR Mall",
    purchase_url:
      "https://www.cosrx.co.kr/shop/shopdetail.html?branduid=1176505",
    price_krw: 16100,
    list_price_krw: 28000,
    stock_status: "in_stock",
    stock_evidence: "판매가·옵션 표시, 품절 문구 없음 (2026-07-18)",
    image_url:
      "https://www.cosrx.co.kr/shopimages/cosrx/019000000606.jpg?1703730335",
    full_ingredients_ko:
      "정제수, 부틸렌글라이콜, 글리세린, 카프릴릭/카프릭트라이글리세라이드, 해바라기씨오일, 1,2-헥산다이올, 하이드록시에틸아크릴레이트/소듐아크릴로일다이메틸타우레이트코폴리머, 프로폴리스추출물(6,793 ppm), 세테아릴올리베이트, 세테아릴알코올, 비즈왁스, 솔비탄올리베이트, 카보머, 알지닌, 알란토인, 솔비탄아이소스테아레이트, 폴리솔베이트60, 잔탄검, 결명씨추출물, 로얄젤리추출물, 꿀추출물",
    key_ingredients: ["Propolis Extract", "Royal Jelly Extract", "Honey Extract", "Allantoin"],
    notes: "보습 카테고리 2번째 — 스네일과 구분 검수",
    seed_overlap: null,
  },
  {
    status: "REVIEW_REQUIRED",
    brand: "ROUND LAB",
    product_name: "1025 Dokdo Toner",
    product_name_ko: "1025 독도 토너",
    product_name_en: "1025 Dokdo Toner",
    slug: "round-lab-1025-dokdo-toner-200ml",
    variant: "200ml",
    size: "200ml",
    category: "toner",
    description: "라운드랩 공식몰 판매 확인. 전성분 텍스트 추출 불가(상세 이미지 의존).",
    source_url:
      "https://roundlab.co.kr/product/1025-%EB%8F%85%EB%8F%84-%ED%86%A0%EB%84%88-200ml/22/",
    source_type: "official_brand_kr_mall",
    retailer: "ROUND LAB Official KR Mall",
    purchase_url:
      "https://roundlab.co.kr/product/1025-%EB%8F%85%EB%8F%84-%ED%86%A0%EB%84%88-200ml/22/",
    price_krw: 13500,
    list_price_krw: 15000,
    stock_status: "in_stock",
    stock_evidence: "구매하기 버튼 활성, 품절 아님 (2026-07-18)",
    image_url:
      "https://roundlab.co.kr/web/product/big/202511/1c345b7287e97f2733f49315da42eea1.jpg",
    full_ingredients_ko: "",
    key_ingredients: [],
    notes: "공식 전성분 원문 텍스트 미확보 — OCR/수동 전성분 추출 후 READY 전환",
    blockers: ["missing_official_inci_text"],
  },
  {
    status: "BLOCKED",
    brand: "ROUND LAB",
    product_name: "Birch Juice Moisturizing Sunscreen",
    product_name_ko: "자작나무 수분 선크림",
    product_name_en: "Birch Juice Moisturizing Sunscreen",
    slug: "round-lab-birch-juice-moisturizing-sunscreen-50ml",
    variant: "50ml",
    size: "50ml",
    category: "sunscreen",
    description: "라운드랩 공식몰 확인 — 품절.",
    source_url:
      "https://roundlab.co.kr/product/%EC%9E%90%EC%9E%91%EB%82%98%EB%AC%B4-%EC%88%98%EB%B6%84-%EC%84%A0%ED%81%AC%EB%A6%BC-50ml/138/",
    source_type: "official_brand_kr_mall",
    retailer: "ROUND LAB Official KR Mall",
    purchase_url:
      "https://roundlab.co.kr/product/%EC%9E%90%EC%9E%91%EB%82%98%EB%AC%B4-%EC%88%98%EB%B6%84-%EC%84%A0%ED%81%AC%EB%A6%BC-50ml/138/",
    price_krw: 22500,
    list_price_krw: 25000,
    stock_status: "out_of_stock",
    stock_evidence: "페이지에 품절 표시 (2026-07-18)",
    image_url: "",
    full_ingredients_ko: "",
    key_ingredients: [],
    notes: "품절 + 전성분 텍스트 미확보",
    blockers: ["out_of_stock", "missing_official_inci_text"],
  },
  {
    status: "BLOCKED",
    brand: "Anua",
    product_name: "Heartleaf 77 Hyaluronic Acid Soothing Toner",
    product_name_ko: "어성초 77 히알루론산 수분 진정 토너",
    product_name_en: "Heartleaf 77 Hyaluronic Acid Soothing Toner",
    slug: "anua-heartleaf-77-hyaluronic-soothing-toner-250ml",
    variant: "250ml renewal",
    size: "250ml",
    category: "toner",
    description: "아누아 공식몰 확인 — SOLD OUT.",
    source_url:
      "https://anua.kr/product/new%EB%A6%AC%EB%89%B4%EC%96%BC-%EC%96%B4%EC%84%B1%EC%B4%88-77-%ED%9E%88%EC%95%8C%EB%A3%A8%EB%A1%A0%EC%82%B0-%EC%88%98%EB%B6%84-%EC%A7%84%EC%A0%95-%ED%86%A0%EB%84%88-250ml/496/",
    source_type: "official_brand_kr_mall",
    retailer: "Anua Official KR Mall",
    purchase_url:
      "https://anua.kr/product/new%EB%A6%AC%EB%89%B4%EC%96%BC-%EC%96%B4%EC%84%B1%EC%B4%88-77-%ED%9E%88%EC%95%8C%EB%A3%A8%EB%A1%A0%EC%82%B0-%EC%88%98%EB%B6%84-%EC%A7%84%EC%A0%95-%ED%86%A0%EB%84%88-250ml/496/",
    price_krw: 20000,
    list_price_krw: 25000,
    stock_status: "out_of_stock",
    stock_evidence: "SOLD OUT 표시 (2026-07-18)",
    image_url: "",
    full_ingredients_ko: "",
    key_ingredients: [],
    notes: "품절 — in_stock 추정 금지",
    blockers: ["out_of_stock", "missing_official_inci_text"],
  },
  {
    status: "BLOCKED",
    brand: "Torriden",
    product_name: "DIVE IN Low Molecular Hyaluronic Acid Cream",
    product_name_ko: "다이브인 저분자 히알루론산 크림",
    product_name_en: "DIVE IN Low Molecular Hyaluronic Acid Cream",
    slug: "torriden-dive-in-low-molecular-hyaluronic-acid-cream-80ml",
    variant: "80ml",
    size: "80ml",
    category: "moisturizer",
    description: "토리든 공식몰 — 구매 불가.",
    source_url: "https://www.torriden.com/goods/goods_view.php?goodsNo=57",
    source_type: "official_brand_kr_mall",
    retailer: "Torriden Official KR Mall",
    purchase_url: "https://www.torriden.com/goods/goods_view.php?goodsNo=57",
    price_krw: 15700,
    list_price_krw: 21000,
    stock_status: "out_of_stock",
    stock_evidence: "구매 불가 표시 (2026-07-18)",
    image_url: "",
    full_ingredients_ko:
      "정제수, 부틸렌글라이콜, 글리세린, 다이프로필렌글라이콜, 카프릴릭/카프릭트라이글리세라이드, 1,2-헥산다이올, C14-22알코올, 글리세릴스테아레이트, 에틸헥실팔미테이트, 세테아릴알코올, 소듐하이알루로네이트, 하이드롤라이즈드하이알루로닉애씨드(100ppm), 소듐아세틸레이티드하이알루로네이트, 소듐하이알루로네이트크로스폴리머, 하이드롤라이즈드소듐하이알루로네이트, 호호바씨오일, 마카다미아씨오일, 아르간커넬오일, 트레할로오스, 에스에이치-올리고펩타이드-1",
    key_ingredients: ["Sodium Hyaluronate", "Hydrolyzed Hyaluronic Acid"],
    notes: "전성분은 페이지에 있으나 구매 불가로 offer 부적격",
    blockers: ["purchase_unavailable"],
  },
  {
    status: "BLOCKED",
    brand: "Isntree",
    product_name: "Ultra-Low Molecular Hyaluronic Acid Toner",
    product_name_ko: "초저분자 히아루론산 토너",
    product_name_en: "Ultra-Low Molecular Hyaluronic Acid Toner",
    slug: "isntree-ultra-low-molecular-hyaluronic-acid-toner-300ml",
    variant: "300ml",
    size: "300ml",
    category: "toner",
    description: "이즈앤트리 공식몰 — 품절.",
    source_url:
      "https://isntree.com/product/%EC%B4%88%EC%A0%80%EB%B6%84%EC%9E%90-%ED%9E%88%EC%95%84%EB%A3%A8%EB%A1%A0%EC%82%B0-%ED%86%A0%EB%84%88-300ml/56/",
    source_type: "official_brand_kr_mall",
    retailer: "Isntree Official KR Mall",
    purchase_url:
      "https://isntree.com/product/%EC%B4%88%EC%A0%80%EB%B6%84%EC%9E%90-%ED%9E%88%EC%95%84%EB%A3%A8%EB%A1%A0%EC%82%B0-%ED%86%A0%EB%84%88-300ml/56/",
    price_krw: 16800,
    list_price_krw: 21000,
    stock_status: "out_of_stock",
    stock_evidence: "상품이 품절되었습니다 (2026-07-18)",
    image_url: "",
    full_ingredients_ko: "",
    key_ingredients: [],
    notes: "품절 + 전성분 텍스트 미확보",
    blockers: ["out_of_stock", "missing_official_inci_text"],
  },
];

function csvEscape(v) {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows, headers) {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(","));
  }
  return lines.join("\n") + "\n";
}

function normalizeInci(raw) {
  return raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
}

function deriveRefFromEnv() {
  try {
    const envPath = path.join(root, ".env.local");
    if (!fs.existsSync(envPath)) return { ref: "", hasServiceRole: false };
    const text = fs.readFileSync(envPath, "utf8");
    const urlMatch = text.match(
      /NEXT_PUBLIC_SUPABASE_URL\s*=\s*["']?https?:\/\/([a-z0-9-]+)\.supabase\.co/i
    );
    const ref = urlMatch?.[1] ?? "";
    const hasServiceRole = /SUPABASE_SERVICE_ROLE_KEY\s*=\s*.+/i.test(text);
    return { ref, hasServiceRole };
  } catch {
    return { ref: "", hasServiceRole: false };
  }
}

async function downloadImage(url, dest) {
  const res = await fetch(url, {
    headers: { "User-Agent": "kbeauty-catalog-batch/1.0 (offline import; no DB write)" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1000) throw new Error(`tiny/placeholder image ${buf.length}B`);
  fs.writeFileSync(dest, buf);
  const hash = crypto.createHash("sha256").update(buf).digest("hex");
  return { bytes: buf.length, hash, contentType: res.headers.get("content-type") };
}

fs.mkdirSync(imagesDir, { recursive: true });

const envGate = deriveRefFromEnv();
const stagingWriteAllowed =
  envGate.ref === STAGING_REF &&
  envGate.ref !== PROD_REF &&
  envGate.hasServiceRole;

const ready = candidates.filter((c) => c.status === "READY_FOR_REVIEW");
const mediaRows = [];
const imageHashes = new Map();

for (const c of ready) {
  const ext = path.extname(new URL(c.image_url).pathname) || ".jpg";
  const filename = `${c.slug}${ext.split("?")[0] || ".jpg"}`.replace(
    /\.jpe?g$/i,
    ".jpg"
  );
  const dest = path.join(imagesDir, filename);
  try {
    const meta = await downloadImage(c.image_url, dest);
    if (imageHashes.has(meta.hash)) {
      c.notes = `${c.notes || ""}; DUPLICATE_IMAGE_HASH_WITH=${imageHashes.get(meta.hash)}`.trim();
    } else {
      imageHashes.set(meta.hash, c.slug);
    }
    c.image_filename = filename;
    c.image_sha256 = meta.hash;
    c.image_bytes = meta.bytes;
    mediaRows.push({
      slug: c.slug,
      image_filename: filename,
      source_image_url: c.image_url,
      source_page_url: c.source_url,
      is_official_source: true,
      is_primary: true,
      sha256: meta.hash,
      bytes: meta.bytes,
      checked_at: CHECKED_AT,
    });
  } catch (e) {
    c.status = "REVIEW_REQUIRED";
    c.blockers = [...(c.blockers || []), `image_download_failed:${e.message}`];
    c.image_filename = "";
  }
}

const productCsvRows = candidates
  .filter((c) => c.status === "READY_FOR_REVIEW")
  .map((c) => ({
    brand: c.brand,
    product_name: c.product_name,
    slug: c.slug,
    category: c.category,
    target_areas: "face",
    full_ingredients: c.full_ingredients_ko,
    description: c.description,
    image_filename: c.image_filename,
    product_name_ko: c.product_name_ko,
    product_name_en: c.product_name_en,
    product_name_ja: "",
    country: "KR",
    size: c.size,
    usage: "",
    warnings: "",
    source_url: c.source_url,
    source_type: c.source_type,
    verified: "false",
    active: "false",
    image_url: "",
    review_status: "needs_review",
    auto_verified: "false",
  }));

const offerRows = candidates
  .filter((c) => c.status === "READY_FOR_REVIEW")
  .map((c) => ({
    slug: c.slug,
    retailer_name: c.retailer,
    retailer_type: "brand_official",
    retailer_country: "KR",
    ships_to_countries: "KR",
    purchase_url: c.purchase_url,
    price: c.price_krw,
    currency: "KRW",
    stock_status: c.stock_status,
    verification_status: "unverified",
    is_official: "true",
    active: "true",
    verified_at: "",
    last_checked_at: CHECKED_AT,
    stock_evidence: c.stock_evidence,
    notes: "review_pending — never auto-verified",
  }));

const ingredients = {};
for (const c of candidates.filter((x) => x.full_ingredients_ko)) {
  ingredients[c.slug] = {
    slug: c.slug,
    source_url: c.source_url,
    checked_at: CHECKED_AT,
    full_ingredients_verbatim_ko: c.full_ingredients_ko,
    normalized_list: normalizeInci(c.full_ingredients_ko),
    key_ingredients: c.key_ingredients,
    invented: false,
  };
}

const sources = {
  checked_at: CHECKED_AT,
  policy: {
    allow: [
      "brand_kr_official_mall",
      "brand_official_global",
      "official_product_page",
      "official_inci_page",
    ],
    forbid: ["blog", "sns", "search_snippet", "user_review", "ai_generated_inci"],
    auto_verified: false,
  },
  products: candidates.map((c) => ({
    slug: c.slug,
    brand: c.brand,
    status: c.status,
    source_url: c.source_url,
    source_type: c.source_type,
    price_krw: c.price_krw,
    stock_status: c.stock_status,
    stock_evidence: c.stock_evidence,
    image_url: c.image_url || null,
    image_filename: c.image_filename || null,
    has_official_inci_text: Boolean(c.full_ingredients_ko),
    blockers: c.blockers || [],
    seed_overlap: c.seed_overlap || null,
    notes: c.notes || "",
  })),
};

const counts = {
  total_candidates: candidates.length,
  READY_FOR_REVIEW: candidates.filter((c) => c.status === "READY_FOR_REVIEW").length,
  REVIEW_REQUIRED: candidates.filter((c) => c.status === "REVIEW_REQUIRED").length,
  BLOCKED: candidates.filter((c) => c.status === "BLOCKED").length,
  DUPLICATE: candidates.filter((c) => c.status === "DUPLICATE").length,
  official_images: mediaRows.length,
  official_inci: Object.keys(ingredients).length,
  kr_offers: offerRows.length,
};

const manifest = {
  batch_id: "verified-kbeauty-batch-2026-07-18",
  created_at: CHECKED_AT,
  branch_target: "automation-mvp-completion",
  auto_verified: false,
  production_write: false,
  staging: {
    linked_ref: envGate.ref || null,
    is_production_ref: envGate.ref === PROD_REF,
    has_service_role: envGate.hasServiceRole,
    write_allowed: stagingWriteAllowed,
    write_status: stagingWriteAllowed ? "ALLOWED_BUT_NOT_EXECUTED_IN_BUILD" : "SKIPPED",
    skip_reason: stagingWriteAllowed
      ? null
      : envGate.ref === PROD_REF
        ? "local_env_points_to_production_ref"
        : !envGate.hasServiceRole
          ? "missing_service_role"
          : "not_staging_ref",
  },
  counts,
  categories_ready: [
    ...new Set(
      candidates
        .filter((c) => c.status === "READY_FOR_REVIEW")
        .map((c) => c.category)
    ),
  ],
  admin_import_hint: {
    ui: "/admin/products/import",
    files: ["products.csv", "images/ (zip recommended)", "offers.csv for manual offer attach"],
    commit_mode: "needs_review / review_pending only — never set verified_at automatically",
  },
  preview_note:
    "Preview 핵심 추천 노출은 active+verified_at+verified KR offer 필요. 본 배치는 needs_review 전용.",
};

fs.writeFileSync(
  path.join(outDir, "products.csv"),
  toCsv(productCsvRows, [
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
    "review_status",
    "auto_verified",
  ])
);
fs.writeFileSync(
  path.join(outDir, "offers.csv"),
  toCsv(offerRows, [
    "slug",
    "retailer_name",
    "retailer_type",
    "retailer_country",
    "ships_to_countries",
    "purchase_url",
    "price",
    "currency",
    "stock_status",
    "verification_status",
    "is_official",
    "active",
    "verified_at",
    "last_checked_at",
    "stock_evidence",
    "notes",
  ])
);
fs.writeFileSync(
  path.join(outDir, "media.csv"),
  toCsv(mediaRows, [
    "slug",
    "image_filename",
    "source_image_url",
    "source_page_url",
    "is_official_source",
    "is_primary",
    "sha256",
    "bytes",
    "checked_at",
  ])
);
fs.writeFileSync(
  path.join(outDir, "ingredients.json"),
  JSON.stringify(ingredients, null, 2) + "\n"
);
fs.writeFileSync(
  path.join(outDir, "sources.json"),
  JSON.stringify(sources, null, 2) + "\n"
);
fs.writeFileSync(
  path.join(outDir, "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      outDir: "imports/verified-kbeauty-batch",
      counts,
      stagingWrite: manifest.staging.write_status,
      autoVerified: false,
    },
    null,
    2
  )
);

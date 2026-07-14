/**
 * Full-beauty curated KR catalog builder.
 *
 * Policy:
 * - Brand list = official-domain allowlist only
 * - Products are curated discovery candidates (not claimed verified/purchasable)
 * - Empty/partial INCI → never auto public; mostly needs_review
 * - Image URLs are official-domain remote refs only (external_link_only)
 * - Live crawl stays OFF — volume comes from curated line sheets + shade options
 */

import { KR_BRAND_SEED_REGISTRY } from "./brandRegistry";
import { beautyDomainForCategory } from "@/lib/catalog/taxonomy/domains";

export type FullBeautyRawProduct = {
  brandId: string;
  brand: string;
  nameKo: string;
  nameEn: string;
  slug: string;
  domain: string;
  category: string;
  categoryDetail: string;
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
  attributes: Record<string, unknown>;
  curatedProvenance: "known_hero" | "shade_variant" | "line_family" | "category_discovery";
};

type HeroDef = {
  brandId: string;
  path: string;
  nameKo: string;
  nameEn: string;
  category: string;
  categoryDetail?: string;
  volumeMl?: number;
  keyIngredients?: string[];
  hasFullInci?: boolean;
  concerns?: string[];
  usageArea?: string;
  retailerHint?: "oliveyoung" | "official" | "none";
  attributes?: Record<string, unknown>;
  shades?: Array<{ code: string; nameKo: string; nameEn: string; undertone?: string }>;
};

function domainOf(brandId: string): string {
  const e = KR_BRAND_SEED_REGISTRY.find((b) => b.brandId === brandId);
  return (e?.officialDomains[0] ?? `${brandId}.com`).replace(/^www\./, "");
}

function brandName(brandId: string): string {
  return (
    KR_BRAND_SEED_REGISTRY.find((b) => b.brandId === brandId)?.canonicalBrand ??
    brandId
  );
}

/** Curated hero SKUs (KR market). Incomplete INCI → review until official label parsed. */
const HEROES: HeroDef[] = [
  // —— Skincare heroes ——
  { brandId: "cosrx", path: "advanced-snail-96-mucin-power-essence", nameKo: "어드밴스드 스네일 96 뮤신 파워 에센스", nameEn: "Advanced Snail 96 Mucin Power Essence", category: "essence", volumeMl: 100, keyIngredients: ["Snail Secretion Filtrate"], hasFullInci: false, concerns: ["dryness", "sensitivity"], retailerHint: "oliveyoung" },
  { brandId: "cosrx", path: "advanced-snail-92-all-in-one-cream", nameKo: "어드밴스드 스네일 92 올인원 크림", nameEn: "Advanced Snail 92 All in One Cream", category: "cream", volumeMl: 100, keyIngredients: ["Snail Secretion Filtrate"], hasFullInci: false, concerns: ["dryness"], retailerHint: "oliveyoung" },
  { brandId: "cosrx", path: "the-retinol-0-1-cream", nameKo: "더 레티놀 0.1 크림", nameEn: "The Retinol 0.1 Cream", category: "cream", volumeMl: 20, keyIngredients: ["Retinol"], hasFullInci: false, concerns: ["antiaging"], retailerHint: "oliveyoung" },
  { brandId: "cosrx", path: "acne-puffer-clear-fit-master-patch", nameKo: "아크네 퍼프 클리어 핏 마스터 패치", nameEn: "Acne Pimple Master Patch", category: "spot_care", keyIngredients: [], hasFullInci: false, concerns: ["acne"], retailerHint: "oliveyoung" },
  { brandId: "beauty-of-joseon", path: "relief-sun-rice-probiotics", nameKo: "릴리프 선 라이스 + 프로바이오틱스", nameEn: "Relief Sun : Rice + Probiotics", category: "sunscreen", volumeMl: 50, keyIngredients: ["Zinc Oxide"], hasFullInci: false, concerns: ["uv"], retailerHint: "oliveyoung" },
  { brandId: "beauty-of-joseon", path: "glow-serum-propolis-niacinamide", nameKo: "글로우 세럼 프로폴리스 + 나이아신아마이드", nameEn: "Glow Serum : Propolis + Niacinamide", category: "serum", volumeMl: 30, keyIngredients: ["Niacinamide"], hasFullInci: false, concerns: ["dryness", "pigmentation"], retailerHint: "oliveyoung" },
  { brandId: "beauty-of-joseon", path: "ginseng-essence-water", nameKo: "인삼 에센스 워터", nameEn: "Ginseng Essence Water", category: "toner", volumeMl: 150, keyIngredients: [], hasFullInci: false, concerns: ["dryness"], retailerHint: "oliveyoung" },
  { brandId: "anua", path: "heartleaf-77-soothing-toner", nameKo: "어성초 77 수딩 토너", nameEn: "Heartleaf 77% Soothing Toner", category: "toner", volumeMl: 250, keyIngredients: ["Houttuynia Cordata Extract"], hasFullInci: false, concerns: ["redness", "sensitivity", "acne"], retailerHint: "oliveyoung" },
  { brandId: "anua", path: "niacinamide-10-txa-4-serum", nameKo: "나이아신아마이드 10% + TXA 4% 세럼", nameEn: "Niacinamide 10% + TXA 4% Serum", category: "serum", volumeMl: 30, keyIngredients: ["Niacinamide"], hasFullInci: false, concerns: ["pigmentation", "pores"], retailerHint: "oliveyoung" },
  { brandId: "round-lab", path: "dokdo-toner", nameKo: "1025 독도 토너", nameEn: "1025 Dokdo Toner", category: "toner", volumeMl: 200, keyIngredients: [], hasFullInci: false, concerns: ["dryness", "sensitivity"], retailerHint: "oliveyoung" },
  { brandId: "round-lab", path: "birch-juice-moisturizing-sunscreen", nameKo: "자작나무 수분 선크림", nameEn: "Birch Juice Moisturizing Sunscreen", category: "sunscreen", volumeMl: 50, keyIngredients: [], hasFullInci: false, concerns: ["uv"], retailerHint: "oliveyoung" },
  { brandId: "isntree", path: "hyaluronic-acid-watery-sun-gel", nameKo: "히알루론산 워터리 선젤", nameEn: "Hyaluronic Acid Watery Sun Gel", category: "sunscreen", volumeMl: 50, keyIngredients: ["Sodium Hyaluronate"], hasFullInci: false, concerns: ["uv", "dryness"], retailerHint: "oliveyoung" },
  { brandId: "isntree", path: "green-tea-fresh-toner", nameKo: "그린티 프레시 토너", nameEn: "Green Tea Fresh Toner", category: "toner", volumeMl: 200, keyIngredients: [], hasFullInci: false, concerns: ["pores"], retailerHint: "oliveyoung" },
  { brandId: "some-by-mi", path: "aha-bha-pha-30-days-miracle-toner", nameKo: "아하 바하 파하 30데이즈 미라클 토너", nameEn: "AHA BHA PHA 30 Days Miracle Toner", category: "toner", volumeMl: 150, keyIngredients: ["Salicylic Acid"], hasFullInci: false, concerns: ["acne", "pores"], retailerHint: "oliveyoung" },
  { brandId: "skin1004", path: "madagascar-centella-ampoule", nameKo: "마다가스카르 센텔라 앰플", nameEn: "Madagascar Centella Ampoule", category: "ampoule", volumeMl: 55, keyIngredients: ["Centella Asiatica"], hasFullInci: false, concerns: ["redness", "sensitivity"], retailerHint: "oliveyoung" },
  { brandId: "skin1004", path: "madagascar-centella-hyalu-cica-water-fit-sun-serum", nameKo: "히알루 시카 워터핏 선세럼", nameEn: "Hyalu-Cica Water-Fit Sun Serum", category: "sunscreen", volumeMl: 50, keyIngredients: ["Centella Asiatica"], hasFullInci: false, concerns: ["uv", "redness"], retailerHint: "oliveyoung" },
  { brandId: "torriden", path: "dive-in-low-molecule-hyaluronic-acid-serum", nameKo: "다이브인 저분자 히알루론산 세럼", nameEn: "DIVE-IN Low Molecule Hyaluronic Acid Serum", category: "serum", volumeMl: 50, keyIngredients: ["Sodium Hyaluronate"], hasFullInci: false, concerns: ["dryness"], retailerHint: "oliveyoung" },
  { brandId: "numbuzin", path: "no3-skin-softening-serum", nameKo: "3번 결광가득 세럼", nameEn: "No.3 Skin Softening Serum", category: "serum", volumeMl: 50, keyIngredients: [], hasFullInci: false, concerns: ["dryness", "pigmentation"], retailerHint: "oliveyoung" },
  { brandId: "medicube", path: "zero-pore-pads-2-0", nameKo: "제로 모공 패드 2.0", nameEn: "Zero Pore Pads 2.0", category: "toner_pad", keyIngredients: ["Salicylic Acid"], hasFullInci: false, concerns: ["pores", "acne"], retailerHint: "oliveyoung" },
  { brandId: "axis-y", path: "dark-spot-correcting-glow-serum", nameKo: "다크스팟 코렉팅 글로우 세럼", nameEn: "Dark Spot Correcting Glow Serum", category: "serum", volumeMl: 50, keyIngredients: ["Niacinamide"], hasFullInci: false, concerns: ["pigmentation"], retailerHint: "oliveyoung" },
  { brandId: "purito", path: "daily-go-to-sunscreen", nameKo: "데일리 고투 선크림", nameEn: "Daily Go-To Sunscreen", category: "sunscreen", volumeMl: 60, keyIngredients: [], hasFullInci: false, concerns: ["uv"], retailerHint: "oliveyoung" },
  { brandId: "klairs", path: "freshly-juiced-vitamin-drop", nameKo: "프레쉬리 쥬스드 비타민 드롭", nameEn: "Freshly Juiced Vitamin Drop", category: "serum", volumeMl: 35, keyIngredients: ["Ascorbic Acid"], hasFullInci: false, concerns: ["pigmentation"], retailerHint: "oliveyoung" },
  { brandId: "heimish", path: "all-clean-balm", nameKo: "올클린밤", nameEn: "All Clean Balm", category: "cleansing_balm", volumeMl: 120, keyIngredients: [], hasFullInci: false, concerns: [], retailerHint: "oliveyoung" },
  { brandId: "dr-jart", path: "cicapair-tiger-grass-color-correcting-treatment", nameKo: "시카페어 타이거 그라스 컬러 코렉팅 트리트먼트", nameEn: "Cicapair Tiger Grass Color Correcting Treatment", category: "tone_up_base", volumeMl: 50, keyIngredients: ["Centella Asiatica"], hasFullInci: false, concerns: ["redness"], retailerHint: "oliveyoung", attributes: { coverage: "sheer", finish: "natural" } },
  { brandId: "laneige", path: "lip-sleeping-mask", nameKo: "립 슬리핑 마스크", nameEn: "Lip Sleeping Mask", category: "lip_mask", volumeMl: 20, keyIngredients: [], hasFullInci: false, concerns: ["dryness"], usageArea: "lips", retailerHint: "oliveyoung" },
  { brandId: "laneige", path: "cream-skin-refiner", nameKo: "크림 스킨", nameEn: "Cream Skin Refiner", category: "toner", volumeMl: 150, keyIngredients: [], hasFullInci: false, concerns: ["dryness"], retailerHint: "oliveyoung" },
  { brandId: "innisfree", path: "green-tea-seed-hyaluronic-serum", nameKo: "그린티씨드 히알루론산 세럼", nameEn: "Green Tea Seed Hyaluronic Serum", category: "serum", volumeMl: 80, keyIngredients: ["Sodium Hyaluronate"], hasFullInci: false, concerns: ["dryness"], retailerHint: "oliveyoung" },
  { brandId: "missha", path: "perfect-cover-bb-cream", nameKo: "퍼펙트 커버 비비 크림", nameEn: "Perfect Cover BB Cream", category: "bb_cream", volumeMl: 50, keyIngredients: [], hasFullInci: false, concerns: [], attributes: { coverage: "medium", finish: "natural" }, retailerHint: "oliveyoung", shades: [
    { code: "13", nameKo: "13호 밝음", nameEn: "No.13 Bright", undertone: "cool" },
    { code: "21", nameKo: "21호 자연", nameEn: "No.21 Natural", undertone: "neutral" },
    { code: "23", nameKo: "23호 자연", nameEn: "No.23 Natural", undertone: "warm" },
  ] },
  { brandId: "goodal", path: "green-tangerine-vita-c-dark-circle-eye-cream", nameKo: "청귤 비타C 다크서클 아이크림", nameEn: "Green Tangerine Vita C Dark Circle Eye Cream", category: "eye_cream", volumeMl: 30, keyIngredients: ["Ascorbic Acid"], hasFullInci: false, concerns: ["pigmentation"], retailerHint: "oliveyoung" },
  { brandId: "tocobo", path: "cotton-soft-sun-stick", nameKo: "코튼 소프트 선스틱", nameEn: "Cotton Soft Sun Stick", category: "sun_stick", volumeMl: 19, keyIngredients: [], hasFullInci: false, concerns: ["uv"], retailerHint: "oliveyoung" },
  { brandId: "mixsoon", path: "bean-essence", nameKo: "콩 에센스", nameEn: "Bean Essence", category: "essence", volumeMl: 50, keyIngredients: [], hasFullInci: false, concerns: ["dryness"], retailerHint: "oliveyoung" },
  { brandId: "haruharu", path: "black-rice-hyaluronic-toner", nameKo: "블랙라이스 히알루론산 토너", nameEn: "Black Rice Hyaluronic Toner", category: "toner", volumeMl: 150, keyIngredients: ["Sodium Hyaluronate"], hasFullInci: false, concerns: ["dryness"], retailerHint: "oliveyoung" },
  { brandId: "axis-y", path: "complete-no-stress-physical-sunscreen", nameKo: "컴플리트 노스트레스 물리적 선크림", nameEn: "Complete No-Stress Physical Sunscreen", category: "sunscreen", volumeMl: 50, keyIngredients: ["Zinc Oxide"], hasFullInci: false, concerns: ["uv", "sensitivity"], retailerHint: "oliveyoung" },
  { brandId: "purito", path: "centella-unscented-serum", nameKo: "센텔라 언센티드 세럼", nameEn: "Centella Unscented Serum", category: "serum", volumeMl: 30, keyIngredients: ["Centella Asiatica", "Panthenol"], hasFullInci: false, concerns: ["redness", "sensitivity"], retailerHint: "oliveyoung" },
  { brandId: "banila-co", path: "clean-it-zero-original", nameKo: "클린 잇 제로 오리지널", nameEn: "Clean It Zero Original", category: "cleansing_balm", volumeMl: 100, keyIngredients: [], hasFullInci: false, concerns: [], retailerHint: "oliveyoung" },
  { brandId: "etude", path: "soonjung-ph-6-5-whip-cleanser", nameKo: "순정 약산성 6.5 휩 클렌저", nameEn: "SoonJung pH 6.5 Whip Cleanser", category: "foam_cleanser", volumeMl: 150, keyIngredients: ["Panthenol"], hasFullInci: false, concerns: ["sensitivity"], retailerHint: "oliveyoung" },
  { brandId: "sulwhasoo", path: "first-care-activating-serum", nameKo: "윤조에센스", nameEn: "First Care Activating Serum", category: "essence", volumeMl: 60, keyIngredients: [], hasFullInci: false, concerns: ["antiaging", "dryness"], retailerHint: "official" },
  { brandId: "hera", path: "uv-mist-cushion-cover", nameKo: "UV 미스트 쿠션 커버", nameEn: "UV Mist Cushion Cover", category: "cushion", volumeMl: 15, keyIngredients: [], hasFullInci: false, concerns: ["uv"], attributes: { coverage: "medium", finish: "natural" }, retailerHint: "official", shades: [
    { code: "21N1", nameKo: "21N1", nameEn: "21N1", undertone: "neutral" },
    { code: "23N1", nameKo: "23N1", nameEn: "23N1", undertone: "neutral" },
    { code: "17C1", nameKo: "17C1", nameEn: "17C1", undertone: "cool" },
  ] },
  { brandId: "espoir", path: "pro-tailor-be-glow-cushion", nameKo: "프로 테일러 비 글로우 쿠션", nameEn: "Pro Tailor Be Glow Cushion", category: "cushion", attributes: { coverage: "medium", finish: "glow" }, retailerHint: "oliveyoung", shades: [
    { code: "Ivory", nameKo: "아이보리", nameEn: "Ivory", undertone: "cool" },
    { code: "Petal", nameKo: "페탈", nameEn: "Petal", undertone: "neutral" },
    { code: "Beige", nameKo: "베이지", nameEn: "Beige", undertone: "warm" },
  ] },
  { brandId: "amortepacific", path: "time-response-skin-reserve-serum", nameKo: "타임레스폰스 스킨 리저브 세럼", nameEn: "Time Response Skin Reserve Serum", category: "serum", keyIngredients: [], hasFullInci: false, concerns: ["antiaging"], retailerHint: "official" },

  // —— Makeup lips ——
  { brandId: "romand", path: "juicy-lasting-tint", nameKo: "쥬시 래스팅 틴트", nameEn: "Juicy Lasting Tint", category: "lip_tint", attributes: { finish: "glossy", lipEffects: ["stain", "gloss"] }, retailerHint: "oliveyoung", shades: [
    { code: "06", nameKo: "피그딥", nameEn: "Fig Fig", undertone: "warm" },
    { code: "12", nameKo: "체리밤", nameEn: "Cherry Bomb", undertone: "cool" },
    { code: "23", nameKo: "누카다미아", nameEn: "Nucadamia", undertone: "neutral" },
    { code: "25", nameKo: "베어 그레이프", nameEn: "Bare Grape", undertone: "cool" },
    { code: "26", nameKo: "알몬드 로즈", nameEn: "Almond Rose", undertone: "warm" },
  ] },
  { brandId: "romand", path: "zero-velvet-tint", nameKo: "제로 벨벳 틴트", nameEn: "Zero Velvet Tint", category: "lip_tint", attributes: { finish: "matte", lipEffects: ["stain", "matte"] }, retailerHint: "oliveyoung", shades: [
    { code: "01", nameKo: "피콕", nameEn: "Picotee", undertone: "cool" },
    { code: "05", nameKo: "이지픽", nameEn: "Fizz", undertone: "warm" },
    { code: "17", nameKo: "누디 피치", nameEn: "Nudy Peachy", undertone: "warm" },
  ] },
  { brandId: "peripera", path: "ink-velvet", nameKo: "잉크 더 벨벳", nameEn: "Ink Velvet", category: "lip_tint", attributes: { finish: "matte", lipEffects: ["stain", "matte"] }, retailerHint: "oliveyoung", shades: [
    { code: "01", nameKo: "굿모닝 코랄", nameEn: "Good Morning Coral", undertone: "warm" },
    { code: "15", nameKo: "칠리", nameEn: "Hot Spot", undertone: "cool" },
    { code: "20", nameKo: "소프트 앤 크롭", nameEn: "Soft & Crop", undertone: "cool" },
  ] },
  { brandId: "3ce", path: "velvet-lip-tint", nameKo: "벨벳 립틴트", nameEn: "Velvet Lip Tint", category: "lip_tint", attributes: { finish: "matte", lipEffects: ["matte"] }, retailerHint: "oliveyoung", shades: [
    { code: "Speak Up", nameKo: "스피크업", nameEn: "Speak Up", undertone: "cool" },
    { code: "Going Right", nameKo: "고잉 라이트", nameEn: "Going Right", undertone: "warm" },
  ] },
  { brandId: "etude", path: "fixate-curl-fixing-mascara", nameKo: "속눈썹 펌 카라", nameEn: "Lash Perm Curl Fix Mascara", category: "mascara", attributes: { mascaraEffects: ["curl", "longlash"], waterproof: false }, retailerHint: "oliveyoung" },
  { brandId: "clio", path: "kill-lash-superproof-mascara", nameKo: "킬래쉬 슈퍼프루프 마스카라", nameEn: "Kill Lash Superproof Mascara", category: "mascara", attributes: { mascaraEffects: ["volume", "longlash", "curl"], waterproof: true }, retailerHint: "oliveyoung" },
  { brandId: "clio", path: "kill-cover-fingertip-gel-eyeliner", nameKo: "킬커버 핑거팁 젤 아이라이너", nameEn: "Kill Cover Fingertip Gel Eyeliner", category: "eyeliner", retailerHint: "oliveyoung" },
  { brandId: "peripera", path: "ink-black-cara", nameKo: "잉크 블랙카라", nameEn: "Ink Black Cara", category: "mascara", attributes: { mascaraEffects: ["volume", "curl"], waterproof: false }, retailerHint: "oliveyoung" },
  { brandId: "espoir", path: "couture-lipstick", nameKo: "꾸뛰르 립스틱", nameEn: "Couture Lipstick", category: "lipstick", attributes: { finish: "satin" }, retailerHint: "oliveyoung", shades: [
    { code: "Gentle Rose", nameKo: "젠틀 로즈", nameEn: "Gentle Rose", undertone: "cool" },
    { code: "Cozy Brick", nameKo: "코지 브릭", nameEn: "Cozy Brick", undertone: "warm" },
  ] },
  { brandId: "hera", path: "sensual-powder-matte-lipstick", nameKo: "센슈얼 파우더 매트", nameEn: "Sensual Powder Matte Lipstick", category: "lipstick", attributes: { finish: "matte", lipEffects: ["matte"] }, retailerHint: "official", shades: [
    { code: "133", nameKo: "호", nameEn: "133", undertone: "cool" },
    { code: "422", nameKo: "호", nameEn: "422", undertone: "warm" },
  ] },

  // —— Hair / scalp ——
  { brandId: "lador", path: "perfect-hair-fill-up", nameKo: "퍼펙트 헤어 필업", nameEn: "Perfect Hair Fill-Up", category: "leave_in_treatment", keyIngredients: [], hasFullInci: false, concerns: ["damaged_hair"], usageArea: "hair", retailerHint: "oliveyoung", attributes: { hairConcerns: ["damage", "protein"] } },
  { brandId: "lador", path: "hydro-lpp-treatment", nameKo: "하이드로 LPP 트리트먼트", nameEn: "Hydro LPP Treatment", category: "treatment", concerns: ["damaged_hair"], usageArea: "hair", retailerHint: "oliveyoung", attributes: { hairConcerns: ["damage"] } },
  { brandId: "mise-en-scene", path: "perfect-serum-original", nameKo: "퍼펙트 세럼 오리지널", nameEn: "Perfect Serum Original", category: "hair_serum", concerns: ["damaged_hair"], usageArea: "hair", retailerHint: "oliveyoung", attributes: { hairConcerns: ["frizz", "shine"] } },
  { brandId: "mise-en-scene", path: "perfect-serum-shampoo", nameKo: "퍼펙트 세럼 샴푸", nameEn: "Perfect Serum Shampoo", category: "damage_repair_shampoo", concerns: ["damaged_hair"], usageArea: "scalp", retailerHint: "oliveyoung", attributes: { scalpTypes: ["normal"], hairConcerns: ["damage"] } },
  { brandId: "ryses", path: "anti-hair-loss-shampoo", nameKo: "탈모증상완화 샴푸", nameEn: "Anti-Hair Loss Shampoo", category: "functional_hair_loss_shampoo", usageArea: "scalp", retailerHint: "oliveyoung", attributes: { scalpTypes: ["oily", "sensitive"], functionalClaim: true } },
  { brandId: "dr-jart", path: "ctrl-a-teatreement-soothing-spray", nameKo: "티트리트먼트 수딩 스프레이", nameEn: "Ctrl-A Teatreement Soothing Spray", category: "facial_mist", keyIngredients: [], concerns: ["acne", "sensitivity"], retailerHint: "oliveyoung" },

  // —— Body / tools ——
  { brandId: "innisfree", path: "green-tea-seed-body-lotion", nameKo: "그린티씨드 바디로션", nameEn: "Green Tea Seed Body Lotion", category: "body_lotion", usageArea: "body", concerns: ["dryness"], retailerHint: "oliveyoung" },
  { brandId: "etude", path: "my-beauty-tool-eyehash-curler", nameKo: "마이뷰티툴 아이래쉬 컬러", nameEn: "My Beauty Tool Eyelash Curler", category: "eyelash_curler", usageArea: "eyes", retailerHint: "oliveyoung" },
  { brandId: "banila-co", path: "prime-primer-classic", nameKo: "프라임 프라이머 클래식", nameEn: "Prime Primer Classic", category: "primer", attributes: { finish: "smooth" }, retailerHint: "oliveyoung" },
];

/** Category discovery skeletons across all brands — status forced to needs_review. */
const CATEGORY_DISCOVERY: Array<{
  category: string;
  nameKo: string;
  nameEn: string;
  path: string;
  usageArea: string;
  concerns?: string[];
  attributes?: Record<string, unknown>;
}> = [
  { category: "foam_cleanser", nameKo: "폼 클렌저", nameEn: "Foam Cleanser", path: "foam-cleanser", usageArea: "face" },
  { category: "toner", nameKo: "토너", nameEn: "Toner", path: "toner", usageArea: "face", concerns: ["dryness"] },
  { category: "serum", nameKo: "세럼", nameEn: "Serum", path: "serum", usageArea: "face" },
  { category: "cream", nameKo: "크림", nameEn: "Cream", path: "cream", usageArea: "face", concerns: ["dryness"] },
  { category: "sunscreen", nameKo: "선크림", nameEn: "Sunscreen", path: "sunscreen", usageArea: "face", concerns: ["uv"] },
  { category: "sheet_mask", nameKo: "시트 마스크", nameEn: "Sheet Mask", path: "sheet-mask", usageArea: "face" },
  { category: "cushion", nameKo: "쿠션 파운데이션", nameEn: "Cushion Foundation", path: "cushion", usageArea: "face", attributes: { coverage: "medium" } },
  { category: "concealer", nameKo: "컨실러", nameEn: "Concealer", path: "concealer", usageArea: "face", attributes: { coverage: "medium" } },
  { category: "blush", nameKo: "블러셔", nameEn: "Blush", path: "blush", usageArea: "face" },
  { category: "eyeshadow", nameKo: "아이섀도우", nameEn: "Eyeshadow", path: "eyeshadow", usageArea: "eyes" },
  { category: "mascara", nameKo: "마스카라", nameEn: "Mascara", path: "mascara", usageArea: "eyes", attributes: { mascaraEffects: ["volume"] } },
  { category: "lip_tint", nameKo: "립틴트", nameEn: "Lip Tint", path: "lip-tint", usageArea: "lips", attributes: { finish: "satin" } },
  { category: "lipstick", nameKo: "립스틱", nameEn: "Lipstick", path: "lipstick", usageArea: "lips" },
  { category: "sensitive_scalp_shampoo", nameKo: "민감 두피 샴푸", nameEn: "Sensitive Scalp Shampoo", path: "sensitive-scalp-shampoo", usageArea: "scalp", concerns: ["sensitive_scalp"], attributes: { scalpTypes: ["sensitive"] } },
  { category: "anti_dandruff_shampoo", nameKo: "비듬 샴푸", nameEn: "Anti-Dandruff Shampoo", path: "anti-dandruff-shampoo", usageArea: "scalp", concerns: ["dandruff"], attributes: { scalpTypes: ["oily"] } },
  { category: "oily_scalp_shampoo", nameKo: "지성 두피 샴푸", nameEn: "Oily Scalp Shampoo", path: "oily-scalp-shampoo", usageArea: "scalp", concerns: ["oily_scalp"], attributes: { scalpTypes: ["oily"] } },
  { category: "dry_scalp_shampoo", nameKo: "건성 두피 샴푸", nameEn: "Dry Scalp Shampoo", path: "dry-scalp-shampoo", usageArea: "scalp", concerns: ["dry_scalp"], attributes: { scalpTypes: ["dry"] } },
  { category: "damage_repair_shampoo", nameKo: "손상모 샴푸", nameEn: "Damage Repair Shampoo", path: "damage-repair-shampoo", usageArea: "scalp", concerns: ["damaged_hair"] },
  { category: "heat_protectant", nameKo: "열 보호 스프레이", nameEn: "Heat Protectant", path: "heat-protectant", usageArea: "hair", concerns: ["heat_damage"] },
  { category: "hair_oil", nameKo: "헤어 오일", nameEn: "Hair Oil", path: "hair-oil", usageArea: "hair", concerns: ["damaged_hair"] },
  { category: "body_wash", nameKo: "바디워시", nameEn: "Body Wash", path: "body-wash", usageArea: "body" },
  { category: "body_lotion", nameKo: "바디로션", nameEn: "Body Lotion", path: "body-lotion", usageArea: "body", concerns: ["dryness"] },
  { category: "hand_cream", nameKo: "핸드크림", nameEn: "Hand Cream", path: "hand-cream", usageArea: "hands" },
  { category: "makeup_brush", nameKo: "메이크업 브러시", nameEn: "Makeup Brush", path: "makeup-brush", usageArea: "tools" },
  { category: "beauty_device", nameKo: "뷰티 디바이스", nameEn: "Beauty Device", path: "beauty-device", usageArea: "tools" },
  { category: "cleansing_oil", nameKo: "클렌징 오일", nameEn: "Cleansing Oil", path: "cleansing-oil", usageArea: "face" },
  { category: "eye_cream", nameKo: "아이크림", nameEn: "Eye Cream", path: "eye-cream", usageArea: "eyes" },
  { category: "primer", nameKo: "프라이머", nameEn: "Primer", path: "primer", usageArea: "face" },
  { category: "setting_spray", nameKo: "픽싱 스프레이", nameEn: "Setting Spray", path: "setting-spray", usageArea: "face" },
  { category: "highlighter", nameKo: "하이라이터", nameEn: "Highlighter", path: "highlighter", usageArea: "face" },
  { category: "contour", nameKo: "쉐딩", nameEn: "Contour", path: "contour", usageArea: "face" },
];

function pushProduct(
  out: FullBeautyRawProduct[],
  p: FullBeautyRawProduct
) {
  out.push(p);
}

export function generateFullBeautyCatalog(minCount = 1000): {
  items: FullBeautyRawProduct[];
  underTargetReason: string | null;
} {
  const out: FullBeautyRawProduct[] = [];

  for (const hero of HEROES) {
    const brand = brandName(hero.brandId);
    const host = domainOf(hero.brandId);
    const shades = hero.shades?.length ? hero.shades : [null];
    for (const shade of shades) {
      const shadeSuffix = shade ? `-${shade.code.toLowerCase().replace(/\s+/g, "-")}` : "";
      const slug = `${hero.brandId}-${hero.path}${shadeSuffix}`;
      const nameKo = shade
        ? `${brand} ${hero.nameKo} ${shade.nameKo}`
        : `${brand} ${hero.nameKo}`;
      const nameEn = shade
        ? `${brand} ${hero.nameEn} ${shade.nameEn}`
        : `${brand} ${hero.nameEn}`;
      pushProduct(out, {
        brandId: hero.brandId,
        brand,
        nameKo,
        nameEn,
        slug,
        domain: beautyDomainForCategory(hero.category),
        category: hero.category,
        categoryDetail: hero.categoryDetail ?? hero.category,
        volumeMl: hero.volumeMl ?? null,
        keyIngredients: [...(hero.keyIngredients ?? [])],
        fullIngredients: [],
        concerns: [...(hero.concerns ?? [])],
        usageArea: hero.usageArea ?? "face",
        cautionHints: ["공식 라벨·전성분·판매상태 검수 필요"],
        officialUrl: `https://${host}/products/${hero.path}${shadeSuffix}`,
        imageRemoteUrl: `https://${host}/cdn/shop/files/${hero.path}.jpg`,
        sourceType: "brand_csv",
        retailerHint: hero.retailerHint ?? "none",
        hasFullInci: Boolean(hero.hasFullInci),
        attributes: {
          ...(hero.attributes ?? {}),
          shadeCode: shade?.code ?? null,
          undertoneFit: shade?.undertone ? [shade.undertone] : [],
        },
        curatedProvenance: shade ? "shade_variant" : "known_hero",
      });
    }
  }

  // Category-balanced discovery across every allowlisted brand (review-only).
  for (const brand of KR_BRAND_SEED_REGISTRY) {
    const host = domainOf(brand.brandId);
    for (const line of CATEGORY_DISCOVERY) {
      const slug = `${brand.brandId}-discovery-${line.path}`;
      pushProduct(out, {
        brandId: brand.brandId,
        brand: brand.canonicalBrand,
        nameKo: `${brand.canonicalBrand} ${line.nameKo} (발견 후보)`,
        nameEn: `${brand.canonicalBrand} ${line.nameEn} (discovery candidate)`,
        slug,
        domain: beautyDomainForCategory(line.category),
        category: line.category,
        categoryDetail: line.category,
        volumeMl: null,
        keyIngredients: [],
        fullIngredients: [],
        concerns: [...(line.concerns ?? [])],
        usageArea: line.usageArea,
        cautionHints: [
          "live_crawl_disabled",
          "official_pdp_not_confirmed",
          "discovery_placeholder",
        ],
        officialUrl: `https://${host}/collections/all?q=${encodeURIComponent(line.path)}`,
        imageRemoteUrl: null,
        sourceType: "brand_csv",
        retailerHint: "none",
        hasFullInci: false,
        attributes: { ...(line.attributes ?? {}) },
        curatedProvenance: "category_discovery",
      });
    }
  }

  const underTargetReason =
    out.length < minCount
      ? `live_crawl_off_and_curated_shortfall:${out.length}<${minCount}`
      : null;

  return { items: out, underTargetReason };
}

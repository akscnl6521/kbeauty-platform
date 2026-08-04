/**
 * 성분 다국어 동의어 → 캐논컬 매핑 (Sprint 3 Phase 2C).
 * Phase 2B audit 에서 흔한 EN 라벨 + KO/JA 표기를 반영한다.
 * 각 그룹 첫 항목(영문)이 캐논컬이다.
 */

export const INGREDIENT_ALIAS_GROUPS: readonly (readonly string[])[] = [
  [
    "Centella Asiatica",
    "Centella",
    "Cica",
    "Madecassoside",
    "Asiaticoside",
    "Asiatic Acid",
    "Madecassic Acid",
    "Madagascar Centella",
    "센텔라 아시아티카",
    "센텔라",
    "병풀",
    "시카",
    "마데카소사이드",
    "마다가스카르 센텔라",
    "ツボクサ",
    "センテラ",
    "センテラアジアティカ",
    "マデカッソサイド",
  ],
  [
    "Panthenol",
    "D-Panthenol",
    "Dexpanthenol",
    "Provitamin B5",
    "Vitamin B5",
    "판테놀",
    "덱스판테놀",
    "프로비타민 B5",
    "パンテノール",
  ],
  [
    "Ceramide",
    "Ceramides",
    "Ceramide NP",
    "Ceramide AP",
    "Ceramide EOP",
    "Ceramide NS",
    "세라마이드",
    "세라마이드 NP",
    "セラミド",
  ],
  [
    "Hyaluronic Acid",
    "Sodium Hyaluronate",
    "Hydrolyzed Hyaluronic Acid",
    "HA",
    "히알루론산",
    "히알루론산나트륨",
    "ヒアルロン酸",
    "ヒアルロン酸ナトリウム",
  ],
  ["Glycerin", "Glycerine", "Glycerol", "글리세린", "グリセリン"],
  ["Squalane", "Squalene", "스쿠알란", "スクワラン"],
  ["Cholesterol", "콜레스테롤", "コレステロール"],
  ["Allantoin", "알란토인", "アラントイン"],
  ["Betaine", "베타인", "ベタイン"],
  [
    "Niacinamide",
    "Vitamin B3",
    "Nicotinamide",
    "니아신아마이드",
    "나이아신아마이드",
    "ニコチン酸アミド",
    "ナイアシンアミド",
  ],
  ["Tranexamic Acid", "TXA", "트라넥삼산", "トラネキサム酸"],
  [
    "Arbutin",
    "Alpha-Arbutin",
    "α-Arbutin",
    "알부틴",
    "알파 알부틴",
    "알파아르부틴",
    "アルブチン",
  ],
  [
    "Vitamin C",
    "Ascorbic Acid",
    "L-Ascorbic Acid",
    "Ascorbyl Glucoside",
    "Ethyl Ascorbic Acid",
    "3-O-Ethyl Ascorbic Acid",
    "비타민 C",
    "아스코르빅애씨드",
    "아스코르빈산",
    "ビタミンC",
    "アスコルビン酸",
  ],
  [
    "Salicylic Acid",
    "BHA",
    "Beta Hydroxy Acid",
    "Betaine Salicylate",
    // LHA — 살리실산 유도체 BHA. `Betaine Salicylate` 를 이 그룹에 둔 것과 같은
    // 판단이다: 살리실산을 피하는 사용자에게는 유도체도 피해야 할 것이다.
    // 판단이 갈리면 «거르는 쪽» 을 고른다 — 못 거른 알레르겐이 잘못 거른 제품보다 나쁘다.
    //
    // `Benzyl Salicylate` 는 **일부러 다른 그룹**이다. 이름은 닮았지만 각질제거
    // 성분이 아니라 향료 알레르겐이라, 묶으면 서로를 잘못 거른다.
    "Capryloyl Salicylic Acid",
    "Lipohydroxy Acid",
    "LHA",
    "카프릴로일살리실릭애씨드",
    "살리실산",
    "サリチル酸",
  ],
  [
    "Glycolic Acid",
    "AHA",
    "Alpha Hydroxy Acid",
    "글리콜산",
    "グリコール酸",
  ],
  ["Lactic Acid", "락틱애씨드", "유산", "乳酸"],
  ["Mandelic Acid", "만델릭애씨드", "マンデル酸"],
  ["Azelaic Acid", "아젤라익애씨드", "アゼライン酸"],
  [
    "Tea Tree",
    "Melaleuca",
    "Melaleuca Alternifolia",
    "티트리",
    "ティーツリー",
  ],
  ["Benzoyl Peroxide", "벤조일퍼옥사이드", "過酸化ベンゾイル"],
  [
    "Retinol",
    "Retinal",
    "Retinaldehyde",
    "Retinyl Palmitate",
    "레티놀",
    "레티날",
    "レチノール",
  ],
  [
    "Peptide",
    "Peptides",
    "Copper Peptide",
    "Matrixyl",
    "Argireline",
    "펩타이드",
    "ペプチド",
  ],
  ["Adenosine", "아데노신", "アデノシン"],
  ["Bakuchiol", "바쿠치올", "バクチオール"],
  [
    "Snail Mucin",
    "Snail Secretion Filtrate",
    "달팽이점액여과물",
    "달팽이점액",
    "달팽이 뮤신",
    "달팽이뮤신",
    "スネイルムチン",
  ],
  ["Propolis", "프로폴리스", "プロポリス"],
  ["Green Tea", "Camellia Sinensis", "EGCG", "녹차", "緑茶"],
  ["Mugwort", "Artemisia", "Artemisia Princeps", "쑥", "ヨモギ"],
  [
    "Heartleaf",
    "Houttuynia Cordata",
    "Houttuynia Cordata Extract",
    "Houttuynia Cordata Flower/Leaf/Stem Water",
    "Houttuynia Cordata Flower Leaf Stem Water",
    "어성초",
    "ドクダミ",
  ],
  ["Zinc PCA", "Zinc", "징크 PCA", "亜鉛"],
  [
    "Zinc Oxide",
    "산화아연",
    "징크옥사이드",
    "ジンクオキサイド",
  ],
  [
    "Titanium Dioxide",
    "TiO2",
    "산화티타늄",
    "이산화티타늄",
    "チタンジオキサイド",
  ],
  [
    "Tocopherol",
    "Vitamin E",
    "토코페롤",
    "비타민 E",
    "トコフェロール",
  ],
  ["Collagen", "Hydrolyzed Collagen", "콜라겐", "コラーゲン"],
  [
    "Alcohol",
    "Alcohol Denat",
    "Alcohol Denat.",
    "Denatured Alcohol",
    "Ethanol",
    "SD Alcohol",
    "SD Alcohol 40",
    "고함량 알코올",
    "변성알코올",
    "에탄올",
    "アルコール",
  ],
  [
    "Fragrance",
    "Parfum",
    "Perfume",
    "강한 향료",
    "향료",
    "香料",
    "フレグランス",
  ],
  ["Essential Oil", "에센셜 오일", "精油"],

  // ── 향료 유래 표시 알레르겐 ────────────────────────────────────────────────
  // 국내 전성분은 한글 음역으로 적히는데(«리모넨»), 사용자·시나리오는 영문으로
  // 입력한다(«Limonene»). 둘을 잇지 않으면 알레르기 필터가 통과시켜 버린다.
  // Staging 실측: 리모넨 함유 19건 중 3건, 리날룰 18건 중 4건만 걸렸다.
  //
  // 한글↔영문 쌍은 전부 `ingredients` 테이블(식약처 화장품 원료성분정보 적재분)
  // 에서 확인한 것이다. 거기서 확인되지 않은 이름은 넣지 않았다.
  ["Limonene", "리모넨"],
  ["Linalool", "리날룰"],
  ["Citronellol", "시트로넬올"],
  ["Geraniol", "제라니올"],
  ["Citral", "시트랄"],
  ["Eugenol", "유제놀"],
  ["Coumarin", "쿠마린"],
  ["Farnesol", "파네솔"],
  ["Cinnamal", "신남알"],
  ["Hexyl Cinnamal", "헥실신남알"],
  ["Cinnamyl Alcohol", "신나밀알코올"],
  ["Benzyl Alcohol", "벤질알코올"],
  ["Benzyl Benzoate", "벤질벤조에이트"],
  ["Benzyl Salicylate", "벤질살리실레이트"],
  ["Hydroxycitronellal", "하이드록시시트로넬알"],
  ["Butylphenyl Methylpropional", "부틸페닐메틸프로피오날"],
  ["Alpha-Isomethyl Ionone", "알파-아이소메틸아이오논"],
] as const;

let aliasLookup: Map<string, string> | null = null;

function buildAliasLookup(
  normalizeKey: (s: string) => string
): Map<string, string> {
  const map = new Map<string, string>();
  for (const group of INGREDIENT_ALIAS_GROUPS) {
    if (group.length === 0) continue;
    const canonical = normalizeKey(group[0]);
    if (!canonical) continue;
    for (const alias of group) {
      const key = normalizeKey(alias);
      if (key) map.set(key, canonical);
    }
  }
  return map;
}

export function toCanonicalIngredientKey(
  name: string,
  normalizeKey: (s: string) => string
): string {
  if (!aliasLookup) {
    aliasLookup = buildAliasLookup(normalizeKey);
  }
  const key = normalizeKey(name);
  if (!key) return "";
  return aliasLookup.get(key) ?? key;
}

/** @deprecated 캐논컬 단일 비교 권장. 호환용 */
export function expandIngredientMatchKeys(
  name: string,
  normalizeKey: (s: string) => string
): Set<string> {
  const keys = new Set<string>();
  const raw = normalizeKey(name);
  if (raw) keys.add(raw);
  const canonical = toCanonicalIngredientKey(name, normalizeKey);
  if (canonical) keys.add(canonical);
  return keys;
}

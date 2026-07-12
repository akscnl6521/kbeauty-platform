/**
 * 브랜드명 표시·정규화 (단일 소스).
 *
 * 원칙:
 * - 브랜드명은 일반 문장처럼 번역하지 않는다.
 * - AI/일반 번역 함수에 브랜드명을 보내지 않는다.
 * - 제품명 로직과 분리한다.
 * - 불확실한 값은 자동 수정하지 않고 원문을 유지한다.
 */

export type BrandLocale = "en" | "ja" | "ko";

/** 향후 다국어 확장용 브랜드 표시 타입 */
export type BrandDisplayName = {
  canonicalBrandName: string;
  localizedBrandNameKo?: string;
  localizedBrandNameEn?: string;
  localizedBrandNameJa?: string;
};

type BrandRegistryEntry = BrandDisplayName & {
  /** normalizeBrandKey 된 별칭·오번역·철자 변형 */
  aliases: readonly string[];
};

/**
 * 공식 브랜드 레지스트리.
 * localizedBrandNameKo 는 검증된 공식 한글 표기만 둔다.
 * (임의 직역·기계번역 한글은 넣지 않음 — Hangul 오번역은 aliases 로만 복구)
 */
const BRAND_REGISTRY: readonly BrandRegistryEntry[] = [
  {
    canonicalBrandName: "Peach Slices",
    aliases: ["peach slices", "peacheslices", "복숭아 조각", "복숭아조각"],
  },
  {
    canonicalBrandName: "Beauty of Joseon",
    aliases: [
      "beauty of joseon",
      "beautyofjoseon",
      "boj",
      "조선의 아름다움",
      "조선의아름다움",
      "조선의 아룸다움",
      "조선의아룸다움",
    ],
  },
  {
    canonicalBrandName: "ETUDE",
    aliases: [
      "etude",
      "etude house",
      "etudehouse",
      "에뛰드",
      "에뛰드 하우스",
      "에뛰드하우스",
    ],
  },
  {
    canonicalBrandName: "TIRTIR",
    aliases: ["tirtir", "tir tir", "티르티르"],
  },
  {
    canonicalBrandName: "medicube",
    aliases: ["medicube", "medi cube", "메디큐브"],
  },
  {
    canonicalBrandName: "COSRX",
    aliases: ["cosrx", "cos rx", "코스알엑스"],
  },
  {
    canonicalBrandName: "Isntree",
    aliases: ["isntree", "isn'tree", "isn tree", "이즈앤트리"],
  },
  {
    canonicalBrandName: "Rovectin",
    aliases: ["rovectin", "로벡틴"],
  },
  {
    canonicalBrandName: "SKIN1004",
    aliases: ["skin1004", "skin 1004", "스킨1004", "스킨 1004"],
  },
  {
    canonicalBrandName: "Purito",
    aliases: ["purito", "퓨리토"],
  },
  {
    canonicalBrandName: "Klairs",
    aliases: ["klairs", "dear klairs", "dear, klairs", "클레어스"],
  },
  {
    canonicalBrandName: "Dr. Jart+",
    aliases: [
      "dr. jart+",
      "dr jart+",
      "dr.jart+",
      "dr jart",
      "dr. jart",
      "닥터자르트",
    ],
  },
  {
    canonicalBrandName: "Abib",
    aliases: ["abib", "아비브"],
  },
  {
    canonicalBrandName: "Nacific",
    aliases: ["nacific", "나씨픽", "나시픽"],
  },
  {
    canonicalBrandName: "mixsoon",
    aliases: ["mixsoon", "mix soon", "믹순"],
  },
  {
    canonicalBrandName: "Axis-Y",
    aliases: ["axis-y", "axis y", "axisy", "엑시스와이", "엑시스-와이"],
  },
  {
    canonicalBrandName: "Some By Mi",
    aliases: ["some by mi", "somebymi", "some by me", "썸바이미"],
  },
];

function collapseSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** 매칭용 키 */
export function normalizeBrandKey(value: string): string {
  return collapseSpaces(value)
    .toLowerCase()
    .replace(/[,.'’]/g, "");
}

function buildAliasIndex(): Map<string, BrandRegistryEntry> {
  const map = new Map<string, BrandRegistryEntry>();
  for (const entry of BRAND_REGISTRY) {
    const keys = new Set<string>();
    keys.add(normalizeBrandKey(entry.canonicalBrandName));
    keys.add(normalizeBrandKey(entry.canonicalBrandName).replace(/\s+/g, ""));
    for (const alias of entry.aliases) {
      keys.add(normalizeBrandKey(alias));
      keys.add(normalizeBrandKey(alias).replace(/\s+/g, ""));
    }
    for (const key of keys) {
      if (key) map.set(key, entry);
    }
  }
  return map;
}

const ALIAS_INDEX = buildAliasIndex();

/** 제품명 앞머리에서 제거할 알려진 오번역 브랜드 접두어 */
const MISTRANSLATED_BRAND_PREFIXES: readonly string[] = [
  "복숭아 조각",
  "복숭아조각",
  "조선의 아름다움",
  "조선의아름다움",
  "조선의 아룸다움",
  "조선의아룸다움",
];

function lookupBrandEntry(
  raw: string
): BrandRegistryEntry | undefined {
  const key = normalizeBrandKey(raw);
  if (!key) return undefined;
  return (
    ALIAS_INDEX.get(key) ??
    ALIAS_INDEX.get(key.replace(/\s+/g, ""))
  );
}

/** raw → BrandDisplayName (레지스트리 매칭 시). 불확실하면 null */
export function resolveBrandDisplayName(
  raw: string | null | undefined
): BrandDisplayName | null {
  if (raw == null) return null;
  const trimmed = collapseSpaces(String(raw));
  if (!trimmed) return null;

  const entry = lookupBrandEntry(trimmed);
  if (!entry) return null;

  return {
    canonicalBrandName: entry.canonicalBrandName,
    ...(entry.localizedBrandNameKo
      ? { localizedBrandNameKo: entry.localizedBrandNameKo }
      : {}),
    ...(entry.localizedBrandNameEn
      ? { localizedBrandNameEn: entry.localizedBrandNameEn }
      : {}),
    ...(entry.localizedBrandNameJa
      ? { localizedBrandNameJa: entry.localizedBrandNameJa }
      : {}),
  };
}

/**
 * DB/입력 브랜드 → canonicalBrandName.
 * 알려진 오번역·별칭만 복구. 불확실하면 원문 유지.
 */
export function getCanonicalBrandName(
  raw: string | null | undefined
): string | null {
  if (raw == null) return null;
  const trimmed = collapseSpaces(String(raw));
  if (!trimmed) return null;

  const resolved = resolveBrandDisplayName(trimmed);
  return resolved?.canonicalBrandName ?? trimmed;
}

/**
 * 화면 표시용 브랜드명.
 * 우선순위:
 * 1) 공식 검증 localizedBrandNameKo (locale=ko)
 * 2) canonicalBrandName
 * 3) raw brand
 *
 * 한국어 UI여도 공식 KO가 없으면 영문 공식명을 유지한다 (임의 직역 금지).
 */
export function displayBrandName(
  raw: string | null | undefined,
  locale: BrandLocale = "en"
): string | null {
  if (raw == null) return null;
  const trimmed = collapseSpaces(String(raw));
  if (!trimmed) return null;

  const resolved = resolveBrandDisplayName(trimmed);
  if (!resolved) return trimmed;

  if (locale === "ko" && resolved.localizedBrandNameKo) {
    return resolved.localizedBrandNameKo;
  }
  if (locale === "en" && resolved.localizedBrandNameEn) {
    return resolved.localizedBrandNameEn;
  }
  if (locale === "ja" && resolved.localizedBrandNameJa) {
    return resolved.localizedBrandNameJa;
  }

  return resolved.canonicalBrandName;
}

/**
 * 제품명에서 잘못 번역된 브랜드 접두어만 제거.
 * 브랜드 표시 로직과 섞지 않는다.
 */
export function stripMistranslatedBrandFromProductName(
  productName: string | null | undefined,
  brandRaw?: string | null
): string {
  let name = collapseSpaces(String(productName ?? ""));
  if (!name) return "";

  const prefixes = new Set<string>(MISTRANSLATED_BRAND_PREFIXES);
  const resolved = resolveBrandDisplayName(brandRaw ?? null);
  if (resolved) {
    prefixes.add(resolved.canonicalBrandName);
    const entry = lookupBrandEntry(resolved.canonicalBrandName);
    if (entry) {
      for (const alias of entry.aliases) {
        if (/[\uAC00-\uD7A3]/.test(alias)) prefixes.add(alias);
      }
    }
  }

  for (const prefix of prefixes) {
    const p = collapseSpaces(prefix);
    if (!p) continue;
    if (normalizeBrandKey(name).startsWith(normalizeBrandKey(p))) {
      // 원문 길이 기준으로 잘라냄 (키 정규화와 길이 불일치 완화)
      const re = new RegExp(
        `^${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\-–—:·|/]*`,
        "i"
      );
      name = collapseSpaces(name.replace(re, ""));
    }
  }

  return name;
}

/**
 * 제품명 표시 (브랜드와 분리).
 * 브랜드 번역/치환을 제품명에 적용하지 않는다.
 */
export function displayProductTitle(options: {
  name?: string | null;
  nameKo?: string | null;
  nameJa?: string | null;
  brand?: string | null;
  locale?: BrandLocale;
}): string {
  const locale = options.locale ?? "en";

  let rawTitle =
    locale === "ko" && options.nameKo
      ? options.nameKo
      : locale === "ja" && options.nameJa
        ? options.nameJa
        : options.name ?? options.nameKo ?? options.nameJa ?? "";

  rawTitle = stripMistranslatedBrandFromProductName(rawTitle, options.brand);

  if (!rawTitle && options.name) {
    rawTitle = stripMistranslatedBrandFromProductName(
      options.name,
      options.brand
    );
  }

  return rawTitle || "Untitled product";
}

/** 개발·감사: 레지스트리 canonical 목록 */
export function listCanonicalBrandNames(): string[] {
  return BRAND_REGISTRY.map((e) => e.canonicalBrandName);
}

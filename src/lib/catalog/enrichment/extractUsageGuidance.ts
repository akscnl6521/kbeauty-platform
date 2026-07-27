/**
 * Pull §36.5 usage guidance (도포량 · 사용 순서 · 사용 부위 · 주의사항) out of an
 * official product page.
 *
 * Pure — no network, no DB. Extraction only: every field is either literally
 * present in the source text or left null. Nothing is inferred, completed, or
 * rephrased, because a usage instruction we invented would be a safety claim we
 * invented.
 */

export type UsageCautionKind = "statutory" | "product_specific";

export type ExtractedCaution = {
  text: string;
  /**
   * Korean cosmetics law mandates a fixed caution block on every product. It is
   * worth storing, but it says nothing specific about *this* product, so it is
   * labelled rather than passed off as product-specific guidance.
   */
  kind: UsageCautionKind;
};

export type UsageFrequency = "morning" | "evening" | "weekly" | "as_needed";

export type ExtractedUsageGuidance = {
  /** 도포량 — only when the page states a quantity. */
  amountLabel: string | null;
  /** 바르는 방법, one sentence per step, in source order. */
  methodSteps: string[];
  /** 사용 부위 — tokens found verbatim in the method text. */
  applicationArea: string[];
  /** 사용 순서 — e.g. "세안 후", "스킨케어 마무리 후". Verbatim phrases only. */
  orderHints: string[];
  /** 아침·저녁 구분, only when stated. */
  frequency: UsageFrequency | null;
  cautions: ExtractedCaution[];
  /** The raw matched section, so a reviewer can compare against the page. */
  sourceExcerpt: string | null;
  /** Which §36.5 fields the page did not provide. */
  missingFields: string[];
};

const SECTION_HEADINGS =
  /(사용\s*방법|사용법|이렇게\s*사용|사용\s*Tip|how\s*to\s*use|directions?)\s*[:：]?/i;

const CAUTION_HEADINGS =
  /(사용\s*할?\s*때의?\s*주의\s*사항|사용상의\s*주의\s*사항|주의\s*사항|caution|warning)\s*[:：]?/i;

/**
 * Where a usage section stops: the next unrelated block on the page.
 * Whitespace-tolerant — Korean storefronts write both "화장품제조업자" and
 * "화장품 제조업자", and a terminator that misses lets the manufacturer block or
 * the ingredient list masquerade as a usage step.
 */
const BLOCK_TERMINATORS =
  /(전\s*성분|모든\s*성분|화장품\s*제조업자|화장품\s*책임\s*판매업자|맞춤형\s*화장품\s*판매업자|제조\s*국|사용\s*기한|품질\s*보증|소비자\s*상담|배송\s*안내|배송\s*방법|교환|환불|반품|리뷰|review|이용약관|고객\s*센터|제품\s*문의|ingredients?\b|shipping|returns?)/i;

/**
 * The usage block additionally stops at the caution heading — cautions are their
 * own field, and a "do not use on eyelashes" warning read as a usage step would
 * invert its meaning.
 */
const SECTION_TERMINATORS = new RegExp(
  `(${BLOCK_TERMINATORS.source}|사용\\s*할?\\s*때의?\\s*주의|사용상의\\s*주의|주의\\s*사항|caution|warning)`,
  "i"
);

/**
 * The caution block must not stop at a caution heading, or the statutory list —
 * which repeats "보관 및 취급 시 주의사항" partway through — gets cut mid-item.
 */
const CAUTION_TERMINATORS = BLOCK_TERMINATORS;

/**
 * Text that occupies the usage slot without saying anything. Korean storefronts
 * routinely fill the field with "see the detail page", which is a pointer, not an
 * instruction — storing it would claim we have guidance we do not have.
 */
const PLACEHOLDER_STEPS: RegExp[] = [
  /^제품\s*상세\s*페이지\s*참조$/,
  /상세\s*페이지\s*참조/,
  /상세\s*이미지\s*참조/,
  /상세\s*설명\s*참조/,
  /^해당\s*사항\s*없음$/,
  /^별도\s*표기$/,
  /^[-–—.\s]*$/,
  /^상세\s*페이지\s*참고/,
];

/**
 * A real instruction tells you to do something to the product or your skin.
 *
 * Korean verb stems change when conjugated, so matching the dictionary stem
 * alone silently misses most real sentences: 바르다 appears as 바른다 / 발라 /
 * 바릅니다, and 헹구다 as 헹군 / 헹궈. An earlier version listed only 바르 and
 * 헹구, which rejected pages whose usage text was perfectly good — "모발에 균등히
 * 바른다" matched nothing at all.
 */
const INSTRUCTIONAL_MARKERS = new RegExp(
  [
    "바르|바른|바릅|발라|발랐|발린", // 바르다
    "도포",
    "문지르|문질러|문지릅",
    "두드리|두드려|두드립|두들",
    "헹구|헹군|헹궈|헹굽",
    "마사지",
    "덜어|덜은|덜어서",
    "펴\\s|펴발|펴 바",
    "씻어|씻고|씻은|씻습",
    "뿌리|뿌려|뿌립",
    "짜서|짜내",
    "적신|적셔",
    "흡수",
    "섞어|섞은|섞습", // mixing instructions (hair dye, two-part products)
    "감아|감고|감습", // 머리를 감다
    "닦아|닦고|닦은|닦습", // 닦다 — toner on a pad
    "뿜어|분사",
    "apply|massage|rinse|dispense|spread|pat\\s|lather|cleanse",
    "spray|wipe|smooth\\s|blot|sweep|glide",
  ].join("|"),
  "i"
);

function isPlaceholderStep(step: string): boolean {
  return PLACEHOLDER_STEPS.some((pattern) => pattern.test(step.trim()));
}

/**
 * "손에 덜어" means dispense into your palm, not apply to your hands. Without
 * this, almost every face product would claim the hand as an application area.
 */
const DISPENSING_PHRASES = [
  /손(바닥)?에\s*(적당량을?\s*)?(덜어|짜서|짜|덜은|덜은\s*뒤)/,
  /손(바닥)?으로/,
  /손(바닥)?에\s*펌핑/,
  /손(바닥)?에\s*올려/,
];

function isDispensingMention(block: string, token: string): boolean {
  if (token !== "손") return false;
  const dispensing = DISPENSING_PHRASES.some((pattern) => pattern.test(block));
  if (!dispensing) return false;
  // Unless the text separately tells you to treat the hands themselves.
  return !/(손등|손톱|손\s*전체|손에\s*발라|손에\s*바르)/.test(block);
}

/** Statutory Korean cosmetic caution boilerplate (화장품법 시행규칙 별표 3). */
const STATUTORY_CAUTION_MARKERS = [
  /직사광선에\s*의하여\s*사용부위가\s*붉은\s*반점/,
  /이상\s*증상이나\s*부작용이\s*있는\s*경우/,
  /상처가\s*있는\s*부위\s*등에는\s*사용을\s*자제/,
  /어린이의\s*손이\s*닿지\s*않는\s*곳에\s*보관/,
  /직사광선을\s*피해서\s*보관/,
  /보관\s*및\s*취급\s*시(의)?\s*주의\s*사항/,
];

/**
 * Amount expressions. Each pattern captures the quantity phrase as written —
 * the label stored is a substring of the page, never a paraphrase.
 */
const AMOUNT_PATTERNS: RegExp[] = [
  /\d+\s*[~-]?\s*\d*\s*회\s*펌핑/,
  /\d+\s*[~-]?\s*\d*\s*번\s*펌핑/,
  /\d+\s*[~-]?\s*\d*\s*방울/,
  /\d+\s*[~-]?\s*\d*\s*펌프/,
  /(콩알|쌀알|동전|500원|100원)\s*(크기|만큼|정도)?/,
  /\d+\s*[~-]?\s*\d*\s*(ml|밀리리터|g|그램)/i,
  /적당량/,
  /소량/,
  /한\s*[~-]?\s*두\s*방울/,
];

const AREA_TOKENS: Array<{ token: string; label: string }> = [
  { token: "얼굴 전체", label: "얼굴 전체" },
  { token: "얼굴", label: "얼굴" },
  { token: "눈가", label: "눈가" },
  { token: "눈 밑", label: "눈 밑" },
  { token: "입가", label: "입가" },
  { token: "입술", label: "입술" },
  { token: "이마", label: "이마" },
  { token: "볼", label: "볼" },
  { token: "코", label: "코" },
  { token: "턱", label: "턱" },
  { token: "목", label: "목" },
  { token: "두피", label: "두피" },
  { token: "모발", label: "모발" },
  { token: "머리카락", label: "모발" },
  { token: "손", label: "손" },
  { token: "바디", label: "바디" },
  { token: "전신", label: "전신" },
];

const ORDER_HINT_PATTERNS: RegExp[] = [
  /세안\s*후/,
  /클렌징\s*후/,
  /토너\s*(사용\s*)?후/,
  /스킨\s*(사용\s*)?후/,
  /에센스\s*(사용\s*)?후/,
  /세럼\s*(사용\s*)?후/,
  /스킨케어\s*(마무리\s*)?후/,
  /기초\s*(케어\s*)?후/,
  /마지막\s*단계/,
  /가장\s*마지막에/,
  /메이크업\s*전/,
  /메이크업\s*후/,
];

const FREQUENCY_PATTERNS: Array<{ pattern: RegExp; value: UsageFrequency }> = [
  { pattern: /아침\s*저녁|조석|아침과\s*저녁|morning\s*(and|&)\s*(night|evening)/i, value: "morning" },
  { pattern: /주\s*\d\s*[~-]?\s*\d*\s*회|주간|weekly/i, value: "weekly" },
  { pattern: /아침|모닝|낮|외출\s*전|morning|daytime/i, value: "morning" },
  { pattern: /저녁|밤|취침\s*전|자기\s*전|night|evening|before\s*bed/i, value: "evening" },
  { pattern: /필요할\s*때|수시로|as\s*needed/i, value: "as_needed" },
];

function splitSentences(block: string): string[] {
  return block
    .split(/\n+|(?<=[.。!?])\s+|(?<=습니다)\s+|(?<=하세요)\s+|(?<=주세요)\s+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Slice from a heading match to the first terminator or the length cap. */
function sliceSection(
  text: string,
  heading: RegExp,
  maxChars = 1200,
  terminators: RegExp = SECTION_TERMINATORS
): string | null {
  const match = heading.exec(text);
  if (!match) return null;
  const start = match.index + match[0].length;
  const rest = text.slice(start, start + maxChars);
  const terminator = terminators.exec(rest);
  const body = terminator ? rest.slice(0, terminator.index) : rest;
  const cleaned = body.replace(/\s+/g, " ").trim();
  return cleaned.length > 0 ? cleaned : null;
}

function isStatutoryCaution(text: string): boolean {
  return STATUTORY_CAUTION_MARKERS.some((pattern) => pattern.test(text));
}

function dedupe(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

/**
 * Extract usage guidance from the visible text of an official product page.
 * `text` must already be HTML-stripped.
 */
export function extractUsageGuidance(text: string): ExtractedUsageGuidance {
  const normalized = text.replace(/\r/g, "").replace(/[ \t]+/g, " ");

  const usageBlock = sliceSection(normalized, SECTION_HEADINGS);
  const cautionBlock = sliceSection(
    normalized,
    CAUTION_HEADINGS,
    1600,
    CAUTION_TERMINATORS
  );

  const methodSteps = usageBlock
    ? splitSentences(usageBlock)
        // drop marketing asides and footnotes that follow the instruction
        .filter((line) => !/^\*/.test(line))
        .filter((line) => line.length >= 4 && line.length <= 300)
        .filter((line) => !isPlaceholderStep(line))
        .slice(0, 8)
    : [];

  let amountLabel: string | null = null;
  if (usageBlock) {
    for (const pattern of AMOUNT_PATTERNS) {
      const found = pattern.exec(usageBlock);
      if (found) {
        amountLabel = found[0].replace(/\s+/g, " ").trim();
        break;
      }
    }
  }

  const applicationArea = usageBlock
    ? dedupe(
        AREA_TOKENS.filter(
          (entry) =>
            usageBlock.includes(entry.token) &&
            !isDispensingMention(usageBlock, entry.token)
        ).map((entry) => entry.label)
      )
    : [];
  // "얼굴 전체" already implies "얼굴"; keep the more specific one only.
  const areas = applicationArea.includes("얼굴 전체")
    ? applicationArea.filter((area) => area !== "얼굴")
    : applicationArea;

  const orderHints = usageBlock
    ? dedupe(
        ORDER_HINT_PATTERNS.map((pattern) => pattern.exec(usageBlock)?.[0] ?? "")
      )
    : [];

  let frequency: UsageFrequency | null = null;
  if (usageBlock) {
    for (const entry of FREQUENCY_PATTERNS) {
      if (entry.pattern.test(usageBlock)) {
        frequency = entry.value;
        break;
      }
    }
  }

  const cautions: ExtractedCaution[] = cautionBlock
    ? splitSentences(cautionBlock)
        .filter((line) => line.length >= 6 && line.length <= 300)
        .slice(0, 12)
        .map((line) => ({
          text: line,
          kind: isStatutoryCaution(line)
            ? ("statutory" as const)
            : ("product_specific" as const),
        }))
    : [];

  const missingFields: string[] = [];
  if (!amountLabel) missingFields.push("amountLabel");
  if (methodSteps.length === 0) missingFields.push("methodSteps");
  if (areas.length === 0) missingFields.push("applicationArea");
  if (orderHints.length === 0) missingFields.push("orderHints");
  if (!frequency) missingFields.push("frequency");
  if (cautions.length === 0) missingFields.push("cautions");

  return {
    amountLabel,
    methodSteps,
    applicationArea: areas,
    orderHints,
    frequency,
    cautions,
    sourceExcerpt: usageBlock ?? cautionBlock ?? null,
    missingFields,
  };
}

/** Strip HTML to the visible text the extractor expects. */
export function htmlToVisibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr|td|section)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

/**
 * Detect text that was decoded with the wrong charset.
 *
 * Korean brand storefronts still serve EUC-KR. Read as UTF-8 the page turns into
 * replacement characters, and the extractor will happily pull a "usage step" out
 * of the garbage. Storing that would be worse than storing nothing, so callers
 * check this before persisting anything.
 */
export function looksMojibake(text: string): boolean {
  if (!text) return false;
  const sample = text.slice(0, 4000);
  const replacements = (sample.match(/�/g) ?? []).length;
  if (replacements === 0) return false;
  // A stray replacement char happens; a decode failure produces them densely.
  return replacements / sample.length > 0.02;
}

/**
 * Is there enough here to be worth storing? A row with no method steps carries
 * no usage instruction, whatever else it captured — and text that failed to
 * decode is not guidance at all.
 */
export function hasUsableGuidance(guidance: ExtractedUsageGuidance): boolean {
  if (guidance.methodSteps.length === 0) return false;
  if (guidance.methodSteps.some((step) => looksMojibake(step))) return false;
  if (guidance.sourceExcerpt && looksMojibake(guidance.sourceExcerpt)) return false;
  // A block of prose that never tells the reader to do anything is not guidance.
  return guidance.methodSteps.some((step) => INSTRUCTIONAL_MARKERS.test(step));
}

/**
 * Which language the extracted guidance is actually written in.
 *
 * Global storefronts (cosrx.com) serve English while the Korean site serves
 * Korean, and the same product can yield either. Filing English steps under
 * locale 'ko' would hand a Korean reader English instructions.
 */
export function detectGuidanceLocale(steps: readonly string[]): "ko" | "en" {
  const joined = steps.join(" ");
  if (!joined.trim()) return "ko";
  const hangul = (joined.match(/[가-힣]/g) ?? []).length;
  const latin = (joined.match(/[A-Za-z]/g) ?? []).length;
  return hangul >= latin ? "ko" : "en";
}

/** Cautions that actually say something about this product. */
export function productSpecificCautions(
  guidance: ExtractedUsageGuidance
): string[] {
  return guidance.cautions
    .filter((caution) => caution.kind === "product_specific")
    .map((caution) => caution.text);
}

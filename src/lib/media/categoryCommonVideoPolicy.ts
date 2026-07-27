/**
 * Deciding whether an official-channel video is category-common (§36.2 "카테고리 공통 사용법")
 * or product marketing. Pure — no network, no DB.
 *
 * Nothing here approves anything. The output is a proposal a human reviewer
 * confirms in /admin/media-review; auto-approval is forbidden.
 */

export type OfficialSourceEvidence = {
  /** Brand as it appears in the catalog. */
  brand: string;
  /** The brand's own site, where the channel link was found. This is the evidence. */
  brandSiteUrl: string;
  /** Canonical UC… channel id the brand site pointed to. */
  channelId: string;
  /** Channel display name as YouTube reports it. */
  channelName: string | null;
};

export type VideoCandidate = {
  videoId: string;
  title: string;
  publishedAt: string | null;
  /** Channel that oEmbed reports as the uploader. */
  reportedChannelUrl: string | null;
  reportedChannelName: string | null;
  /** oEmbed returned an embed iframe → the uploader permits embedding. */
  embeddable: boolean;
};

export type CandidateClassification = {
  videoId: string;
  /** official = the uploader is the channel the brand's own site links to. */
  sourceVerified: boolean;
  scope: "category_common" | "product_specific" | "brand_general";
  /** Category this would attach to, when the title makes it unambiguous. */
  categorySlug: string | null;
  routineContext:
    | "am_routine"
    | "pm_routine"
    | "weekly_routine"
    | "category_common"
    | null;
  /** Signals that fired, for the reviewer to read. */
  educationalSignals: string[];
  marketingSignals: string[];
  /** Blocking problems — a candidate with any of these cannot be ingested at all. */
  blockers: string[];
  /** Always true. A machine never approves a rights decision. */
  needsHumanReview: true;
};

/** Title markers for product marketing. A brand channel is mostly this. */
const MARKETING_MARKERS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /신상|신제품|new\b|런칭|출시/i, label: "new_product_launch" },
  { pattern: /한정|에디션|콜라보|collab|기획/i, label: "limited_edition" },
  { pattern: /세일|할인|이벤트|증정|쿠폰|sale\b|deal\b/i, label: "promotion" },
  { pattern: /１위|1위|베스트|인기|viral|화제/i, label: "ranking_claim" },
  { pattern: /효과\s*검증|챌린지|challenge|후기|리뷰|review/i, label: "efficacy_or_review" },
  { pattern: /구매|사러|링크|구입/i, label: "purchase_prompt" },
];

/** Title markers for product-neutral instructional content. */
const EDUCATIONAL_MARKERS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /바르는\s*순서|사용\s*순서|스킨케어\s*순서|레이어링|layering|routine\s*order/i, label: "application_order" },
  { pattern: /사용법|사용\s*방법|바르는\s*법|도포|how\s*to\s*(use|apply)/i, label: "how_to_apply" },
  { pattern: /세안법|클렌징\s*방법|이중\s*세안|double\s*cleans/i, label: "cleansing_method" },
  { pattern: /아침\s*루틴|모닝\s*루틴|morning\s*routine/i, label: "am_routine" },
  { pattern: /저녁\s*루틴|나이트\s*루틴|evening\s*routine|night\s*routine/i, label: "pm_routine" },
  { pattern: /주간\s*루틴|weekly\s*routine/i, label: "weekly_routine" },
  { pattern: /적정량|사용량|얼마나|how\s*much/i, label: "amount_guidance" },
  { pattern: /가이드|guide|기초\s*상식|알아보기/i, label: "guide" },
];

const CATEGORY_MARKERS: Array<{ pattern: RegExp; slug: string }> = [
  { pattern: /클렌징|클렌저|세안|cleans/i, slug: "cleanser" },
  { pattern: /토너|스킨\b|toner/i, slug: "toner" },
  { pattern: /세럼|앰플|에센스|serum|ampoule|essence/i, slug: "serum" },
  { pattern: /크림|수분크림|moistur|cream/i, slug: "moisturizer" },
  { pattern: /선크림|자외선|썬크림|sunscreen|spf/i, slug: "sunscreen" },
  { pattern: /샴푸|두피|트리트먼트|shampoo|scalp/i, slug: "scalp_care" },
];

const ROUTINE_CONTEXT_BY_SIGNAL: Record<string, CandidateClassification["routineContext"]> = {
  am_routine: "am_routine",
  pm_routine: "pm_routine",
  weekly_routine: "weekly_routine",
};

function matchLabels(
  title: string,
  markers: Array<{ pattern: RegExp; label: string }>
): string[] {
  return markers.filter((m) => m.pattern.test(title)).map((m) => m.label);
}

/**
 * Does the title name a specific product? Detected loosely — the brand name plus
 * a product-ish noun, or an explicit product line marker. Conservative: when in
 * doubt this returns true, because a category-common asset must not name a product.
 */
export function titleNamesProduct(title: string, brand: string): boolean {
  const normalizedTitle = title.toLowerCase();
  const normalizedBrand = brand.toLowerCase().replace(/\s+official$/, "").trim();

  // "[COSRX] …" channel tags are branding, not a product name.
  const withoutChannelTag = normalizedTitle
    .replace(/^\s*[[［(]\s*[^\]］)]*\s*[\]］)]\s*/, "")
    .trim();

  const productNoun =
    /토너|세럼|앰플|에센스|크림|패드|클렌저|폼|선크림|마스크|밤|로션|샴푸|serum|toner|cream|pad|cleanser|essence|ampoule|mask|balm|lotion|shampoo/i;

  const brandMentioned =
    normalizedBrand.length > 1 && withoutChannelTag.includes(normalizedBrand);

  // A named line ("블루펩타이드", "원스텝 패드", "스네일 뮤신") reads as a product.
  const namedLine = /[가-힣A-Za-z]{2,}\s*(패드|세럼|토너|크림|앰플|에센스|클렌저|밤)/.test(
    withoutChannelTag
  );

  if (brandMentioned && productNoun.test(withoutChannelTag)) return true;
  if (namedLine) return true;
  return false;
}

export function classifyCandidate(
  candidate: VideoCandidate,
  evidence: OfficialSourceEvidence
): CandidateClassification {
  const blockers: string[] = [];

  const reportedId = (candidate.reportedChannelUrl || "").match(
    /channel\/(UC[\w-]{22})/
  )?.[1];
  const reportedHandle = (candidate.reportedChannelUrl || "")
    .match(/youtube\.com\/(@[\w.-]+)/)?.[1]
    ?.toLowerCase();

  // oEmbed reports handles, the brand site gave us an id — accept either proof.
  const sourceVerified =
    reportedId === evidence.channelId ||
    (!!reportedHandle && !!evidence.channelName
      ? reportedHandle.replace(/^@/, "") ===
        evidence.channelName.toLowerCase().replace(/\s+/g, "")
      : false) ||
    // the feed itself came from the verified channel id, so an oEmbed author that
    // merely restates that channel's display name is consistent
    (!!candidate.reportedChannelName &&
      !!evidence.channelName &&
      candidate.reportedChannelName.trim() === evidence.channelName.trim());

  if (!sourceVerified) blockers.push("uploader_is_not_the_official_channel");
  if (!candidate.embeddable) blockers.push("embedding_not_permitted");

  const educationalSignals = matchLabels(candidate.title, EDUCATIONAL_MARKERS);
  const marketingSignals = matchLabels(candidate.title, MARKETING_MARKERS);

  const namesProduct = titleNamesProduct(candidate.title, evidence.brand);
  if (namesProduct) marketingSignals.push("names_a_product");

  const categorySlug =
    CATEGORY_MARKERS.find((m) => m.pattern.test(candidate.title))?.slug ?? null;

  let scope: CandidateClassification["scope"];
  if (educationalSignals.length > 0 && !namesProduct && marketingSignals.length === 0) {
    scope = "category_common";
  } else if (namesProduct || marketingSignals.length > 0) {
    scope = "product_specific";
  } else {
    scope = "brand_general";
  }

  const routineSignal = educationalSignals.find(
    (signal) => signal in ROUTINE_CONTEXT_BY_SIGNAL
  );
  const routineContext =
    scope === "category_common"
      ? routineSignal
        ? ROUTINE_CONTEXT_BY_SIGNAL[routineSignal]
        : "category_common"
      : null;

  return {
    videoId: candidate.videoId,
    sourceVerified,
    scope,
    categorySlug,
    routineContext,
    educationalSignals,
    marketingSignals,
    blockers,
    needsHumanReview: true,
  };
}

/** Only candidates with no blockers may be written to the library at all. */
export function isIngestible(classification: CandidateClassification): boolean {
  return classification.blockers.length === 0;
}

/**
 * Self-imposed expiry for a ToS-based embed grant.
 *
 * YouTube's standard embed terms carry no end date, so there is no contractual
 * expiry to record. Storing `null` would mean "never re-check", which is exactly
 * what §41 forbids, so we stamp a one-year expiry that forces re-confirmation and
 * fails closed if nobody renews it.
 */
export function embedGrantExpiry(verifiedAt: Date): Date {
  const expiry = new Date(verifiedAt.getTime());
  expiry.setUTCFullYear(expiry.getUTCFullYear() + 1);
  return expiry;
}

/** §41: an approved video's URL is re-checked weekly. */
export function nextLivenessCheck(checkedAt: Date): Date {
  return new Date(checkedAt.getTime() + 7 * 24 * 60 * 60 * 1000);
}

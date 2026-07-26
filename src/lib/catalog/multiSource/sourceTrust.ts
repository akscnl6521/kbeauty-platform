import type { MultiSourceChannel, SourceTrustTier } from "./types";

export function trustForChannel(
  channel: MultiSourceChannel,
  opts?: { oliveyoungAsOfficialChannel?: boolean }
): SourceTrustTier {
  switch (channel) {
    case "official_brand":
      return "A";
    case "naver_brand_store":
      return "B";
    case "naver_shopping":
      return "B";
    case "oliveyoung":
      // Official Olive Young channel listing may be treated as B; marketplace default C.
      return opts?.oliveyoungAsOfficialChannel ? "B" : "C";
    case "coupang_official":
    case "authorized_retailer":
      return "C";
    case "open_beauty_facts":
      return "C";
    default:
      return "D";
  }
}

/** Unverified marketplace sellers must not finalize ingredients. */
export function canFinalizeIngredients(trust: SourceTrustTier): boolean {
  return trust === "A" || trust === "B" || trust === "C";
}

export function channelLabel(channel: MultiSourceChannel): string {
  return channel;
}

/** Numeric rank: lower is better (A=0 … D=3). */
export function trustTierRank(trust: SourceTrustTier): number {
  switch (trust) {
    case "A":
      return 0;
    case "B":
      return 1;
    case "C":
      return 2;
    case "D":
      return 3;
    default:
      return 99;
  }
}

/** Prefer higher trust (A over B over C over D). */
export function preferHigherTrust(
  a: SourceTrustTier,
  b: SourceTrustTier
): SourceTrustTier {
  return trustTierRank(a) <= trustTierRank(b) ? a : b;
}

/**
 * Pure-logic assertions for category-common video classification, plus a shape
 * check on the collected candidate registry when one is present.
 * Offline: no network, no DB.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  classifyCandidate,
  embedGrantExpiry,
  isIngestible,
  nextLivenessCheck,
  titleNamesProduct,
  type OfficialSourceEvidence,
  type VideoCandidate,
} from "../src/lib/media/categoryCommonVideoPolicy";

const EVIDENCE: OfficialSourceEvidence = {
  brand: "COSRX",
  brandSiteUrl: "https://www.cosrx.com/",
  channelId: "UC8_qETGWRNIH01-QEjWYBKw",
  channelName: "COSRX 코스알엑스",
};

function candidate(overrides: Partial<VideoCandidate> = {}): VideoCandidate {
  return {
    videoId: "abc12345678",
    title: "스킨케어 바르는 순서 완전정복",
    publishedAt: "2026-07-01T00:00:00.000Z",
    reportedChannelUrl: "https://www.youtube.com/channel/UC8_qETGWRNIH01-QEjWYBKw",
    reportedChannelName: "COSRX 코스알엑스",
    embeddable: true,
    ...overrides,
  };
}

// --- the classifier can actually recognise category-common content -----------
const educational = classifyCandidate(candidate(), EVIDENCE);
assert.equal(educational.scope, "category_common", "order explainer is category-common");
assert.equal(educational.sourceVerified, true, "official channel id matches");
assert.deepEqual(educational.blockers, [], "no blockers on a clean candidate");
assert.ok(
  educational.educationalSignals.includes("application_order"),
  "application-order signal fires"
);
assert.equal(educational.routineContext, "category_common", "defaults to category context");
assert.equal(educational.needsHumanReview, true, "never auto-approved");
assert.equal(isIngestible(educational), true, "clean candidate is ingestible");

const morning = classifyCandidate(
  candidate({ title: "아침 루틴 바르는 순서 알려드립니다" }),
  EVIDENCE
);
assert.equal(morning.scope, "category_common", "AM routine explainer");
assert.equal(morning.routineContext, "am_routine", "AM context detected");

const evening = classifyCandidate(
  candidate({ title: "저녁 루틴 사용 순서 가이드" }),
  EVIDENCE
);
assert.equal(evening.routineContext, "pm_routine", "PM context detected");

const cleansing = classifyCandidate(
  candidate({ title: "올바른 이중 세안법, 클렌징 방법 총정리" }),
  EVIDENCE
);
assert.equal(cleansing.scope, "category_common", "cleansing method explainer");
assert.equal(cleansing.categorySlug, "cleanser", "cleanser category detected");

const serumHowTo = classifyCandidate(
  candidate({ title: "세럼 바르는 법과 적정량" }),
  EVIDENCE
);
assert.equal(serumHowTo.categorySlug, "serum", "serum category detected");
assert.equal(serumHowTo.scope, "category_common", "how-to without a product name");

// --- marketing is not category-common ---------------------------------------
const launch = classifyCandidate(
  candidate({ title: "[COSRX] 요즘 핫한 펩타이드 신상 등장✨ 루틴💙" }),
  EVIDENCE
);
assert.equal(launch.scope, "product_specific", "new-product video is product-specific");
assert.ok(
  launch.marketingSignals.includes("new_product_launch"),
  "launch signal fires"
);

const limited = classifyCandidate(
  candidate({ title: "[COSRX] 7월 올리브영 한정, 코스알엑스 X 가나디 에디션" }),
  EVIDENCE
);
assert.equal(limited.scope, "product_specific", "limited edition is marketing");

const namedPad = classifyCandidate(
  candidate({ title: "✨NEW 원스텝 펩타이드 패드✨ 탄력? 눈으로 확인하세요!" }),
  EVIDENCE
);
assert.equal(namedPad.scope, "product_specific", "named product line is product-specific");
assert.ok(
  namedPad.marketingSignals.includes("names_a_product"),
  "product name detected"
);

// a channel tag in brackets is branding, not a product name
assert.equal(
  titleNamesProduct("[COSRX] 스킨케어 바르는 순서", "COSRX"),
  false,
  "channel tag alone does not name a product"
);
assert.equal(
  titleNamesProduct("COSRX 스네일 뮤신 에센스 사용법", "COSRX"),
  true,
  "brand plus product noun names a product"
);

// --- source and embed gates --------------------------------------------------
const impostor = classifyCandidate(
  candidate({
    reportedChannelUrl: "https://www.youtube.com/@corallista",
    reportedChannelName: "Ankita Chaturvedi (Corallista)",
  }),
  EVIDENCE
);
assert.equal(impostor.sourceVerified, false, "influencer re-upload is not official");
assert.ok(
  impostor.blockers.includes("uploader_is_not_the_official_channel"),
  "impostor blocked"
);
assert.equal(isIngestible(impostor), false, "impostor cannot be ingested");

const noEmbed = classifyCandidate(candidate({ embeddable: false }), EVIDENCE);
assert.ok(
  noEmbed.blockers.includes("embedding_not_permitted"),
  "embedding must be permitted"
);
assert.equal(isIngestible(noEmbed), false, "non-embeddable cannot be ingested");

// --- rights clock ------------------------------------------------------------
const verifiedAt = new Date("2026-07-27T00:00:00.000Z");
assert.equal(
  embedGrantExpiry(verifiedAt).toISOString(),
  "2027-07-27T00:00:00.000Z",
  "embed grant expires one year out"
);
assert.equal(
  nextLivenessCheck(verifiedAt).toISOString(),
  "2026-08-03T00:00:00.000Z",
  "URL re-checked weekly per §41"
);

// --- collected registry shape ------------------------------------------------
const registryRoot = path.join(process.cwd(), "data", "media", "category-common");
if (existsSync(registryRoot)) {
  const days = readdirSync(registryRoot).filter((name) => /^\d{4}-\d{2}-\d{2}$/.test(name));
  for (const day of days) {
    const file = path.join(registryRoot, day, "candidates.json");
    if (!existsSync(file)) continue;
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    assert.ok(Array.isArray(parsed.candidates), `${day}: candidates is an array`);
    for (const item of parsed.candidates) {
      assert.equal(
        item.sourceType,
        "official_brand",
        `${day}: only official brand sources are recorded`
      );
      assert.ok(
        String(item.sourceUrl).startsWith("https://"),
        `${day}: source is https`
      );
      assert.equal(
        item.rights.allowsCopy,
        false,
        `${day}: no candidate claims a copy right`
      );
      assert.equal(
        item.rights.allowsDownload,
        false,
        `${day}: no candidate claims a download right`
      );
      assert.ok(item.rights.rightsEndAt, `${day}: every candidate carries an expiry`);
      assert.ok(
        item.rights.evidenceUrl,
        `${day}: every candidate carries rights evidence`
      );
      assert.equal(
        item.classification.needsHumanReview,
        true,
        `${day}: nothing is pre-approved`
      );
    }
  }
  console.log(
    `[media-category-registry] checked ${days.length} collected registry snapshot(s)`
  );
}

console.log("[media-category-registry] self-test: ok");

/**
 * Collect category-common usage-video candidates from verified official channels.
 *
 * Chain of custody, per §36.3:
 *   brand's own site  →  official channel id  →  that channel's RSS feed  →  oEmbed
 *
 * The feed is the reason a video counts as official: it is served by YouTube for a
 * channel id the brand itself published, so the uploader cannot be spoofed by a
 * search result. oEmbed then proves the video is live and that the uploader permits
 * embedding — which is the entire basis of the rights grant we record.
 *
 * Never downloads video content. Never writes to a database. Never approves.
 *
 *   npx tsx scripts/collect-category-common-videos.ts
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import {
  classifyCandidate,
  embedGrantExpiry,
  isIngestible,
  nextLivenessCheck,
  type OfficialSourceEvidence,
  type VideoCandidate,
} from "../src/lib/media/categoryCommonVideoPolicy";

const root = process.cwd();
const CHANNEL_REPORT = path.join(
  root,
  "artifacts",
  "media-channels",
  "brand-official-channels.json"
);

const UA =
  "Mozilla/5.0 (compatible; KBeautyMatchMediaResearch/1.0; +https://www.kbeautymatch.com)";

type ChannelReport = {
  results: Array<{
    brand: string;
    site: string;
    status: string;
    channels?: Array<{ link: string; channelId: string | null }>;
  }>;
};

async function fetchText(url: string, timeoutMs = 15000): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

type FeedEntry = { videoId: string; title: string; publishedAt: string | null };

function parseFeed(xml: string): { author: string | null; entries: FeedEntry[] } {
  const author = xml.match(/<author>\s*<name>([^<]*)<\/name>/)?.[1]?.trim() ?? null;
  const entries: FeedEntry[] = [];
  for (const block of xml.split("<entry>").slice(1)) {
    const videoId = block.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
    const title = block.match(/<title>([\s\S]*?)<\/title>/)?.[1];
    const published = block.match(/<published>([^<]+)<\/published>/)?.[1] ?? null;
    if (!videoId || !title) continue;
    entries.push({
      videoId,
      title: title
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim(),
      publishedAt: published,
    });
  }
  return { author, entries };
}

type OEmbed = {
  title?: string;
  author_name?: string;
  author_url?: string;
  html?: string;
};

async function checkEmbeddable(videoId: string): Promise<VideoCandidate | null> {
  const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(
    `https://www.youtube.com/watch?v=${videoId}`
  )}&format=json`;
  const raw = await fetchText(url, 12000);
  if (!raw) return null; // 401/404 → private, deleted, or embedding disabled
  let parsed: OEmbed;
  try {
    parsed = JSON.parse(raw) as OEmbed;
  } catch {
    return null;
  }
  return {
    videoId,
    title: parsed.title ?? "",
    publishedAt: null,
    reportedChannelUrl: parsed.author_url ?? null,
    reportedChannelName: parsed.author_name ?? null,
    embeddable: typeof parsed.html === "string" && parsed.html.includes("<iframe"),
  };
}

async function main() {
if (!existsSync(CHANNEL_REPORT)) {
  console.error(
    "[collect-category-videos] run scripts/discover-brand-official-channels.mjs first"
  );
  process.exit(1);
}

const report = JSON.parse(readFileSync(CHANNEL_REPORT, "utf8")) as ChannelReport;
const verifiedChannels = report.results
  .filter((entry) => entry.status === "resolved")
  .flatMap((entry) =>
    (entry.channels ?? [])
      .filter((channel) => channel.channelId)
      .map((channel) => ({
        brand: entry.brand,
        brandSiteUrl: entry.site,
        channelId: channel.channelId as string,
      }))
  );

console.log(
  `[collect-category-videos] ${verifiedChannels.length} official channels with brand-site evidence`
);

const now = new Date();
const candidates: Array<Record<string, unknown>> = [];
let scanned = 0;
let unreachable = 0;

for (const channel of verifiedChannels) {
  const xml = await fetchText(
    `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.channelId}`
  );
  if (!xml) {
    console.log(`  ${channel.brand.padEnd(18)} feed unavailable`);
    continue;
  }
  const { author, entries } = parseFeed(xml);
  const evidence: OfficialSourceEvidence = {
    brand: channel.brand,
    brandSiteUrl: channel.brandSiteUrl,
    channelId: channel.channelId,
    channelName: author,
  };

  let categoryCommon = 0;
  for (const entry of entries) {
    scanned += 1;
    const probed = await checkEmbeddable(entry.videoId);
    if (!probed) {
      unreachable += 1;
      continue;
    }
    const candidate: VideoCandidate = {
      ...probed,
      title: probed.title || entry.title,
      publishedAt: entry.publishedAt,
    };
    const classification = classifyCandidate(candidate, evidence);
    if (classification.scope === "category_common") categoryCommon += 1;

    candidates.push({
      brand: channel.brand,
      sourceType: "official_brand",
      sourceUrl: `https://www.youtube.com/watch?v=${entry.videoId}`,
      embedProvider: "youtube",
      embedId: entry.videoId,
      title: candidate.title,
      publishedAt: entry.publishedAt,
      channelId: channel.channelId,
      channelName: author,
      channelEvidenceUrl: channel.brandSiteUrl,
      language: "ko",
      classification,
      ingestible: isIngestible(classification),
      rights: {
        rightsStatus: "embed_only",
        rightsBasis:
          "YouTube 표준 임베드 약관 — oEmbed가 임베드 iframe을 반환(업로더가 임베드를 허용)",
        rightsHolder: author ?? channel.brand,
        allowsEmbed: candidate.embeddable,
        allowsCopy: false,
        allowsDownload: false,
        allowsModification: false,
        rightsStartAt: now.toISOString(),
        // no contractual end date exists; this is a self-imposed re-confirmation deadline
        rightsEndAt: embedGrantExpiry(now).toISOString(),
        rightsEndAtNote:
          "계약상 만료일이 아니라 자체 재확인 기한. 갱신하지 않으면 자동으로 공개 대상에서 빠진다.",
        isWorldwide: false,
        territoryCodes: ["KR"],
        evidenceUrl: channel.brandSiteUrl,
        reviewDueAt: nextLivenessCheck(now).toISOString(),
      },
    });
  }
  console.log(
    `  ${channel.brand.padEnd(18)} ${entries.length} videos · category-common ${categoryCommon}`
  );
}

const day = now.toISOString().slice(0, 10);
const outDir = path.join(root, "data", "media", "category-common", day);
mkdirSync(outDir, { recursive: true });

const ingestible = candidates.filter((c) => c.ingestible);
const categoryCommon = ingestible.filter(
  (c) => (c.classification as { scope: string }).scope === "category_common"
);

writeFileSync(
  path.join(outDir, "candidates.json"),
  `${JSON.stringify(
    {
      generatedAt: now.toISOString(),
      policy:
        "Official brand channels only, resolved from each brand's own website. Embeddable per oEmbed. No copies stored. Nothing approved — every row needs human review in /admin/media-review.",
      totals: {
        channels: verifiedChannels.length,
        scanned,
        unreachableOrNotEmbeddable: unreachable,
        ingestible: ingestible.length,
        categoryCommon: categoryCommon.length,
        productSpecific: ingestible.length - categoryCommon.length,
      },
      candidates,
    },
    null,
    2
  )}\n`,
  "utf8"
);

console.log("");
console.log(`[collect-category-videos] scanned ${scanned} official videos`);
console.log(
  `[collect-category-videos] ${unreachable} not embeddable / unreachable — excluded`
);
console.log(
  `[collect-category-videos] category-common candidates: ${categoryCommon.length}`
);
console.log(
  `[collect-category-videos] product-specific (out of scope this track): ${ingestible.length - categoryCommon.length}`
);
console.log(`[collect-category-videos] report: data/media/category-common/${day}/candidates.json`);
}

main().catch((error) => {
  console.error("[collect-category-videos] failed:", error);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Find each brand's official YouTube channel from the brand's OWN website.
 *
 * The brand site is the evidence: a link in the brand's own footer is what makes
 * a channel "official" for §36.3 purposes. Search results are not evidence — they
 * routinely attribute influencer re-uploads to brands.
 *
 * Read-only. Fetches one page per brand, writes a JSON report. Writes nothing to
 * any database and never downloads video content.
 *
 *   node scripts/discover-brand-official-channels.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Brands present in the Staging catalog, plus the authorized retailers and brand
 * houses §36.3 also accepts as an official source. Educational, product-neutral
 * content is far likelier from a retailer or a house channel than from a single
 * brand's channel, which exists to sell that brand's products.
 */
const BRAND_SITES = [
  { brand: "올리브영", site: "https://www.oliveyoung.co.kr/store/main/main.do" },
  { brand: "아모레퍼시픽", site: "https://www.apgroup.com/int/ko/index.html" },
  { brand: "LG생활건강", site: "https://www.lgcare.com/" },
  { brand: "이니스프리", site: "https://www.innisfree.com/kr/ko/Main.do" },
  { brand: "에뛰드", site: "https://www.etude.com/kr/ko/main" },
  { brand: "COSRX", site: "https://www.cosrx.com/" },
  { brand: "Torriden", site: "https://www.torriden.com/" },
  { brand: "Anua", site: "https://anua.com/" },
  { brand: "Isntree", site: "https://isntree.com/" },
  { brand: "SKIN1004", site: "https://skin1004.com/" },
  { brand: "Beauty of Joseon", site: "https://beautyofjoseon.com/" },
  { brand: "Round Lab", site: "https://roundlab.co.kr/" },
  { brand: "haruharu wonder", site: "https://haruharuwonder.com/" },
  { brand: "AESTURA", site: "https://www.aestura.com/" },
  { brand: "Laneige", site: "https://www.laneige.com/kr/ko/index.html" },
  { brand: "Sulwhasoo", site: "https://www.sulwhasoo.com/kr/ko/index.html" },
  { brand: "banila co.", site: "https://www.banilaco.com/" },
  { brand: "넘버즈인", site: "https://numbuzin.com/" },
  { brand: "에스쁘아", site: "https://www.espoir.com/" },
  { brand: "미쟝센", site: "https://www.miseenscene.co.kr/" },
];

const UA =
  "Mozilla/5.0 (compatible; KBeautyMatchMediaResearch/1.0; +https://www.kbeautymatch.com)";

async function fetchText(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false, status: res.status, text: "" };
    return { ok: true, status: res.status, text: await res.text() };
  } catch (error) {
    return { ok: false, status: 0, text: "", error: String(error?.message || error) };
  } finally {
    clearTimeout(timer);
  }
}

function extractYouTubeLinks(html) {
  const found = new Set();
  const patterns = [
    /https?:\/\/(?:www\.)?youtube\.com\/channel\/(UC[\w-]{22})/g,
    /https?:\/\/(?:www\.)?youtube\.com\/(@[\w.-]+)/g,
    /https?:\/\/(?:www\.)?youtube\.com\/(?:c|user)\/([\w.-]+)/g,
  ];
  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      found.add(match[0].replace(/\\+$/, ""));
    }
  }
  return [...found];
}

/** Resolve a handle/custom URL to the canonical UC… channel id. */
async function resolveChannelId(channelUrl) {
  const direct = channelUrl.match(/\/channel\/(UC[\w-]{22})/);
  if (direct) return direct[1];
  const page = await fetchText(channelUrl);
  if (!page.ok) return null;
  const byJson = page.text.match(/"channelId"\s*:\s*"(UC[\w-]{22})"/);
  if (byJson) return byJson[1];
  const byMeta = page.text.match(
    /<meta[^>]+itemprop="identifier"[^>]+content="(UC[\w-]{22})"/
  );
  if (byMeta) return byMeta[1];
  const byCanonical = page.text.match(/channel\/(UC[\w-]{22})/);
  return byCanonical ? byCanonical[1] : null;
}

const results = [];
for (const entry of BRAND_SITES) {
  const page = await fetchText(entry.site);
  if (!page.ok) {
    results.push({
      ...entry,
      status: "site_unreachable",
      httpStatus: page.status,
      note: page.error ?? null,
      channels: [],
    });
    console.log(`${entry.brand.padEnd(18)} site unreachable (${page.status})`);
    continue;
  }
  const links = extractYouTubeLinks(page.text);
  if (links.length === 0) {
    results.push({ ...entry, status: "no_youtube_link", channels: [] });
    console.log(`${entry.brand.padEnd(18)} no YouTube link on official site`);
    continue;
  }
  const channels = [];
  for (const link of links.slice(0, 3)) {
    const channelId = await resolveChannelId(link);
    channels.push({ link, channelId });
  }
  const resolved = channels.filter((c) => c.channelId);
  results.push({
    ...entry,
    status: resolved.length > 0 ? "resolved" : "link_unresolved",
    channels,
  });
  console.log(
    `${entry.brand.padEnd(18)} ${resolved.length > 0 ? resolved.map((c) => c.channelId).join(",") : `unresolved (${links.join(" ")})`}`
  );
}

const outDir = path.join(root, "artifacts", "media-channels");
mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, "brand-official-channels.json");
writeFileSync(
  outFile,
  `${JSON.stringify(
    {
      generatedAtNote:
        "Evidence = the brand's own website linked to this channel. Re-verify before relying on it.",
      results,
    },
    null,
    2
  )}\n`,
  "utf8"
);

const resolvedCount = results.filter((r) => r.status === "resolved").length;
console.log("");
console.log(
  `[discover-channels] ${resolvedCount}/${BRAND_SITES.length} brands have an official channel linked from their own site`
);
console.log(`[discover-channels] report: artifacts/media-channels/brand-official-channels.json`);

/**
 * Extract Ingredients text from Shopify product HTML (metafield / accordion / JSON blobs).
 * Write candidates for curated label-sheet paste — never invent.
 */
import fs from "node:fs";
import path from "node:path";

function decodeShopifyEscapes(s: string): string {
  return s
    .replace(/\\u003c/gi, "<")
    .replace(/\\u003e/gi, ">")
    .replace(/\\u0026/gi, "&")
    .replace(/\\\//g, "/")
    .replace(/\\n/g, " ");
}

function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeInci(s: string): boolean {
  if (s.length < 60) return false;
  if (!/,/.test(s)) return false;
  return /Water|Aqua|Glycerin|Butylene|Niacinamide|Dimethicone|Caprylic/i.test(
    s
  );
}

export function extractIngredientCandidates(html: string): string[] {
  const found: string[] = [];

  const jsonRe = /ingredients:\s*"((?:\\.|[^"])*)"/gi;
  let m: RegExpExecArray | null;
  while ((m = jsonRe.exec(html))) {
    const s = stripTags(decodeShopifyEscapes(m[1]));
    if (looksLikeInci(s)) found.push(s);
  }

  const rich = [
    ...html.matchAll(
      /<h[23][^>]*>\s*Ingredients?\s*<\/h[23]>[\s\S]{0,800}?<p>([\s\S]*?)<\/p>/gi
    ),
    ...html.matchAll(
      /accordion__title[^>]*>\s*Ingredients?\s*<[\s\S]{0,1200}?<p>([\s\S]*?)<\/p>/gi
    ),
    ...html.matchAll(
      /metafield-rich_text_field"><p>([\s\S]*?)<\/p>/gi
    ),
  ];
  for (const hit of rich) {
    const s = stripTags(hit[1] ?? "");
    if (looksLikeInci(s)) found.push(s);
  }

  return [...new Set(found)].sort((a, b) => b.length - a.length);
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (compatible; kbeauty-label-harvester/1.0; +local)",
      accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP_${res.status}:${url}`);
  return res.text();
}

type Job = {
  externalProductId: string;
  urls: string[];
};

const jobs: Job[] = [
  {
    externalProductId: "anua-heartleaf-77-soothing-toner",
    urls: [
      "https://anuabeauty.com/products/heartleaf-77-soothing-toner",
      "https://anua.us/products/heartleaf-77-soothing-toner",
      "https://www.anuabeauty.com/products/heartleaf-77-soothing-toner",
    ],
  },
  {
    externalProductId: "anua-niacinamide-10-txa-4-serum",
    urls: [
      "https://anuabeauty.com/products/niacinamide-10-txa-4-serum",
      "https://anua.us/products/niacinamide-10-txa-4-serum",
    ],
  },
  {
    externalProductId: "beauty-of-joseon-glow-serum-propolis-niacinamide",
    urls: [
      "https://beautyofjoseon.com/products/glow-serum",
      "https://beautyofjoseon.com/products/glow-serum-propolis-niacinamide",
      "https://us.beautyofjoseon.com/products/glow-serum",
    ],
  },
  {
    externalProductId: "beauty-of-joseon-relief-sun-rice-probiotics",
    urls: [
      "https://beautyofjoseon.com/products/relief-sun-rice-probiotics",
      "https://beautyofjoseon.com/products/relief-sun",
    ],
  },
  {
    externalProductId: "beauty-of-joseon-ginseng-essence-water",
    urls: [
      "https://beautyofjoseon.com/products/ginseng-essence-water",
      "https://beautyofjoseon.com/products/ginseng-essence-water-150ml",
    ],
  },
  {
    externalProductId: "round-lab-dokdo-toner",
    urls: [
      "https://roundlab.us/products/1025-dokdo-toner",
      "https://us.roundlab.com/products/1025-dokdo-toner",
      "https://roundlab.com/products/1025-dokdo-toner",
    ],
  },
  {
    externalProductId: "round-lab-birch-juice-moisturizing-sunscreen",
    urls: [
      "https://roundlab.us/products/birch-juice-moisturizing-sunscreen",
      "https://roundlab.us/products/birch-juice-moisturizing-sun-cream",
    ],
  },
  {
    externalProductId: "torriden-dive-in-low-molecule-hyaluronic-acid-serum",
    urls: [
      "https://torriden.com/products/dive-in-low-molecular-hyaluronic-acid-serum",
      "https://torriden.us/products/dive-in-serum",
      "https://www.torriden.us/products/dive-in-low-molecule-hyaluronic-acid-serum",
    ],
  },
];

async function main() {
  const outDir = path.join(
    process.cwd(),
    "data/catalog/labels/_tmp/shopify-inci"
  );
  fs.mkdirSync(outDir, { recursive: true });
  const report: unknown[] = [];

  for (const job of jobs) {
    let best: { url: string; candidates: string[] } | null = null;
    for (const url of job.urls) {
      try {
        const html = await fetchHtml(url);
        const candidates = extractIngredientCandidates(html);
        fs.writeFileSync(
          path.join(outDir, `${job.externalProductId}.html`),
          html.slice(0, 2_000_000)
        );
        if (candidates.length) {
          best = { url, candidates };
          break;
        }
        report.push({
          id: job.externalProductId,
          url,
          status: "no_inci",
          htmlBytes: html.length,
        });
      } catch (e) {
        report.push({
          id: job.externalProductId,
          url,
          status: "error",
          error: String(e).slice(0, 200),
        });
      }
    }
    if (best) {
      fs.writeFileSync(
        path.join(outDir, `${job.externalProductId}.inci.txt`),
        best.candidates[0]!,
        "utf8"
      );
      report.push({
        id: job.externalProductId,
        url: best.url,
        status: "ok",
        candidateCount: best.candidates.length,
        inciLen: best.candidates[0]!.length,
        head: best.candidates[0]!.slice(0, 120),
      });
    } else if (!report.some((r) => (r as { id?: string }).id === job.externalProductId)) {
      report.push({ id: job.externalProductId, status: "exhausted" });
    }
  }

  const manifestPath = path.join(outDir, "manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ outDir, report }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Phase C catalog quality automation (Staging-safe).
 * - Never writes to Production.
 * - Live Staging writes require linked supabase project-ref === staging.
 * - Without Staging link/credentials: offline analysis from disk artifacts only.
 *
 * npm run catalog:phase-c
 */
import { spawnSync } from "node:child_process";
import {
  createHash,
  randomUUID,
} from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvLocal } from "./load-env-local.mjs";
import { recommendWorkerConfig } from "./catalog-worker-config.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STAGING = "jfnjufmldiqlgvgyugfd";
const PROD = "rhfrmvkjsummaylpzmns";
const REPORTS = path.join(root, "reports");
const startedAt = Date.now();

loadEnvLocal(root);
mkdirSync(REPORTS, { recursive: true });

const workers = recommendWorkerConfig();
const summary = {
  phase: "phase_c_catalog_automation",
  startedAt: new Date().toISOString(),
  productionTouched: false,
  autoVerified: false,
  stagingLive: false,
  stagingWriteCount: 0,
  skipped: [],
  blockers: [],
  retries: 0,
  workers: {
    cpuWorkers: workers.cpuWorkers,
    httpConcurrency: Math.min(8, workers.httpConcurrency),
    imageConcurrency: Math.min(12, Math.max(8, workers.httpConcurrency + 2)),
    dbWriteConcurrency: 2,
  },
  before: null,
  after: null,
  images: null,
  offers: null,
  duplicates: null,
  inci: null,
  reviewQueue: null,
  ollama: null,
};

function readJson(p, fallback = null) {
  try {
    if (!existsSync(p)) return fallback;
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return fallback;
  }
}

/** Backup exports are `{ metadata, rows }` or a bare array. */
function asRows(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.rows)) return data.rows;
  return [];
}

function writeJson(p, data) {
  writeFileSync(p, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function writeMd(p, lines) {
  writeFileSync(p, lines.join("\n") + "\n", "utf8");
}

function envPresence() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  let ref = "";
  try {
    ref = new URL(url).hostname.split(".")[0] || "";
  } catch {
    /* ignore */
  }
  return {
    hasUrl: Boolean(url),
    hasAnon: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    hasService: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    hasAccessToken: Boolean(process.env.SUPABASE_ACCESS_TOKEN),
    catalogEnv: process.env.CATALOG_DATABASE_ENV || null,
    appEnv: process.env.APP_ENV || null,
    refHint: ref ? `${ref.slice(0, 4)}…` : null,
    isProdRef: ref === PROD,
    isStagingRef: ref === STAGING,
  };
}

function linkedRef() {
  const p = path.join(root, "supabase", ".temp", "project-ref");
  if (!existsSync(p)) return null;
  return readFileSync(p, "utf8").trim();
}

function assertNoProductionWrite(env) {
  if (env.isProdRef && env.hasService) {
    summary.blockers.push("PRODUCTION_SERVICE_ROLE_WRITE_BLOCKED");
    return false;
  }
  if ((env.appEnv || "").toLowerCase() === "production") {
    summary.blockers.push("APP_ENV_PRODUCTION_BLOCKED");
    return false;
  }
  return true;
}

function runSystemReport() {
  const r = spawnSync(process.execPath, [path.join(root, "scripts", "system-capability-report.mjs")], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  });
  try {
    return JSON.parse(r.stdout || "{}");
  } catch {
    return { error: "system_report_parse_failed" };
  }
}

function normalizeName(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function buildOfflineSnapshot() {
  const labelStatus = readJson(path.join(root, "data/catalog/labels/latest-status.json"), {});
  const sheet = readJson(path.join(root, "data/catalog/labels/official-inci-sheet.v1.json"), {
    entries: [],
  });
  const backupManifest = readJson(
    path.join(root, "data/backups/2026-07-14-catalog/manifest.json"),
    {}
  );
  const products = asRows(
    readJson(path.join(root, "data/backups/2026-07-14-catalog/products.json"), [])
  );
  const offers = asRows(
    readJson(path.join(root, "data/backups/2026-07-14-catalog/product-offers.json"), [])
  );
  const media = asRows(
    readJson(path.join(root, "data/backups/2026-07-14-catalog/product-media.json"), [])
  );
  const audit = readJson(path.join(root, "reports/catalog-audit-summary.json"), {});

  const staging = labelStatus.staging || {};
  const entries = Array.isArray(sheet.entries) ? sheet.entries : [];
  const applyReady = entries.filter((e) => e.applyReady).length;
  const blockedInci = Math.max(0, (staging.heroes || 84) - (staging.with_inci || 57));

  const tinyMedia = media.filter(
    (m) => Number(m.content_length || m.contentLength || 0) > 0 &&
      Number(m.content_length || m.contentLength || 0) < 1000
  ).length;
  const primaryOk = media.filter((m) => {
    const len = Number(m.content_length || m.contentLength || 0);
    return m.is_primary !== false && len >= 1000;
  }).length;

  return {
    source: "offline_disk_artifacts",
    note: "Live Staging link unavailable; snapshot from label status + backup + prior audit",
    environment: backupManifest.environment || "staging-backup",
    stagingLive: false,
    totals: {
      heroes: staging.heroes ?? null,
      withInci: staging.with_inci ?? applyReady,
      officialMatched: staging.official_matched ?? null,
      recommendableFlag: staging.recommendable ?? null,
      evidenceLinked: staging.evidence_linked ?? null,
      blockedOfficialInci: blockedInci,
      sheetEntries: entries.length,
      applyReady,
      backupProducts: products.length,
      backupOffers: offers.length,
      backupMedia: media.length,
      tinyMedia,
      primaryMediaOkEstimate: primaryOk,
      auditVerifiedProducts: audit.verifiedProducts ?? null,
      auditStrictKrOffers: audit.strictKrOffers ?? null,
      auditDuplicateCandidates: audit.duplicateCandidateProducts ?? null,
    },
  };
}

function analyzeImages(media) {
  const items = [];
  let invalid = 0;
  let ok = 0;
  for (const m of media) {
    const len = Number(m.content_length ?? m.contentLength ?? 0);
    const url = m.canonical_image_url || m.url || m.primary_image_url || "";
    const tiny = len > 0 && len < 1000;
    const missing = !url && !m.storage_path;
    const issue = tiny
      ? "IMAGE_INVALID_TINY"
      : missing
        ? "IMAGE_MISSING"
        : null;
    if (issue) invalid += 1;
    else ok += 1;
    items.push({
      productId: m.product_id ?? m.productId ?? null,
      contentLength: len || null,
      issue,
      bucket: issue ? "IMAGE_INVALID" : null,
    });
  }
  return {
    scanned: media.length,
    ok,
    invalid,
    autoFixed: 0,
    items: items.filter((i) => i.issue).slice(0, 200),
  };
}

function analyzeOffers(offers) {
  const items = [];
  let ok = 0;
  let invalid = 0;
  for (const o of offers) {
    const url = o.purchase_url || o.purchaseUrl || "";
    const price = o.price;
    const stock = o.stock_status || o.stockStatus;
    const country = o.retailer_country || o.retailerCountry;
    const issues = [];
    if (!url || !/^https:\/\//i.test(url)) issues.push("bad_url");
    if (price == null || !(Number(price) > 0)) issues.push("price_unknown");
    if (country && country !== "KR" && country !== "US" && country !== "JP") {
      issues.push("country_unclear");
    }
    if (stock === "out_of_stock" || stock === "discontinued") issues.push("inactive_stock");
    if (issues.length) {
      invalid += 1;
      items.push({
        id: o.id,
        productId: o.product_id ?? o.productId,
        issues,
        bucket: "OFFER_INVALID",
        recommendedAction: issues.includes("bad_url")
          ? "mark_inactive_candidate"
          : "recheck_price_stock",
      });
    } else ok += 1;
  }
  return { scanned: offers.length, ok, invalid, autoFixed: 0, items: items.slice(0, 200) };
}

function analyzeDuplicates(products) {
  const map = new Map();
  for (const p of products) {
    const brand = normalizeName(p.brand || p.canonical_brand || "");
    const name = normalizeName(p.name || p.product_name || p.name_ko || "");
    const key = `${brand}::${name}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(p.id ?? p.slug ?? name);
  }
  const groups = [];
  for (const [key, ids] of map) {
    if (ids.length < 2) continue;
    groups.push({
      key,
      ids,
      score: 0.85,
      bucket: "DUPLICATE_SUSPECT",
      recommendedAction: "review_merge_do_not_auto_delete",
    });
  }
  return { groups: groups.slice(0, 200), suspectProducts: groups.reduce((n, g) => n + g.ids.length, 0) };
}

function analyzeInci(sheet, stagingTotals) {
  const entries = Array.isArray(sheet.entries) ? sheet.entries : [];
  const applyReady = entries.filter((e) => e.applyReady).length;
  const blocked = Math.max(0, (stagingTotals.heroes || 84) - (stagingTotals.withInci || applyReady));
  return {
    sheetEntries: entries.length,
    applyReady,
    withInciStaging: stagingTotals.withInci ?? applyReady,
    blockedOfficialInci: blocked,
    note: "Blocked heroes remain BLOCKED without official verbatim INCI; retailer INCI not auto-applied",
    autoApplied: 0,
  };
}

function buildReviewQueue({ images, offers, duplicates, inci, staging }) {
  const queue = [];
  for (const it of images.items || []) {
    queue.push({
      id: `img-${it.productId || randomUUID()}`,
      productId: it.productId,
      bucket: "IMAGE_INVALID",
      issue: it.issue,
      score: 0.4,
      recommendedAction: "replace_official_image_or_mark_missing",
    });
  }
  for (const it of offers.items || []) {
    queue.push({
      id: `offer-${it.id || randomUUID()}`,
      productId: it.productId,
      bucket: "OFFER_INVALID",
      issue: (it.issues || []).join(","),
      score: 0.45,
      recommendedAction: it.recommendedAction,
    });
  }
  for (const g of duplicates.groups || []) {
    queue.push({
      id: `dup-${createHash("sha1").update(g.key).digest("hex").slice(0, 10)}`,
      productId: g.ids[0],
      peerIds: g.ids.slice(1),
      bucket: "DUPLICATE_SUSPECT",
      issue: g.key,
      score: g.score,
      recommendedAction: g.recommendedAction,
    });
  }
  if ((inci.blockedOfficialInci || 0) > 0) {
    queue.push({
      id: "inci-blocked-heroes",
      productId: null,
      bucket: "BLOCKED",
      issue: `official_inci_blocked_count=${inci.blockedOfficialInci}`,
      score: 1,
      recommendedAction: "wait_official_verbatim_or_packaging_label",
      count: inci.blockedOfficialInci,
    });
    queue.push({
      id: "inci-missing-official",
      productId: null,
      bucket: "MISSING_OFFICIAL_INCI",
      issue: "heroes_without_official_verbatim",
      score: 0.95,
      recommendedAction: "collect_official_inci_then_apply_sheet",
      count: inci.blockedOfficialInci,
    });
  }
  const ready = Number(staging.recommendableFlag || 0);
  queue.push({
    id: "ready-pool",
    productId: null,
    bucket: "READY_TO_RECOMMEND",
    issue: "staging_recommendable_flag_count",
    score: 1,
    recommendedAction: "human_review_before_public_verified",
    count: ready,
  });
  return {
    generatedAt: new Date().toISOString(),
    total: queue.length,
    byBucket: queue.reduce((acc, q) => {
      acc[q.bucket] = (acc[q.bucket] || 0) + 1;
      return acc;
    }, {}),
    items: queue,
    autoVerified: false,
  };
}

function probeOllama() {
  try {
    const r = spawnSync("ollama", ["list"], {
      encoding: "utf8",
      shell: true,
      windowsHide: true,
      timeout: 8000,
    });
    const out = r.stdout || "";
    const models = out
      .split(/\r?\n/)
      .slice(1)
      .map((l) => l.trim().split(/\s+/)[0])
      .filter(Boolean);
    return { installed: true, running: (r.status ?? 1) === 0, models, used: false };
  } catch {
    return { installed: false, running: false, models: [], used: false };
  }
}

// --- main ---
const env = envPresence();
summary.env = env;
assertNoProductionWrite(env);

const system = runSystemReport();
summary.system = {
  logicalCpu: system?.cpu?.logicalProcessors,
  ramGb: system?.memory?.totalGb,
  freeRamGb: system?.memory?.freeGb,
  gpus: system?.gpu?.gpus?.map((g) => g.name) || [],
  ollamaRunning: system?.ollama?.running,
  ollamaModels: system?.ollama?.models || [],
};

summary.ollama = probeOllama();
// Do not call Ollama for INCI invent; optional assist unused this run
summary.ollama.used = false;
summary.ollama.reason = "rule_engine_only_no_official_inci_generation";

const linked = linkedRef();
if (linked === PROD) {
  summary.blockers.push("LINKED_REF_IS_PRODUCTION");
}
if (linked === STAGING) {
  summary.stagingLive = true;
} else {
  summary.skipped.push({
    step: "staging_live_sql",
    reason: linked
      ? `linked_ref_not_staging:${linked.slice(0, 4)}…`
      : "supabase_not_linked",
    need: "supabase link --project-ref jfnjufmldiqlgvgyugfd + SUPABASE_ACCESS_TOKEN",
  });
  summary.skipped.push({
    step: "staging_db_writes",
    reason: "no_staging_credentials",
    need: "STAGING_SUPABASE_URL + service role OR linked CLI",
  });
}

if (env.isProdRef) {
  summary.skipped.push({
    step: "env_local_rest_writes",
    reason: "NEXT_PUBLIC_SUPABASE_URL_is_production",
    need: "point Preview/Staging env only; never write via Production URL",
  });
}

const before = buildOfflineSnapshot();
summary.before = before.totals;
writeJson(path.join(REPORTS, "catalog-quality-before.json"), before);
writeMd(path.join(REPORTS, "catalog-quality-before.md"), [
  "# Catalog quality before (Phase C)",
  "",
  `- Generated: ${before.source}`,
  `- Staging live: ${summary.stagingLive}`,
  `- Heroes: ${before.totals.heroes}`,
  `- with_inci: ${before.totals.withInci}`,
  `- official_matched: ${before.totals.officialMatched}`,
  `- recommendable flag: ${before.totals.recommendableFlag}`,
  `- BLOCKED official INCI: ${before.totals.blockedOfficialInci}`,
  `- Backup products/offers/media: ${before.totals.backupProducts}/${before.totals.backupOffers}/${before.totals.backupMedia}`,
  "",
  "## Safety",
  `- Production touched: false`,
  `- Auto verified: false`,
  ...summary.skipped.map((s) => `- SKIPPED ${s.step}: ${s.reason}`),
]);

const media = asRows(
  readJson(path.join(root, "data/backups/2026-07-14-catalog/product-media.json"), [])
);
const offers = asRows(
  readJson(path.join(root, "data/backups/2026-07-14-catalog/product-offers.json"), [])
);
const products = asRows(
  readJson(path.join(root, "data/backups/2026-07-14-catalog/products.json"), [])
);
const sheet = readJson(path.join(root, "data/catalog/labels/official-inci-sheet.v1.json"), {
  entries: [],
});

summary.images = analyzeImages(media);
writeJson(path.join(REPORTS, "catalog-images.json"), summary.images);

summary.offers = analyzeOffers(offers);
writeJson(path.join(REPORTS, "catalog-offers.json"), summary.offers);

summary.duplicates = analyzeDuplicates(products);
writeJson(path.join(REPORTS, "catalog-duplicates.json"), summary.duplicates);

summary.inci = analyzeInci(sheet, before.totals);
writeJson(path.join(REPORTS, "catalog-inci.json"), summary.inci);

const queue = buildReviewQueue({
  images: summary.images,
  offers: summary.offers,
  duplicates: summary.duplicates,
  inci: summary.inci,
  staging: before.totals,
});
summary.reviewQueue = {
  total: queue.total,
  byBucket: queue.byBucket,
};
writeJson(path.join(REPORTS, "catalog-review-queue.json"), queue);

// After = before for live metrics (no staging writes). Recommendable pool not inflated.
const after = {
  ...before,
  source: "offline_after_no_live_writes",
  totals: {
    ...before.totals,
    reviewQueueItems: queue.total,
    imageInvalidFound: summary.images.invalid,
    offerInvalidFound: summary.offers.invalid,
    duplicateSuspectGroups: summary.duplicates.groups.length,
    recommendableDelta: 0,
    note: "Criteria preserved; no auto Verified; live Staging writes SKIPPED",
  },
};
summary.after = after.totals;
writeJson(path.join(REPORTS, "catalog-quality-after.json"), after);
writeMd(path.join(REPORTS, "catalog-quality-after.md"), [
  "# Catalog quality after (Phase C)",
  "",
  `- Recommendable delta: 0 (quality gate unchanged; Staging live writes unavailable)`,
  `- Review queue items: ${queue.total}`,
  `- Image invalid: ${summary.images.invalid}`,
  `- Offer invalid: ${summary.offers.invalid}`,
  `- Duplicate suspect groups: ${summary.duplicates.groups.length}`,
  `- BLOCKED official INCI: ${summary.inci.blockedOfficialInci}`,
  `- Staging auto writes: ${summary.stagingWriteCount}`,
  `- Auto verified: false`,
]);

summary.elapsedMs = Date.now() - startedAt;
writeJson(path.join(REPORTS, "phase-c-summary.json"), summary);

console.log(
  JSON.stringify(
    {
      phase: summary.phase,
      stagingLive: summary.stagingLive,
      stagingWriteCount: summary.stagingWriteCount,
      productionTouched: false,
      autoVerified: false,
      beforeRecommendable: summary.before?.recommendableFlag,
      afterRecommendable: summary.after?.recommendableFlag,
      recommendableDelta: 0,
      reviewQueue: summary.reviewQueue?.total,
      skipped: summary.skipped.map((s) => s.step),
      blockers: summary.blockers,
      elapsedMs: summary.elapsedMs,
      workers: summary.workers,
      ollamaUsed: false,
    },
    null,
    2
  )
);

if (summary.blockers.includes("LINKED_REF_IS_PRODUCTION")) process.exit(2);
process.exit(0);

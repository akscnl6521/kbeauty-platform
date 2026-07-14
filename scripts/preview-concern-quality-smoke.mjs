#!/usr/bin/env node
/**
 * Preview HTTP smoke for Evidence · concern differentiation (no Production).
 *
 * - Vercel Deployment Protection(SSO)이 켜져 있으면 401/302를 **예상 결과**로 기록하고
 *   exit 0 + ssoManualRequired=true 로 끝낸다 (자동 한도).
 * - VERCEL_AUTOMATION_BYPASS_SECRET 이 있으면 bypass 헤더로 /api/analyze 8고민 차별화 검증.
 *
 * Usage:
 *   PREVIEW_BASE_URL=https://….vercel.app node scripts/preview-concern-quality-smoke.mjs
 */
const baseUrl = (
  process.env.PREVIEW_BASE_URL ||
  process.env.PREVIEW_URL ||
  ""
).replace(/\/$/, "");

if (!baseUrl) {
  console.error("PREVIEW_BASE_URL required");
  process.exit(2);
}
if (
  /kbeautymatch\.com/i.test(baseUrl) &&
  !/vercel\.app/i.test(baseUrl)
) {
  console.error("ABORT: refuse non-preview production host");
  process.exit(2);
}

const bypass =
  process.env.VERCEL_AUTOMATION_BYPASS_SECRET ||
  process.env.VERCEL_PROTECTION_BYPASS ||
  process.env.PREVIEW_BYPASS_SECRET ||
  "";

const CONCERNS = [
  "붉은기",
  "건조함",
  "민감",
  "여드름",
  "색소침착",
  "주름",
  "모공",
  "자외선",
];

const failures = [];
const notes = [];

function headers(extra = {}) {
  const h = { ...extra };
  if (bypass) {
    h["x-vercel-protection-bypass"] = bypass;
    h["x-vercel-set-bypass-cookie"] = "true";
  }
  return h;
}

async function get(path) {
  return fetch(`${baseUrl}${path}`, {
    redirect: "manual",
    headers: headers(),
    signal: AbortSignal.timeout(20000),
  });
}

async function postAnalyze(concern) {
  const res = await fetch(`${baseUrl}/api/analyze`, {
    method: "POST",
    headers: headers({ "content-type": "application/json" }),
    body: JSON.stringify({
      mode: "manual",
      skinTone: "중간",
      undertone: "중립",
      sensitivity: "보통",
      concerns: [concern],
    }),
    signal: AbortSignal.timeout(90000),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { res, json };
}

function fingerprint(concern, rec) {
  const links = Array.isArray(rec?.evidenceLinks) ? rec.evidenceLinks : [];
  const pmids = links
    .map((e) => e.pmid || e.doi || e.sourceUrl || "")
    .filter(Boolean)
    .sort()
    .join(",");
  const ings = (rec?.recommendedIngredients || []).slice(0, 4).join("|");
  const prec = (rec?.precautions || [])[0] || "";
  const level = rec?.managementLevel || "";
  return [concern, pmids, ings, prec.slice(0, 40), level].join("||");
}

function isProtectionStatus(status) {
  return status === 401 || status === 403 || status === 302 || status === 307 || status === 308;
}

async function main() {
  console.log(
    JSON.stringify({
      phase: "preview_smoke_start",
      baseUrl,
      hasBypassSecret: Boolean(bypass),
    })
  );

  let protectionSeen = false;

  for (const path of [
    "/",
    "/analyze",
    "/results",
    "/api/health",
    "/admin/evidence",
  ]) {
    try {
      const res = await get(path);
      const status = res.status;
      if (isProtectionStatus(status)) {
        protectionSeen = true;
        notes.push(`protection:${path}:${status}`);
        continue;
      }
      if (status === 200) {
        notes.push(`route_ok:${path}:200`);
        continue;
      }
      failures.push(`${path}: unexpected status ${status}`);
    } catch (e) {
      failures.push(`${path}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const fps = [];
  let analyzeBlocked = false;

  for (const concern of CONCERNS) {
    try {
      const { res, json } = await postAnalyze(concern);
      if (isProtectionStatus(res.status) && res.status !== 200) {
        // POST may return 401 under protection
        if (res.status === 401 || res.status === 403 || res.status === 302) {
          analyzeBlocked = true;
          protectionSeen = true;
          notes.push(`analyze_blocked:${res.status}`);
          break;
        }
      }
      if (res.status !== 200 || !json?.recommendation) {
        if (isProtectionStatus(res.status)) {
          analyzeBlocked = true;
          protectionSeen = true;
          notes.push(`analyze_blocked:${res.status}`);
          break;
        }
        failures.push(
          `analyze ${concern}: status=${res.status} hasRec=${Boolean(json?.recommendation)}`
        );
        continue;
      }
      const rec = json.recommendation;
      fps.push(fingerprint(concern, rec));
      const linkCount = Array.isArray(rec.evidenceLinks)
        ? rec.evidenceLinks.length
        : 0;
      const precCount = Array.isArray(rec.precautions)
        ? rec.precautions.length
        : 0;
      if (linkCount < 1) failures.push(`analyze ${concern}: evidenceLinks empty`);
      if (precCount < 1) failures.push(`analyze ${concern}: precautions empty`);
      console.log(
        JSON.stringify({
          concern,
          evidenceLinks: linkCount,
          precautions: precCount,
          ingredients: (rec.recommendedIngredients || []).slice(0, 3),
          managementLevel: rec.managementLevel,
          pmidSample: (rec.evidenceLinks || [])
            .map((e) => e.pmid)
            .filter(Boolean)
            .slice(0, 2),
        })
      );
    } catch (e) {
      failures.push(
        `analyze ${concern}: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  if (!analyzeBlocked && fps.length === CONCERNS.length) {
    if (new Set(fps).size !== fps.length) {
      failures.push("identical concern fingerprints from Preview /api/analyze");
    } else {
      notes.push("analyze_fingerprints_unique:8");
    }
  }

  const ssoManualRequired = analyzeBlocked || (protectionSeen && fps.length === 0);

  const summary = {
    phase: failures.length
      ? "preview_smoke_fail"
      : ssoManualRequired
        ? "preview_smoke_sso_manual_required"
        : "preview_smoke_ok",
    baseUrl,
    failures,
    notes,
    analyzeFingerprints: fps.length,
    ssoManualRequired,
    nextManualChecks: ssoManualRequired
      ? [
          "Vercel Preview SSO 1회 승인",
          "8고민 각각 /analyze → /results (근거·주의·Top제품·추천이유 상이)",
          "/admin/evidence 목록·승인 UI",
        ]
      : [],
  };
  console.log(JSON.stringify(summary));
  if (failures.length) process.exit(1);
  // SSO 대기는 성공(자동 한도) — exit 0
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

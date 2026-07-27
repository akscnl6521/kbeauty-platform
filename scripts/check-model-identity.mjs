#!/usr/bin/env node
/**
 * Fixed-model identity check harness.
 *
 * There is no face-embedding model available here, so the per-feature call is
 * made by a reviewer looking at the candidate frame beside the reference stills.
 * This harness does everything around that judgement: picks the reference
 * images closest to the candidate's angle, prints the nine locked features to
 * be checked, applies the pass/fail rules, and records the verdict against the
 * asset so the decision is auditable instead of a passing impression.
 *
 *   npm run media:identity-refs                          # list references + what to compare
 *   npm run media:check-identity -- --calls calls.json   # score a completed check
 *
 * calls.json shape:
 *   {
 *     "candidateLabel": "routine-cleansing-frame-004",
 *     "mediaAssetId": "<uuid, optional — records the verdict when present>",
 *     "referenceFiles": ["ref-01-...png", "ref-04-...png", "ref-07-...png"],
 *     "features": { "눈매": "match", "눈동자 색": "match", ... },
 *     "drift": []
 *   }
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
  IDENTITY_FEATURES,
  FORBIDDEN_DRIFT,
  MIN_REFERENCES_PER_CHECK,
  evaluateIdentityCheck,
  hasEnoughReferences,
} from "../src/lib/media/modelIdentityCheck.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROD_REF = "rhfrmvkjsummaylpzmns";
const MODEL_DIR = path.join(root, "data", "model-assets", "kbm-main-model");

function loadEnvFile(name) {
  const p = path.join(root, name);
  if (!existsSync(p)) return {};
  const out = {};
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

const manifestPath = path.join(MODEL_DIR, "manifest.json");
if (!existsSync(manifestPath)) {
  console.error("[identity] FAIL: model manifest missing");
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i === -1 ? null : (process.argv[i + 1] ?? null);
}

// --- reference listing -------------------------------------------------------
if (!argValue("--calls")) {
  console.log(`[identity] 기준 모델: ${manifest.displayName} (${manifest.modelId})`);
  console.log(`[identity] 레퍼런스 ${manifest.images.length}장 · 로컬 ${MODEL_DIR}`);
  console.log("");
  for (const image of manifest.images) {
    const present = existsSync(path.join(MODEL_DIR, image.file)) ? "" : "  [파일 없음]";
    console.log(`  ${image.file.padEnd(42)} ${image.angle}${present}`);
  }
  console.log("");
  console.log(`[identity] 프레임 1장당 최소 ${MIN_REFERENCES_PER_CHECK}장과 대조한다.`);
  console.log("           (측면~정면을 아우르는 세트라 1장 대조로는 각도 차이를 못 가른다)");
  console.log("");
  console.log("[identity] 확인할 고정 항목 9가지:");
  for (const f of IDENTITY_FEATURES) console.log(`   - ${f}`);
  console.log("");
  console.log("[identity] 금지된 변형 (하나라도 있으면 즉시 실패):");
  for (const d of FORBIDDEN_DRIFT) console.log(`   - ${d}`);
  console.log("");
  console.log("[identity] 판정 후: npm run media:check-identity -- --calls <파일>.json");
  process.exit(0);
}

// --- scoring -----------------------------------------------------------------
const callsPath = path.resolve(argValue("--calls"));
if (!existsSync(callsPath)) {
  console.error(`[identity] FAIL: ${callsPath} 없음`);
  process.exit(1);
}
const calls = JSON.parse(readFileSync(callsPath, "utf8"));

const result = evaluateIdentityCheck({
  referenceFiles: calls.referenceFiles ?? [],
  candidateLabel: calls.candidateLabel ?? "(unnamed)",
  features: calls.features ?? {},
  drift: calls.drift ?? [],
});

console.log(`[identity] 후보: ${calls.candidateLabel ?? "(unnamed)"}`);
console.log(`[identity] 대조한 레퍼런스: ${(calls.referenceFiles ?? []).length}장`);
if (!hasEnoughReferences(calls.referenceFiles ?? [])) {
  console.log(
    `[identity] 주의: 권장 최소 ${MIN_REFERENCES_PER_CHECK}장에 미달 — 판정 신뢰도가 낮다`
  );
}
console.log("");
console.log(`[identity] 판정: ${result.verdict.toUpperCase()}`);
if (result.mismatched.length) console.log(`  불일치 : ${result.mismatched.join(", ")}`);
if (result.unclear.length) console.log(`  판독불가: ${result.unclear.join(", ")}`);
if (result.missing.length) console.log(`  미평가  : ${result.missing.join(", ")}`);
if (result.drift.length) console.log(`  금지 변형: ${result.drift.join(", ")}`);
if (result.reasonCodes.length) console.log(`  사유코드: ${result.reasonCodes.join(", ")}`);

if (result.verdict !== "pass") {
  console.log("");
  console.log("[identity] 통과 아님 — 이 프레임은 시리즈에 사용하지 않는다.");
}

// --- record ------------------------------------------------------------------
if (!calls.mediaAssetId) {
  console.log("");
  console.log("[identity] mediaAssetId 없음 — 판정만 출력하고 기록하지 않음");
  process.exit(result.verdict === "pass" ? 0 : 2);
}

const env = { ...loadEnvFile(".env.staging"), ...loadEnvFile(".env.local") };
const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!url || !serviceKey) {
  console.error("[identity] FAIL: Staging 자격증명 없음");
  process.exit(1);
}
const ref = (url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i) ?? [])[1] ?? "";
if (ref === PROD_REF) {
  console.error("[identity] FAIL: Production 대상 거부");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const { error } = await admin.from("media_review_events").insert({
  media_asset_id: calls.mediaAssetId,
  reviewer_id: null,
  decision: result.verdict === "pass" ? "needs_review" : "rejected",
  previous_status: null,
  reason_codes:
    result.reasonCodes.length > 0
      ? ["model_identity_check", ...result.reasonCodes]
      : ["model_identity_check", "identity_confirmed"],
  note: `고정 모델 얼굴 일치 검증 — ${result.verdict} (레퍼런스 ${(calls.referenceFiles ?? []).length}장 대조, 후보 ${calls.candidateLabel})`,
});
if (error) {
  console.error(`[identity] 기록 실패: ${error.message.slice(0, 90)}`);
  process.exit(1);
}
console.log("");
console.log("[identity] 판정을 media_review_events에 기록했다.");
console.log("[identity] 통과해도 자동 승인은 아니다 — 자산은 needs_review로 남는다.");
process.exit(result.verdict === "pass" ? 0 : 2);

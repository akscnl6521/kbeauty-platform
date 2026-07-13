/**
 * Worker entry — loads compiled? For Node strip-types we keep logic minimal:
 * call admin HTTP if BASE_URL set, else instruct to use admin UI / tsx.
 *
 * Recommended local flow:
 * 1) npm run build && npm run start
 * 2) Authenticated admin UI /admin/pipeline
 * 3) Or: curl POST /api/admin/pipeline/batches with session cookie
 */

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  })
);

const base = process.env.PIPELINE_BASE_URL || "http://127.0.0.1:3000";
const cookie = process.env.PIPELINE_ADMIN_COOKIE;

console.log("[pipeline-worker-entry]", {
  base,
  mode: args.mode ?? "dry_run",
  hasCookie: Boolean(cookie),
});

if (!cookie) {
  console.log(
    "[pipeline-worker-entry] PIPELINE_ADMIN_COOKIE 없음 — 관리자 UI에서 실행하거나 쿠키를 설정하세요. 비밀값은 출력하지 않습니다."
  );
  process.exit(0);
}

async function main() {
  const mode = args.mode === "commit" ? "commit" : "dry_run";
  if (args.batch) {
    const res = await fetch(`${base}/api/admin/pipeline/batches`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({
        action: "tick",
        batchId: args.batch,
        tickLimit: Number(args.tick ?? 10),
      }),
    });
    console.log("[tick]", res.status);
    return;
  }

  const res = await fetch(`${base}/api/admin/pipeline/batches`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify({
      action: "start",
      mode,
      brandLimit: Number(args.brands ?? 5),
      productLimitPerBrand: 10,
      tickLimit: Number(args.tick ?? 5),
    }),
  });
  console.log("[start]", res.status);
}

main().catch((err) => {
  console.error("[pipeline-worker-entry] failed", err instanceof Error ? err.message : "error");
  process.exit(1);
});

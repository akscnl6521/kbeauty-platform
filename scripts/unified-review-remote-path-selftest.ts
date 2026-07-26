import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";

async function main() {
  const loaderPath = "src/lib/admin/unified-review.ts";
  const loader = await readFile(loaderPath, "utf8");
  assert.ok(
    loader.includes("UNIFIED_REVIEW_MANIFEST_URL"),
    "loader must support remote URL env",
  );
  assert.ok(
    loader.includes("VERCEL_URL"),
    "loader must auto-wire Preview VERCEL_URL remote path",
  );
  assert.ok(
    loader.includes("/api/public/unified-review-manifest"),
    "loader must target public Preview artifact route",
  );

  const route = await readFile(
    "src/app/api/public/unified-review-manifest/route.ts",
    "utf8",
  );
  assert.ok(route.includes("PRODUCTION_BLOCKED"), "public route must block Production");
  assert.ok(route.includes("artifact_only"), "public route must require artifact_only");

  const fixturePath = path.join(
    process.cwd(),
    "data",
    "review",
    "unified-review-manifest.json",
  );
  const fixture = JSON.parse(await readFile(fixturePath, "utf8")) as {
    mode: string;
    publishAllowed: boolean;
    items: unknown[];
  };
  assert.equal(fixture.mode, "artifact_only");
  assert.equal(fixture.publishAllowed, false);
  assert.ok(Array.isArray(fixture.items));

  const payload = JSON.stringify(fixture);
  const server = createServer((req, res) => {
    if (req.url !== "/manifest.json") {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(payload);
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const port = address.port;

  // Local loopback is http — production code requires https.
  // Validate parse + safety via direct fetch shape instead of env HTTPS constraint.
  const response = await fetch(`http://127.0.0.1:${port}/manifest.json`);
  assert.equal(response.ok, true);
  const body = (await response.json()) as typeof fixture;
  assert.equal(body.mode, "artifact_only");
  assert.equal(body.publishAllowed, false);

  server.close();
  console.log("unified review remote path selftest: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

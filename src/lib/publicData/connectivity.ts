/**
 * T07-01 connectivity probe — auth + one minimal Seoul hospital query.
 * Never writes to any database. Never prints the service key or full auth URL.
 */

import { SEOUL_SIDO_CD } from "./config";
import {
  createPublicDataApiClient,
  type PublicDataClientOptions,
} from "./client";
import {
  assertNoSecretLeak,
  readDataGoKrServiceKey,
  serviceKeyFingerprint,
} from "./secrets";
import type { ConnectivityProbeReport, PublicDataApiMode } from "./types";
import { PUBLIC_DATA_API_TASK_ID } from "./types";

export type ConnectivityProbeOptions = PublicDataClientOptions & {
  /** Force fixture or live. Default: live when key present, else fixture if allowed. */
  mode?: PublicDataApiMode;
  /** Require a real live call (no fixture fallback). Default true for check command. */
  requireLive?: boolean;
  numOfRows?: number;
};

export async function runPublicDataConnectivityProbe(
  opts: ConnectivityProbeOptions = {},
): Promise<ConnectivityProbeReport> {
  const env = opts.env ?? process.env;
  const serviceKey = readDataGoKrServiceKey(env);
  const requireLive = opts.requireLive ?? true;
  const mode: PublicDataApiMode =
    opts.mode ??
    (opts.config?.mode as PublicDataApiMode | undefined) ??
    (serviceKey ? "live" : "fixture");

  const client = createPublicDataApiClient({
    ...opts,
    env,
    allowFixtureFallback: requireLive ? false : (opts.allowFixtureFallback ?? true),
    config: {
      ...opts.config,
      mode,
    },
  });

  const result = await client.listHospitals({
    sidoCd: SEOUL_SIDO_CD,
    pageNo: 1,
    numOfRows: opts.numOfRows ?? 3,
  });

  const sampleNames = (result.data?.body.items ?? [])
    .map((item) => (typeof item.yadmNm === "string" ? item.yadmNm : null))
    .filter((n): n is string => Boolean(n))
    .slice(0, 5);

  const authOk =
    result.ok &&
    !result.meta.usedFixture &&
    result.error?.code !== "auth_failed";

  const seoulQueryOk =
    result.ok &&
    (result.data?.body.items.length ?? 0) > 0 &&
    (mode === "fixture" || result.meta.usedFixture || authOk);

  const report: ConnectivityProbeReport = {
    taskId: PUBLIC_DATA_API_TASK_ID,
    mode: result.meta.usedFixture ? "fixture" : mode,
    generatedAt: new Date().toISOString(),
    serviceKeyPresent: Boolean(serviceKey),
    serviceKeyFingerprint: serviceKey
      ? serviceKeyFingerprint(serviceKey)
      : null,
    authOk: mode === "fixture" || result.meta.usedFixture ? false : authOk,
    seoulQueryOk,
    itemCount: result.data?.body.items.length ?? 0,
    sampleNames,
    safeEndpoint: result.meta.safeEndpoint,
    error: result.error,
    databaseTouched: false,
    writeAttempted: false,
    productionTouched: false,
    ok:
      mode === "fixture" || result.meta.usedFixture
        ? seoulQueryOk && result.meta.usedFixture
        : Boolean(authOk && seoulQueryOk && !result.meta.usedFixture),
  };

  // Safety: serialized report must never contain the raw key
  if (serviceKey) {
    assertNoSecretLeak(JSON.stringify(report), [serviceKey]);
  }

  return report;
}

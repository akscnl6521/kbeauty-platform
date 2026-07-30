import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  summarizeRevenueLedger,
  type CommercialEventRow,
  type RevenueLedgerSummary,
} from "@/lib/commercial/revenueLedger";
import { METRIC_SOURCES } from "@/lib/commercial/revenueMetricCoverage";

/**
 * `commercial_click_events` 를 읽어 관리자용 요약으로 만든다.
 *
 * 이 테이블은 anon·authenticated 에게서 권한이 회수돼 있다(마이그레이션 참고).
 * 서비스 롤로만 읽으므로 서버 전용이다.
 *
 * 테이블이 없거나 권한이 없으면 **빈 요약이 아니라 «읽지 못했다» 를 돌려준다.**
 * 0 건과 «확인 불가» 를 같은 화면으로 보여주면, 수익이 없는 것인지 집계가
 * 깨진 것인지 구분할 수 없다.
 */
export type RevenueLedgerLoadResult =
  | { ok: true; summary: RevenueLedgerSummary; truncated: boolean }
  | { ok: false; reason: string };

/** 한 번에 읽어올 상한. PostgREST 는 어차피 1000 행에서 자른다. */
const MAX_ROWS = 5000;

export async function loadRevenueLedgerSummary(
  limit = MAX_ROWS
): Promise<RevenueLedgerLoadResult> {
  let client;
  try {
    client = createSupabaseAdminClient();
  } catch {
    return { ok: false, reason: "서버 환경변수가 없어 이벤트를 읽지 못했습니다." };
  }

  const rows: CommercialEventRow[] = [];
  let truncated = false;

  for (let offset = 0; offset < limit; offset += 1000) {
    const { data, error } = await client
      .from("commercial_click_events")
      .select("kind,lane,entity_type,country_code,revenue_amount,currency,created_at")
      .order("created_at", { ascending: false })
      .range(offset, offset + 999);

    if (error) {
      // 우회해서 빈 화면을 만들지 않는다. 왜 못 읽었는지 그대로 전한다.
      return {
        ok: false,
        reason:
          error.code === "42501"
            ? "이벤트 테이블 읽기 권한이 없습니다 (service_role SELECT 필요)."
            : `이벤트를 읽지 못했습니다 (${error.code ?? "unknown"}).`,
      };
    }

    const page = (data ?? []) as Array<{
      kind: string;
      lane: string;
      entity_type: string;
      country_code: string | null;
      revenue_amount: number | string | null;
      currency: string | null;
      created_at: string;
    }>;

    for (const r of page) {
      // numeric 컬럼은 드라이버에 따라 문자열로 온다. 조용히 NaN 이 되면
      // 금액이 «없음» 처럼 보이므로 명시적으로 변환한다.
      const amount =
        r.revenue_amount == null
          ? null
          : typeof r.revenue_amount === "number"
            ? r.revenue_amount
            : Number.isFinite(Number(r.revenue_amount))
              ? Number(r.revenue_amount)
              : null;
      rows.push({
        kind: r.kind,
        lane: r.lane,
        entityType: r.entity_type,
        countryCode: r.country_code,
        revenueAmount: amount,
        currency: r.currency,
        createdAt: r.created_at,
      });
    }

    if (page.length < 1000) break;
    if (offset + 1000 >= limit) truncated = true;
  }

  return { ok: true, summary: summarizeRevenueLedger(rows), truncated };
}

/**
 * §38.8 지표의 적재처를 하나씩 조회해 «몇 건인지 / 테이블이 없는지» 를 센다.
 *
 * 테이블이 없으면 `null` 을 넣는다. 0 을 넣으면 «측정했더니 0» 이 되어,
 * 실제로는 수집조차 하지 않는 지표가 «성과 없음» 으로 보고된다.
 */
export async function loadMetricSourceCounts(): Promise<Map<string, number | null>> {
  const counts = new Map<string, number | null>();
  let client;
  try {
    client = createSupabaseAdminClient();
  } catch {
    return counts;
  }

  const sources = [...new Set(METRIC_SOURCES.map((m) => m.source))];
  for (const source of sources) {
    const { count, error } = await client
      .from(source)
      .select("*", { count: "exact", head: true });
    // 없는 테이블은 **오류를 내지 않는다.** 2026-07-27 실측: 존재하는 빈
    // 테이블은 `status 200, count 0`, 없는 테이블은 `status 204, count null`
    // 이고 둘 다 `error` 는 null 이다. 그래서 `count ?? 0` 으로 받으면 수집
    // 자체를 안 하는 지표가 «측정했더니 0» 으로 둔갑한다.
    counts.set(source, error || count == null ? null : count);
  }
  return counts;
}

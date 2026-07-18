import { requireAdminUser } from "@/lib/auth/admin";
import { CatalogAutomationShell } from "../CatalogAutomationShell";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Catalog Automation Queue | K-Beauty Match",
  robots: { index: false, follow: false },
};

type QueueFile = {
  generatedAt?: string;
  total?: number;
  byBucket?: Record<string, number>;
  items?: Array<{
    id: string;
    productId?: string | number | null;
    bucket: string;
    issue?: string;
    score?: number;
    recommendedAction?: string;
    count?: number;
    peerIds?: Array<string | number>;
  }>;
  autoVerified?: boolean;
};

function loadQueue(): QueueFile {
  const p = path.join(process.cwd(), "reports", "catalog-review-queue.json");
  if (!existsSync(p)) return { total: 0, byBucket: {}, items: [] };
  try {
    return JSON.parse(readFileSync(p, "utf8")) as QueueFile;
  } catch {
    return { total: 0, byBucket: {}, items: [], generatedAt: "parse_error" };
  }
}

const BUCKETS = [
  "READY_FOR_REVIEW",
  "MISSING_OFFICIAL_INCI",
  "IMAGE_INVALID",
  "OFFER_INVALID",
  "DUPLICATE_SUSPECT",
  "VARIANT_MISMATCH",
  "SOURCE_CONFLICT",
  "READY_TO_RECOMMEND",
  "BLOCKED",
] as const;

export default async function CatalogAutomationQueuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminUser();
  const sp = await searchParams;
  const bucketRaw = sp.bucket;
  const bucket = Array.isArray(bucketRaw) ? bucketRaw[0] : bucketRaw;
  const queue = loadQueue();
  const items = (queue.items ?? []).filter((it) =>
    bucket ? it.bucket === bucket : true
  );

  return (
    <CatalogAutomationShell
      title="Automation review queue"
      description="Phase C 자동 점검 결과(읽기 전용). Verified 자동 승인 없음 · Production 쓰기 없음."
    >
      <div className="space-y-4 text-sm">
        <p className="text-xs text-gray-500">
          generated: {queue.generatedAt ?? "n/a"} · total {queue.total ?? 0} ·
          autoVerified: {String(queue.autoVerified ?? false)}
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            href="/admin/catalog/automation-queue"
            className={`rounded-full border px-3 py-1 ${!bucket ? "bg-[#C2185B] text-white" : "bg-white"}`}
          >
            ALL
          </a>
          {BUCKETS.map((b) => (
            <a
              key={b}
              href={`/admin/catalog/automation-queue?bucket=${encodeURIComponent(b)}`}
              className={`rounded-full border px-3 py-1 ${
                bucket === b ? "bg-[#C2185B] text-white" : "bg-white"
              }`}
            >
              {b}
              {queue.byBucket?.[b] != null ? ` (${queue.byBucket[b]})` : ""}
            </a>
          ))}
        </div>

        {!items.length ? (
          <p className="rounded-xl border border-dashed border-[#E8DFD8] bg-[#FAF7F5] p-6 text-gray-600">
            큐가 비어 있거나 `npm run catalog:phase-c`를 아직 실행하지 않았습니다.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#E8DFD8] bg-white">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b bg-[#FAF7F5] text-[11px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2">Bucket</th>
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2">Issue</th>
                  <th className="px-3 py-2">Score</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.slice(0, 200).map((it) => (
                  <tr key={it.id} className="border-b border-[#F0E8E1]">
                    <td className="px-3 py-2 font-medium">{it.bucket}</td>
                    <td className="px-3 py-2">
                      {it.productId ?? "—"}
                      {it.count != null ? ` · n=${it.count}` : ""}
                    </td>
                    <td className="max-w-md px-3 py-2 break-words text-gray-600">
                      {it.issue ?? "—"}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{it.score ?? "—"}</td>
                    <td className="px-3 py-2 text-gray-700">
                      {it.recommendedAction ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-gray-500">
          대량 Verified 승인 버튼은 제공하지 않습니다. needs_review만 사람이
          처리하세요.
        </p>
      </div>
    </CatalogAutomationShell>
  );
}

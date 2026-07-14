import Link from "next/link";
import { requireAdminUser } from "@/lib/auth/admin";
import { AdminConfigurationError } from "@/lib/auth/errors";
import { listAdminEvidence } from "@/lib/admin/evidence";
import { AdminLogoutButton } from "../AdminLogoutButton";
import { AdminSubnav } from "../AdminSubnav";
import { EvidenceCreateForm, EvidenceReviewButtons } from "./EvidenceActions";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Admin Evidence | K-Beauty Match",
  robots: { index: false, follow: false },
};

export default async function AdminEvidencePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminUser();
  const sp = (await searchParams) ?? {};
  const reviewStatus =
    typeof sp.reviewStatus === "string" ? sp.reviewStatus : "";

  let result;
  try {
    result = await listAdminEvidence({
      page: 1,
      pageSize: 50,
      q: typeof sp.q === "string" ? sp.q : "",
      reviewStatus,
      evidenceLevel: "",
      ingredientId: "",
    });
  } catch (e) {
    if (e instanceof AdminConfigurationError) {
      return (
        <main className="mx-auto max-w-5xl px-4 py-10">
          <p className="text-sm text-red-700">Admin DB 설정을 확인하세요.</p>
        </main>
      );
    }
    throw e;
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
            Admin
          </p>
          <h1 className="mt-2 font-semibold tracking-tight text-gray-900 text-2xl">
            Evidence
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-600">
            성분–고민 논문·공식 근거. 승인된 행만 공개 추천 힌트에 사용됩니다.
          </p>
        </div>
        <AdminLogoutButton />
      </div>
      <AdminSubnav current="evidence" />

      <div className="mt-6 flex flex-wrap gap-2 text-sm">
        <Link href="/admin/evidence" className="underline text-[#8B6914]">
          전체
        </Link>
        <Link
          href="/admin/evidence?reviewStatus=pending"
          className="underline text-[#8B6914]"
        >
          pending
        </Link>
        <Link
          href="/admin/evidence?reviewStatus=approved"
          className="underline text-[#8B6914]"
        >
          approved
        </Link>
      </div>

      <div className="mt-8">
        <EvidenceCreateForm />
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-gray-900">
          목록 ({result.total})
        </h2>
        <div className="mt-4 overflow-x-auto rounded-lg border border-[#E8DFD8] bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[#E8DFD8] bg-[#F7F1EC] text-xs uppercase tracking-wide text-gray-600">
              <tr>
                <th className="px-3 py-2">ingredient</th>
                <th className="px-3 py-2">concern</th>
                <th className="px-3 py-2">level</th>
                <th className="px-3 py-2">review</th>
                <th className="px-3 py-2">pmid</th>
                <th className="px-3 py-2">actions</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-[#F0E8E2] last:border-0"
                >
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/ingredients/${item.ingredientId}`}
                      className="underline text-[#8B6914]"
                    >
                      {item.ingredientSlug ?? item.ingredientId}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    {item.concernNameKo ?? item.concernCode ?? "—"}
                  </td>
                  <td className="px-3 py-2">{item.evidenceLevel}</td>
                  <td className="px-3 py-2">{item.reviewStatus}</td>
                  <td className="px-3 py-2">
                    {item.sourceUrlSafeHttps && item.sourceUrl ? (
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline text-[#C2185B]"
                      >
                        {item.pmid ?? "source"}
                      </a>
                    ) : (
                      (item.pmid ?? "—")
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <EvidenceReviewButtons item={item} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

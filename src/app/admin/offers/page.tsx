import Link from "next/link";
import { requireAdminUser } from "@/lib/auth/admin";
import { getAdminOffers } from "@/lib/admin/offers";
import { AdminLogoutButton } from "../AdminLogoutButton";
import { AdminSubnav } from "../AdminSubnav";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Admin Offers | K-Beauty Match",
  robots: { index: false, follow: false },
};

export default async function AdminOffersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminUser();
  const sp = await searchParams;
  const verificationStatus =
    typeof sp.verificationStatus === "string" ? sp.verificationStatus : undefined;
  const stockStatus =
    typeof sp.stockStatus === "string" ? sp.stockStatus : undefined;
  const country = typeof sp.country === "string" ? sp.country : undefined;

  const { items, total } = await getAdminOffers({
    verificationStatus,
    stockStatus,
    country,
    limit: 100,
  });

  return (
    <main className="min-h-screen bg-[#FAF7F5] px-4 py-10 text-gray-900 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8B6914]">
              Admin
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Offers</h1>
            <p className="mt-2 text-sm text-gray-600">
              공식몰·검증 판매처 자동 수집. 사람은 needs_review만 확인합니다. total={total}
            </p>
            <AdminSubnav current="offers" />
          </div>
          <AdminLogoutButton className="shrink-0 rounded-lg border border-[#E8DFD8] bg-white px-3 py-1.5 text-sm font-medium text-gray-800" />
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <Link className="underline text-[#8B6914]" href="/admin/offers?verificationStatus=verified">
            verified
          </Link>
          <Link className="underline text-[#8B6914]" href="/admin/offers?verificationStatus=unverified">
            unverified
          </Link>
          <Link className="underline text-[#8B6914]" href="/admin/offers?stockStatus=in_stock">
            in_stock
          </Link>
          <Link className="underline text-[#8B6914]" href="/admin/offers?country=KR">
            KR
          </Link>
          <Link className="underline text-[#8B6914]" href="/admin/offers">
            all
          </Link>
        </div>

        <div className="mt-6 overflow-x-auto rounded-lg border border-[#E8DFD8] bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[#E8DFD8] bg-[#F7F1EC] text-xs uppercase text-gray-600">
              <tr>
                <th className="px-3 py-2">제품</th>
                <th className="px-3 py-2">retailer</th>
                <th className="px-3 py-2">country</th>
                <th className="px-3 py-2">price</th>
                <th className="px-3 py-2">stock</th>
                <th className="px-3 py-2">verification</th>
                <th className="px-3 py-2">official</th>
                <th className="px-3 py-2">링크</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-[#F0E8E2]">
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/products/${item.productId}`}
                      className="font-medium underline"
                    >
                      {item.productName ?? `#${item.productId}`}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{item.retailerName}</td>
                  <td className="px-3 py-2">{item.retailerCountry}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {item.price != null
                      ? `${item.price} ${item.currency ?? ""}`
                      : "—"}
                  </td>
                  <td className="px-3 py-2">{item.stockStatus}</td>
                  <td className="px-3 py-2">{item.verificationStatus}</td>
                  <td className="px-3 py-2">{item.isOfficial ? "yes" : "no"}</td>
                  <td className="px-3 py-2">
                    {item.purchaseUrlSafe ? (
                      <a
                        href={item.purchaseUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#8B6914] underline"
                      >
                        열기
                      </a>
                    ) : (
                      <span className="text-gray-400">차단</span>
                    )}
                    {" · "}
                    <Link
                      href={`/admin/offers/${item.id}`}
                      className="underline"
                    >
                      상세
                    </Link>
                  </td>
                </tr>
              ))}
              {!items.length ? (
                <tr>
                  <td className="px-3 py-6 text-gray-500" colSpan={8}>
                    offer 없음 (다음 스케줄 worker가 공식몰에서 수집)
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

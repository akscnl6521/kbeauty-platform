import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminUser } from "@/lib/auth/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AdminLogoutButton } from "../../AdminLogoutButton";
import { AdminSubnav } from "../../AdminSubnav";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Admin Offer Detail | K-Beauty Match",
  robots: { index: false, follow: false },
};

export default async function AdminOfferDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminUser();
  const { id } = await params;
  const client = createSupabaseAdminClient();
  const { data } = await client
    .from("product_offers")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();

  const row = data as Record<string, unknown>;
  const url = String(row.purchase_url ?? "");
  let safe = false;
  try {
    safe = new URL(url).protocol === "https:";
  } catch {
    safe = false;
  }

  return (
    <main className="min-h-screen bg-[#FAF7F5] px-4 py-10 text-gray-900 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Offer 상세</h1>
            <AdminSubnav current="offers" />
          </div>
          <AdminLogoutButton className="shrink-0 rounded-lg border border-[#E8DFD8] bg-white px-3 py-1.5 text-sm" />
        </div>
        <p className="mt-4 text-sm">
          <Link href="/admin/offers" className="text-[#8B6914] underline">
            ← Offers
          </Link>
        </p>
        <dl className="mt-6 space-y-2 rounded-lg border border-[#E8DFD8] bg-white px-4 py-4 text-sm">
          {Object.entries(row).map(([k, v]) => (
            <div key={k} className="grid grid-cols-3 gap-2">
              <dt className="text-gray-500">{k}</dt>
              <dd className="col-span-2 break-all">
                {k === "purchase_url" && safe ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#8B6914] underline"
                  >
                    {url}
                  </a>
                ) : (
                  String(v ?? "—")
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </main>
  );
}

import Link from "next/link";
import { requireAdminUser } from "@/lib/auth/admin";
import { AdminSubnav } from "../../AdminSubnav";
import { CheckinEmailWorkerAdminClient } from "./CheckinEmailWorkerAdminClient";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Check-in Email Worker | Care Admin",
  robots: { index: false, follow: false },
};

export default async function CheckinEmailWorkerAdminPage() {
  await requireAdminUser();

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 text-sm">
      <h1 className="text-xl font-semibold">체크인 이메일 Worker 관리</h1>
      <AdminSubnav current="care" />
      <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-950">
        <strong>실제 이메일 발송 없음</strong> · dry-run only · live provider 호출 금지
      </p>
      <div className="mt-6">
        <CheckinEmailWorkerAdminClient />
      </div>
      <Link href="/admin/care" className="mt-8 inline-block text-[#8B6914] underline">
        ← Care
      </Link>
    </main>
  );
}

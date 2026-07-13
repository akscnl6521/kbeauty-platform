import { NextResponse } from "next/server";
import { getCustomerUser } from "@/lib/auth/customer";

export async function GET() {
  const user = await getCustomerUser();
  if (!user) return NextResponse.json({ ok: false, error: { message: "로그인이 필요합니다." } }, { status: 401 });
  return NextResponse.json({ ok: true, data: { email: user.email } });
}

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCustomerUser } from "@/lib/auth/customer";
import { sanitizeCustomerNextPath } from "@/lib/auth/safe-next";

export default async function MyLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  if (!(await getCustomerUser())) {
    const pathname = (await headers()).get("x-pathname") || "/my";
    const next = sanitizeCustomerNextPath(pathname, "/my");
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  return children;
}

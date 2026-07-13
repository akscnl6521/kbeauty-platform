import { redirect } from "next/navigation";
import { getCustomerUser } from "@/lib/auth/customer";

export default async function MyLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  if (!(await getCustomerUser())) redirect("/login?next=%2Fmy");
  return children;
}
